import { supabaseAdmin } from '../lib/supabase';
import { logIngestAttempt } from './ingest-attempts';

type JsonMap = Record<string, unknown>;

export interface WebhookEventInput {
    event_id: string;
    store_id: string;
    tenant_id?: string | null;
    topic: string;
    resource?: string | null;
    received_at: string;
    raw_payload?: JsonMap | null;
}

export interface WorkerRunResult {
    scanned: number;
    inserted: number;
    deduped: number;
}

interface DomainEventInsert {
    source_event_id: string;
    store_id: string;
    tenant_id?: string | null;
    event_type: string;
    entity_type: string;
    entity_id: string;
    occurred_at: string;
    payload: JsonMap | null;
}

export interface WorkerDeps {
    loadWebhookEvents: (limit: number) => Promise<WebhookEventInput[]>;
    insertDomainEvent: (event: DomainEventInsert) => Promise<boolean>;
}

function mapTopic(topic: string): { event_type: string; entity_type: string } {
    switch (topic) {
        case 'orders_v2':
            return { event_type: 'order.updated', entity_type: 'order' };
        case 'payments':
            return { event_type: 'payment.updated', entity_type: 'payment' };
        case 'questions':
            return { event_type: 'question.received', entity_type: 'question' };
        case 'messages':
            return { event_type: 'message.received', entity_type: 'message' };
        default:
            return { event_type: topic, entity_type: 'unknown' };
    }
}

function extractEntityId(resource: string | null | undefined): string {
    if (!resource) return 'unknown';
    const trimmed = resource.replace(/\/$/, '');
    const last = trimmed.split('/').pop();
    return last && last.trim() !== '' ? last.trim() : resource;
}

const dbDeps: WorkerDeps = {
    async loadWebhookEvents(limit: number): Promise<WebhookEventInput[]> {
        const candidateLimit = Math.min(Math.max(limit * 4, limit), 2000);

        const { data, error } = await supabaseAdmin
            .from('v2_webhook_events')
            .select('event_id, store_id, tenant_id, topic, resource, received_at, raw_payload')
            .order('received_at', { ascending: true })
            .limit(candidateLimit);

        if (error) {
            throw new Error(`[v2-worker] load webhook events failed: ${error.message}`);
        }

        const rows = (data ?? []) as WebhookEventInput[];
        if (rows.length === 0) return rows;

        const eventIds = rows.map((r) => r.event_id);
        const { data: existing, error: existingError } = await supabaseAdmin
            .from('v2_domain_events')
            .select('source_event_id')
            .in('source_event_id', eventIds);

        if (existingError) {
            throw new Error(`[v2-worker] load existing domain events failed: ${existingError.message}`);
        }

        const processed = new Set(
            ((existing ?? []) as Array<{ source_event_id: string | null }>)
                .map((r) => r.source_event_id)
                .filter((v): v is string => Boolean(v))
        );

        return rows.filter((r) => !processed.has(r.event_id)).slice(0, limit);
    },

    async insertDomainEvent(event: DomainEventInsert): Promise<boolean> {
        const { data, error } = await supabaseAdmin
            .from('v2_domain_events')
            .upsert(event, { onConflict: 'source_event_id', ignoreDuplicates: true })
            .select('domain_event_id')
            .maybeSingle<{ domain_event_id: string }>();

        if (error) {
            throw new Error(`[v2-worker] insert domain event failed: ${error.message}`);
        }

        return Boolean(data);
    },
};

export async function runV2WebhookToDomainWorkerWithDeps(
    deps: WorkerDeps,
    limit = 50
): Promise<WorkerRunResult> {
    const rows = await deps.loadWebhookEvents(limit);
    let inserted = 0;
    let deduped = 0;

    for (const row of rows) {
        const mapped = mapTopic(row.topic);
        try {
            const created = await deps.insertDomainEvent({
                source_event_id: row.event_id,
                store_id: row.store_id,
                tenant_id: row.tenant_id ?? null,
                event_type: mapped.event_type,
                entity_type: mapped.entity_type,
                entity_id: extractEntityId(row.resource ?? null),
                occurred_at: row.received_at,
                payload: (row.raw_payload as JsonMap | null) ?? null,
            });

            if (created) inserted += 1;
            else deduped += 1;

            await logIngestAttempt({
                event_id: row.event_id,
                store_id: row.store_id,
                worker: 'v2-webhook-to-domain',
                status: created ? 'ok' : 'skipped',
            });
        } catch (error: any) {
            await logIngestAttempt({
                event_id: row.event_id,
                store_id: row.store_id,
                worker: 'v2-webhook-to-domain',
                status: 'error',
                error_message: error.message,
                error_detail: { stack: error.stack },
            });
            throw error;
        }
    }

    return {
        scanned: rows.length,
        inserted,
        deduped,
    };
}

export async function runV2WebhookToDomainWorker(limit = 50): Promise<WorkerRunResult> {
    return runV2WebhookToDomainWorkerWithDeps(dbDeps, limit);
}
