import { supabaseAdmin } from '@v2/lib/supabase';

export interface MaterializeV3MetricsInput {
    tenant_id: string;
    store_id: string;
    run_id: string;
    metric_date: string;
}

export interface MaterializeV3MetricsResult {
    tenant_id: string;
    store_id: string;
    metric_date: string;
    run_id: string;
    snapshot_id: string;
    created: boolean;
    metrics: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function deriveMetricsFromSnapshotPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const clinicalInputs = asObject(payload['clinical_inputs']);
    if (Object.keys(clinicalInputs).length > 0) return clinicalInputs;

    const explicitMetrics = asObject(payload['metrics']);
    if (Object.keys(explicitMetrics).length > 0) return explicitMetrics;

    return {};
}

export async function materializeV3MetricsDaily(input: MaterializeV3MetricsInput): Promise<MaterializeV3MetricsResult> {
    const { tenant_id, store_id, run_id, metric_date } = input;

    const { data: snapshot, error: snapshotErr } = await supabaseAdmin
        .from('v3_snapshots')
        .select('snapshot_id, payload')
        .eq('tenant_id', tenant_id)
        .eq('store_id', store_id)
        .eq('run_id', run_id)
        .limit(1)
        .maybeSingle<{ snapshot_id: string; payload: Record<string, unknown> | null }>();
    if (snapshotErr) throw new Error(`[v3-metrics-writer] snapshot lookup failed: ${snapshotErr.message}`);
    if (!snapshot?.snapshot_id) throw new Error('[v3-metrics-writer] snapshot not found for run');

    const metrics = deriveMetricsFromSnapshotPayload(asObject(snapshot.payload));

    const { data: existing, error: existingErr } = await supabaseAdmin
        .from('v3_metrics_daily')
        .select('tenant_id')
        .eq('tenant_id', tenant_id)
        .eq('store_id', store_id)
        .eq('metric_date', metric_date)
        .limit(1)
        .maybeSingle<{ tenant_id: string }>();
    if (existingErr) throw new Error(`[v3-metrics-writer] existing metrics lookup failed: ${existingErr.message}`);

    const { error: upsertErr } = await supabaseAdmin
        .from('v3_metrics_daily')
        .upsert(
            {
                tenant_id,
                store_id,
                metric_date,
                run_id,
                snapshot_id: snapshot.snapshot_id,
                metrics,
                computed_at: new Date().toISOString(),
            },
            { onConflict: 'tenant_id,store_id,metric_date' }
        );
    if (upsertErr) throw new Error(`[v3-metrics-writer] metrics upsert failed: ${upsertErr.message}`);

    return {
        tenant_id,
        store_id,
        metric_date,
        run_id,
        snapshot_id: snapshot.snapshot_id,
        created: !existing,
        metrics,
    };
}
