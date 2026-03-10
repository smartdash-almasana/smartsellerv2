import { supabaseAdmin } from '@v2/lib/supabase';

export interface MaterializeV3HealthScoreInput {
    tenant_id: string;
    store_id: string;
    run_id: string;
}

export interface MaterializeV3HealthScoreResult {
    score_id: string;
    snapshot_id: string;
    score: number;
    created: boolean;
    score_payload: Record<string, unknown>;
}

type SignalSeverity = 'none' | 'info' | 'warning' | 'critical';

interface SeverityCountMap {
    none: number;
    info: number;
    warning: number;
    critical: number;
}

function clampScore(value: number): number {
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
}

function toSeverity(value: unknown): SignalSeverity {
    if (value === 'critical' || value === 'warning' || value === 'info' || value === 'none') return value;
    return 'none';
}

function buildScoreFromSeverities(severities: SignalSeverity[]): { score: number; counts: SeverityCountMap; total_penalty: number } {
    const counts: SeverityCountMap = { none: 0, info: 0, warning: 0, critical: 0 };
    for (const severity of severities) counts[severity] += 1;

    const total_penalty = counts.info * 5 + counts.warning * 20 + counts.critical * 40;
    const score = clampScore(100 - total_penalty);
    return { score, counts, total_penalty };
}

export async function materializeV3HealthScore(input: MaterializeV3HealthScoreInput): Promise<MaterializeV3HealthScoreResult> {
    const { tenant_id, store_id, run_id } = input;

    const { data: runRow, error: runErr } = await supabaseAdmin
        .from('v3_engine_runs')
        .select('run_id')
        .eq('tenant_id', tenant_id)
        .eq('store_id', store_id)
        .eq('run_id', run_id)
        .limit(1)
        .maybeSingle<{ run_id: string }>();
    if (runErr) throw new Error(`[v3-health-score-writer] run lookup failed: ${runErr.message}`);
    if (!runRow?.run_id) throw new Error('[v3-health-score-writer] run not found');

    const { data: snapshotRow, error: snapshotErr } = await supabaseAdmin
        .from('v3_snapshots')
        .select('snapshot_id')
        .eq('tenant_id', tenant_id)
        .eq('store_id', store_id)
        .eq('run_id', run_id)
        .limit(1)
        .maybeSingle<{ snapshot_id: string }>();
    if (snapshotErr) throw new Error(`[v3-health-score-writer] snapshot lookup failed: ${snapshotErr.message}`);
    if (!snapshotRow?.snapshot_id) throw new Error('[v3-health-score-writer] snapshot not found for run');

    const { data: signalRows, error: signalsErr } = await supabaseAdmin
        .from('v3_clinical_signals')
        .select('signal_key, severity')
        .eq('tenant_id', tenant_id)
        .eq('store_id', store_id)
        .eq('run_id', run_id);
    if (signalsErr) throw new Error(`[v3-health-score-writer] signals lookup failed: ${signalsErr.message}`);

    const signalSeverities = (signalRows ?? []).map((row) => toSeverity((row as { severity?: unknown }).severity));
    const signalKeys = (signalRows ?? [])
        .map((row) => (row as { signal_key?: string }).signal_key)
        .filter((value): value is string => Boolean(value));

    const scoreBuilt = buildScoreFromSeverities(signalSeverities);
    const score_payload: Record<string, unknown> = {
        score_version: 'v3_health_score_v1',
        run_id,
        total_signals: signalSeverities.length,
        severity_counts: scoreBuilt.counts,
        penalty: scoreBuilt.total_penalty,
        signal_keys: signalKeys,
    };

    const { data: existing, error: existingErr } = await supabaseAdmin
        .from('v3_health_scores')
        .select('score_id')
        .eq('tenant_id', tenant_id)
        .eq('store_id', store_id)
        .eq('run_id', run_id)
        .limit(1)
        .maybeSingle<{ score_id: string }>();
    if (existingErr) throw new Error(`[v3-health-score-writer] existing score lookup failed: ${existingErr.message}`);

    const { error: upsertErr } = await supabaseAdmin
        .from('v3_health_scores')
        .upsert(
            {
                tenant_id,
                store_id,
                run_id,
                snapshot_id: snapshotRow.snapshot_id,
                score: scoreBuilt.score,
                score_payload,
                computed_at: new Date().toISOString(),
            },
            { onConflict: 'tenant_id,store_id,run_id' }
        );
    if (upsertErr) throw new Error(`[v3-health-score-writer] score upsert failed: ${upsertErr.message}`);

    const { data: row, error: rowErr } = await supabaseAdmin
        .from('v3_health_scores')
        .select('score_id, score, snapshot_id, score_payload')
        .eq('tenant_id', tenant_id)
        .eq('store_id', store_id)
        .eq('run_id', run_id)
        .limit(1)
        .single<{
            score_id: string;
            score: number;
            snapshot_id: string;
            score_payload: Record<string, unknown>;
        }>();
    if (rowErr || !row?.score_id) throw new Error(`[v3-health-score-writer] score re-read failed: ${rowErr?.message ?? 'missing row'}`);

    return {
        score_id: row.score_id,
        snapshot_id: row.snapshot_id,
        score: row.score,
        score_payload: row.score_payload ?? {},
        created: !existing?.score_id,
    };
}
