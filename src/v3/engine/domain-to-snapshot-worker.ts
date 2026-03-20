import { supabaseAdmin } from '@v2/lib/supabase';
import { ensureV3EngineRun } from '@/v3/engine/run-writer';
import { ensureV3Snapshot } from '@/v3/engine/snapshot-writer';

interface ClaimedSnapshotJobRow {
    job_id: string;
    tenant_id: string;
    store_id: string;
    metric_date: string;
    last_source_normalized_at: string;
}

interface DomainEventAggregateRow {
    event_type: string;
    source_webhook_event_id: string;
    occurred_at: string;
    normalized_at: string;
}

export interface V3DomainToSnapshotWorkerError {
    job_id: string;
    error: string;
}

export interface V3DomainToSnapshotWorkerResult {
    enqueued: number;
    claimed: number;
    processed: number;
    failed: number;
    created_runs: number;
    reused_runs: number;
    created_snapshots: number;
    reused_snapshots: number;
    errors: V3DomainToSnapshotWorkerError[];
}

function clampLimit(limit: number): number {
    if (!Number.isFinite(limit) || limit <= 0) return 50;
    return Math.min(Math.floor(limit), 200);
}

function clampLeaseSeconds(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 300;
    return Math.min(Math.floor(value), 3600);
}

function clampLookbackDays(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 30;
    return Math.min(Math.floor(value), 120);
}

function formatError(error: unknown): string {
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    return String(error);
}

function truncate(text: string, max = 1500): string {
    return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

function isoDayBounds(metricDate: string): { startIso: string; endIso: string } {
    const startIso = `${metricDate}T00:00:00.000Z`;
    const startMs = Date.parse(startIso);
    if (!Number.isFinite(startMs)) {
        throw new Error(`[v3-domain-snapshot-worker] invalid metric_date: ${metricDate}`);
    }
    const endIso = new Date(startMs + 24 * 60 * 60 * 1000).toISOString();
    return { startIso, endIso };
}

function buildClinicalInputs(rows: DomainEventAggregateRow[]): Record<string, unknown> {
    const webhookIds = new Set<string>();
    let ordersCreated1d = 0;
    for (const row of rows) {
        if (row.source_webhook_event_id) webhookIds.add(row.source_webhook_event_id);
        if (row.event_type === 'order.created') ordersCreated1d++;
    }
    return {
        source_domain_events_1d: rows.length,
        source_webhook_events_1d: webhookIds.size,
        orders_created_1d: ordersCreated1d,
    };
}

function buildEventTypeCounts(rows: DomainEventAggregateRow[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const row of rows) {
        const key = row.event_type || 'unknown.event';
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}

async function loadDomainEventAggregate(job: ClaimedSnapshotJobRow): Promise<DomainEventAggregateRow[]> {
    const { startIso, endIso } = isoDayBounds(job.metric_date);
    const { data, error } = await supabaseAdmin
        .from('v3_domain_events')
        .select('event_type,source_webhook_event_id,occurred_at,normalized_at')
        .eq('tenant_id', job.tenant_id)
        .eq('store_id', job.store_id)
        .gte('occurred_at', startIso)
        .lt('occurred_at', endIso)
        .order('occurred_at', { ascending: true });
    if (error) throw new Error(`[v3-domain-snapshot-worker] domain_events read failed: ${error.message}`);
    return (data ?? []) as DomainEventAggregateRow[];
}

export async function runV3DomainToSnapshotWorker(
    limit = 50,
    leaseSeconds = 300,
    lookbackDays = 30
): Promise<V3DomainToSnapshotWorkerResult> {
    const batchSize = clampLimit(limit);
    const lease = clampLeaseSeconds(leaseSeconds);
    const lookback = clampLookbackDays(lookbackDays);

    const { data: enqueuedCountData, error: enqueueErr } = await supabaseAdmin
        .rpc('v3_enqueue_snapshot_jobs' as never, { p_lookback_days: lookback } as never);
    if (enqueueErr) throw new Error(`[v3-domain-snapshot-worker] enqueue failed: ${enqueueErr.message}`);
    const enqueued = Number(enqueuedCountData ?? 0);

    const { data: claimedRows, error: claimErr } = await supabaseAdmin
        .rpc('v3_claim_snapshot_jobs' as never, { p_limit: batchSize, p_lease_seconds: lease } as never);
    if (claimErr) throw new Error(`[v3-domain-snapshot-worker] claim failed: ${claimErr.message}`);
    const jobs = (claimedRows ?? []) as ClaimedSnapshotJobRow[];

    let processed = 0;
    let failed = 0;
    let created_runs = 0;
    let reused_runs = 0;
    let created_snapshots = 0;
    let reused_snapshots = 0;
    const errors: V3DomainToSnapshotWorkerError[] = [];

    for (const job of jobs) {
        try {
            const rows = await loadDomainEventAggregate(job);
            const clinicalInputs = buildClinicalInputs(rows);
            const eventTypeCounts = buildEventTypeCounts(rows);
            const firstOccurredAt = rows[0]?.occurred_at ?? null;
            const lastOccurredAt = rows[rows.length - 1]?.occurred_at ?? null;
            const lastNormalizedAt = rows.length > 0
                ? rows.reduce((max, row) => (row.normalized_at > max ? row.normalized_at : max), rows[0].normalized_at)
                : job.last_source_normalized_at;

            const run = await ensureV3EngineRun({
                tenant_id: job.tenant_id,
                store_id: job.store_id,
                metric_date: job.metric_date,
                orchestrator_key: 'v3_snapshot_from_domain_v1',
            });
            if (run.created) created_runs++;
            else reused_runs++;

            const snapshot = await ensureV3Snapshot({
                tenant_id: job.tenant_id,
                store_id: job.store_id,
                run_id: run.run_id,
                payload: {
                    source: 'v3_snapshot_from_domain_v1',
                    metric_date: job.metric_date,
                    clinical_inputs: clinicalInputs,
                    source_window: {
                        domain_event_count: rows.length,
                        first_occurred_at: firstOccurredAt,
                        last_occurred_at: lastOccurredAt,
                        last_normalized_at: lastNormalizedAt,
                        event_type_counts: eventTypeCounts,
                    },
                    refreshed_at: new Date().toISOString(),
                },
            });
            if (snapshot.created) created_snapshots++;
            else reused_snapshots++;

            const { error: doneErr } = await supabaseAdmin
                .from('v3_snapshot_jobs')
                .update({
                    processing_status: 'processed',
                    claimed_at: null,
                    processed_at: new Date().toISOString(),
                    processing_error: null,
                    run_id: run.run_id,
                    snapshot_id: snapshot.snapshot_id,
                })
                .eq('job_id', job.job_id);
            if (doneErr) throw new Error(`[v3-domain-snapshot-worker] job complete update failed: ${doneErr.message}`);

            processed++;
        } catch (error) {
            failed++;
            const message = formatError(error);
            errors.push({ job_id: job.job_id, error: message });

            const { error: markErr } = await supabaseAdmin
                .from('v3_snapshot_jobs')
                .update({
                    processing_status: 'error',
                    claimed_at: null,
                    processing_error: truncate(message),
                })
                .eq('job_id', job.job_id);
            if (markErr) {
                console.error(`[v3-domain-snapshot-worker] failed to mark error for job_id=${job.job_id}: ${markErr.message}`);
            }
        }
    }

    return {
        enqueued,
        claimed: jobs.length,
        processed,
        failed,
        created_runs,
        reused_runs,
        created_snapshots,
        reused_snapshots,
        errors,
    };
}
