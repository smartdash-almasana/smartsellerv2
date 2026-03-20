import { supabaseAdmin } from '@v2/lib/supabase';

export interface NormalizeV3WebhookInput {
    webhook_event_id: string;
}

export interface NormalizeV3WebhookResult {
    domain_event_id: string;
    created: boolean;
}

interface WebhookRow {
    webhook_event_id: string;
    tenant_id: string;
    store_id: string;
    provider_key: 'mercadolibre' | 'shopify' | 'system';
    source_event_id: string;
    payload: Record<string, unknown>;
    received_at: string;
}

function asString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function inferEventType(providerKey: WebhookRow['provider_key'], payload: Record<string, unknown>): string {
    const explicit = asString(payload['event_type'], '');
    if (explicit) return explicit;
    if (providerKey !== 'mercadolibre') return 'unknown.event';

    const topic = asString(payload['topic'], '');
    if (topic === 'orders_v2') return 'order.created';
    if (topic === 'questions') return 'message.received';
    if (topic === 'claims') return 'claim.opened';
    if (topic === 'payments') return 'payment.updated';
    return 'unknown.event';
}

function inferEntityType(payload: Record<string, unknown>): string {
    const explicit = asString(payload['entity_type'], '');
    if (explicit) return explicit;

    const resource = asString(payload['resource'], '');
    const parts = resource.split('/').filter(Boolean);
    return parts[0] ?? 'unknown';
}

function inferEntityId(sourceEventId: string, payload: Record<string, unknown>): string {
    const explicit = asString(payload['entity_id'], '');
    if (explicit) return explicit;

    const resource = asString(payload['resource'], '');
    const parts = resource.split('/').filter(Boolean);
    return parts[1] ?? sourceEventId;
}

function inferOccurredAt(receivedAt: string, payload: Record<string, unknown>): string {
    const explicit = asString(payload['occurred_at'], '');
    if (explicit) return explicit;

    const sentAt = asString(payload['sent'], '');
    if (sentAt) return sentAt;

    return receivedAt;
}

export async function normalizeV3WebhookEvent(input: NormalizeV3WebhookInput): Promise<NormalizeV3WebhookResult> {
    const { webhook_event_id } = input;

    const { data: whRow, error: readErr } = await supabaseAdmin
        .from('v3_webhook_events')
        .select('webhook_event_id, tenant_id, store_id, provider_key, source_event_id, payload, received_at')
        .eq('webhook_event_id', webhook_event_id)
        .limit(1)
        .maybeSingle<WebhookRow>();

    if (readErr) throw new Error(`[v3-normalizer] webhook read failed: ${readErr.message}`);
    if (!whRow) throw new Error('[v3-normalizer] webhook event not found');

    const payload = whRow.payload ?? {};
    const event_type = inferEventType(whRow.provider_key, payload);
    const entity_type = inferEntityType(payload);
    const entity_id = inferEntityId(whRow.source_event_id, payload);
    const occurred_at = inferOccurredAt(whRow.received_at, payload);

    const { data: existingDomainEvent, error: existingErr } = await supabaseAdmin
        .from('v3_domain_events')
        .select('domain_event_id')
        .eq('tenant_id', whRow.tenant_id)
        .eq('store_id', whRow.store_id)
        .eq('provider_key', whRow.provider_key)
        .eq('source_event_id', whRow.source_event_id)
        .limit(1)
        .maybeSingle<{ domain_event_id: string }>();
    if (existingErr) throw new Error(`[v3-normalizer] existing domain_event lookup failed: ${existingErr.message}`);
    const existedBefore = Boolean(existingDomainEvent?.domain_event_id);

    const { data: deRow, error: writeErr } = await supabaseAdmin
        .from('v3_domain_events')
        .upsert(
            {
                tenant_id: whRow.tenant_id,
                store_id: whRow.store_id,
                provider_key: whRow.provider_key,
                source_event_id: whRow.source_event_id,
                source_webhook_event_id: whRow.webhook_event_id,
                event_type,
                entity_type,
                entity_id,
                payload,
                occurred_at,
                normalized_at: new Date().toISOString(),
            },
            { onConflict: 'tenant_id,store_id,provider_key,source_event_id' }
        )
        .select('domain_event_id')
        .single<{ domain_event_id: string }>();

    if (writeErr || !deRow?.domain_event_id) {
        throw new Error(`[v3-normalizer] domain_event upsert failed: ${writeErr?.message ?? 'unknown error'}`);
    }

    const { error: statusErr } = await supabaseAdmin
        .from('v3_webhook_events')
        .update({
            processing_status: 'processed',
            processing_claimed_at: null,
            processing_error: null,
        })
        .eq('webhook_event_id', webhook_event_id);
    if (statusErr) throw new Error(`[v3-normalizer] webhook status update failed: ${statusErr.message}`);

    return {
        domain_event_id: deRow.domain_event_id,
        created: !existedBefore,
    };
}
