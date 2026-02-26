// ============================================================================
// SmartSeller V2 — Webhook Handler (Ingest Layer)
// Responsibility: receive, validate, persist. Nothing else.
// No clinical logic. No ML API calls. No normalization. No fire-and-forget.
// ============================================================================

import { supabaseAdmin } from '../lib/supabase';
import type { StoreRow } from '../types/v2';

// ─── Incoming payload shape from MercadoLibre ────────────────────────────────
interface MeliWebhookPayload {
    resource: string;
    topic: string;
    user_id: string | number;
    [key: string]: unknown;
}

// ─── Handler result ───────────────────────────────────────────────────────────
interface HandlerResult {
    status: 200 | 404 | 422 | 500;
    body: Record<string, unknown>;
}

// ─── Validation ──────────────────────────────────────────────────────────────
class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

function validate(payload: unknown): MeliWebhookPayload {
    if (typeof payload !== 'object' || payload === null) {
        throw new ValidationError('Payload must be a non-null object');
    }
    const p = payload as Record<string, unknown>;

    if (typeof p['resource'] !== 'string' || p['resource'].trim() === '') {
        throw new ValidationError('Missing or empty field: resource');
    }
    if (typeof p['topic'] !== 'string' || p['topic'].trim() === '') {
        throw new ValidationError('Missing or empty field: topic');
    }
    if (p['user_id'] === undefined || p['user_id'] === null || p['user_id'] === '') {
        throw new ValidationError('Missing field: user_id');
    }

    return p as unknown as MeliWebhookPayload;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function handleMeliWebhook(rawPayload: unknown): Promise<HandlerResult> {
    // 1. Validate required fields
    let payload: MeliWebhookPayload;
    try {
        payload = validate(rawPayload);
    } catch (err) {
        if (err instanceof ValidationError) {
            return { status: 422, body: { error: err.message } };
        }
        throw err;
    }

    // Normalize user_id to string — external_account_id is always TEXT in V2.
    const externalAccountId = String(payload.user_id);

    // 2. Resolve store by (provider_key, external_account_id)
    const { data: store, error: storeError } = await supabaseAdmin
        .from('v2_stores')
        .select('store_id, connection_status')
        .eq('provider_key', 'mercadolibre')
        .eq('external_account_id', externalAccountId)
        .limit(1)
        .maybeSingle<Pick<StoreRow, 'store_id' | 'connection_status'>>();

    if (storeError) {
        console.error('[webhook-handler] Store lookup error:', {
            message: storeError.message,
            code: storeError.code,
        });
        return { status: 500, body: { error: 'Store lookup failed' } };
    }

    if (!store) {
        return {
            status: 404,
            body: { error: 'No store found for provider=mercadolibre', external_account_id: externalAccountId },
        };
    }

    // 3. Persist to v2_webhook_events (idempotent via schema UNIQUE constraint)
    // throwOnError() throws on DB errors — no post-check needed on the error variable.
    await supabaseAdmin
        .from('v2_webhook_events')
        .insert({
            store_id: store.store_id,
            provider_event_id: payload.resource,
            topic: payload.topic,
            resource: payload.resource,
            provider_user_id: externalAccountId,
            raw_payload: rawPayload as Record<string, unknown>,
        })
        .throwOnError();

    return { status: 200, body: { ok: true } };
}
