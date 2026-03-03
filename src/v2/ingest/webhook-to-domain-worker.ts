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
    // DLQ-mode counters (always 0 in normal mode)
    retried: number;
    skipped: number;
    errors: number;
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
    loadDlqEvents: (limit: number) => Promise<WebhookEventInput[]>;
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

    async loadDlqEvents(limit: number): Promise<WebhookEventInput[]> {
        // DLQ candidates: webhook_events that:
        //   - had at least one error attempt
        //   - have no corresponding domain_event
        //   - have fewer than 10 total attempts
        //   - last attempt was > 10 minutes ago (backoff)
        const safeLimit = Math.min(Math.max(limit, 1), 200);

        const { data, error } = await supabaseAdmin.rpc('v2_dlq_candidates', {
            p_limit: safeLimit,
            p_backoff_minutes: 10,
            p_max_attempts: 10,
        });

        if (error) {
            // Fallback: if the RPC doesn't exist yet, use inline SQL via raw JS query
            // This path exists only during migration before the view/function is created.
            throw new Error(`[v2-worker] load DLQ events failed: ${error.message}`);
        }

        // RPC returns rows matching WebhookEventInput shape (event_id, store_id, tenant_id, topic, resource, received_at, raw_payload)
        return (data ?? []) as WebhookEventInput[];
    },
};

// ── Low-level DLQ loader (direct SQL, no RPC dependency) ─────────────────────
// Used as the primary DLQ loader; avoids a DB function dependency.
async function loadDlqEventsDirect(limit: number): Promise<WebhookEventInput[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);

    // Step 1: aggregate attempt stats per event
    const { data: stats, error: statsError } = await supabaseAdmin
        .from('v2_ingest_attempts')
        .select('event_id, status, created_at')
        .not('event_id', 'is', null);

    if (statsError) throw new Error(`[v2-worker/dlq] load attempt stats failed: ${statsError.message}`);

    // Build per-event aggregates in JS (avoids needing a DB view/function)
    const statsMap = new Map<string, { total: number; hasError: boolean; lastAt: Date }>();
    for (const row of (stats ?? []) as Array<{ event_id: string; status: string; created_at: string }>) {
        const existing = statsMap.get(row.event_id);
        const ts = new Date(row.created_at);
        if (!existing) {
            statsMap.set(row.event_id, { total: 1, hasError: row.status === 'error', lastAt: ts });
        } else {
            existing.total += 1;
            if (row.status === 'error') existing.hasError = true;
            if (ts > existing.lastAt) existing.lastAt = ts;
        }
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // Filter to DLQ-eligible event_ids
    const eligible = [...statsMap.entries()]
        .filter(([, s]) =>
            s.hasError &&
            s.total < 10 &&
            s.lastAt < tenMinutesAgo
        )
        .map(([id]) => id)
        .slice(0, safeLimit);

    if (eligible.length === 0) return [];

    // Step 2: load the webhook_events for eligible ids
    const { data: events, error: eventsError } = await supabaseAdmin
        .from('v2_webhook_events')
        .select('event_id, store_id, tenant_id, topic, resource, received_at, raw_payload')
        .in('event_id', eligible);

    if (eventsError) throw new Error(`[v2-worker/dlq] load webhook events failed: ${eventsError.message}`);

    // Step 3: exclude any that already have a domain_event (defensive dedup)
    const candidateIds = (events ?? []).map((e: any) => e.event_id as string);
    if (candidateIds.length === 0) return [];

    const { data: existing, error: existingError } = await supabaseAdmin
        .from('v2_domain_events')
        .select('source_event_id')
        .in('source_event_id', candidateIds);

    if (existingError) throw new Error(`[v2-worker/dlq] check domain events failed: ${existingError.message}`);

    const done = new Set(
        ((existing ?? []) as Array<{ source_event_id: string | null }>)
            .map((r) => r.source_event_id)
            .filter((v): v is string => Boolean(v))
    );

    return ((events ?? []) as WebhookEventInput[]).filter((e) => !done.has(e.event_id));
}

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
        retried: 0,
        skipped: 0,
        errors: 0,
    };
}

export async function runV2WebhookToDomainWorker(limit = 50): Promise<WorkerRunResult> {
    return runV2WebhookToDomainWorkerWithDeps(dbDeps, limit);
}

// ── DLQ mode ──────────────────────────────────────────────────────────────────

export async function runV2WebhookToDomainWorkerDlq(limit = 50): Promise<WorkerRunResult> {
    const rows = await loadDlqEventsDirect(limit);
    let inserted = 0;
    let deduped = 0;
    let retried = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
        const mapped = mapTopic(row.topic);
        retried += 1;
        try {
            const created = await dbDeps.insertDomainEvent({
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
            else {
                deduped += 1;
                skipped += 1; // already existed — not really an error
            }

            await logIngestAttempt({
                event_id: row.event_id,
                store_id: row.store_id,
                worker: 'v2-webhook-to-domain-dlq',
                status: created ? 'ok' : 'skipped',
            });
        } catch (error: any) {
            errors += 1;
            await logIngestAttempt({
                event_id: row.event_id,
                store_id: row.store_id,
                worker: 'v2-webhook-to-domain-dlq',
                status: 'error',
                error_message: error.message,
                error_detail: { stack: error.stack },
            });
            // continue — DLQ must never abort the whole batch on one failure
        }
    }

    return {
        scanned: rows.length,
        inserted,
        deduped,
        retried,
        skipped,
        errors,
    };
}
