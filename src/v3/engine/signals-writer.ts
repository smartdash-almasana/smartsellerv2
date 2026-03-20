import { supabaseAdmin } from '@v2/lib/supabase';

export interface MaterializeV3SignalsInput {
    tenant_id: string;
    store_id: string;
    run_id: string;
    metric_date: string;
}

export interface V3SignalWriteResult {
    signal_key: string;
    severity: 'none' | 'info' | 'warning' | 'critical';
    created: boolean;
}

export interface MaterializeV3SignalsResult {
    snapshot_id: string;
    created_count: number;
    signals: V3SignalWriteResult[];
}

function asObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function asNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function minusDays(metricDate: string, days: number): string {
    const startIso = `${metricDate}T00:00:00.000Z`;
    const startMs = Date.parse(startIso);
    if (!Number.isFinite(startMs)) {
        throw new Error(`[v3-signals-writer] invalid metric_date: ${metricDate}`);
    }
    const shifted = new Date(startMs - days * 24 * 60 * 60 * 1000);
    return shifted.toISOString().slice(0, 10);
}

export async function materializeV3ClinicalSignals(input: MaterializeV3SignalsInput): Promise<MaterializeV3SignalsResult> {
    const { tenant_id, store_id, run_id, metric_date } = input;
    const windowStartDate = minusDays(metric_date, 6);

    const { data: metricsRow, error: metricsErr } = await supabaseAdmin
        .from('v3_metrics_daily')
        .select('snapshot_id, metrics')
        .eq('tenant_id', tenant_id)
        .eq('store_id', store_id)
        .eq('metric_date', metric_date)
        .limit(1)
        .maybeSingle<{ snapshot_id: string; metrics: Record<string, unknown> | null }>();
    if (metricsErr) throw new Error(`[v3-signals-writer] metrics lookup failed: ${metricsErr.message}`);
    if (!metricsRow?.snapshot_id) throw new Error('[v3-signals-writer] metrics row not found for metric_date');

    const metrics = asObject(metricsRow.metrics);
    const webhookCount = asNumber(metrics['source_webhook_events_1d']);
    const domainCount = asNumber(metrics['source_domain_events_1d']);
    const gap = Math.max(0, webhookCount - domainCount);

    const { data: recentRows, error: recentErr } = await supabaseAdmin
        .from('v3_metrics_daily')
        .select('metrics')
        .eq('tenant_id', tenant_id)
        .eq('store_id', store_id)
        .gte('metric_date', windowStartDate)
        .lte('metric_date', metric_date);
    if (recentErr) throw new Error(`[v3-signals-writer] rolling 7d metrics lookup failed: ${recentErr.message}`);

    let ordersCreated7d = 0;
    for (const row of recentRows ?? []) {
        const rowMetrics = asObject((row as { metrics?: Record<string, unknown> | null }).metrics);
        ordersCreated7d += asNumber(rowMetrics['orders_created_1d']);
    }

    const candidates: Array<{
        signal_key: string;
        severity: 'none' | 'info' | 'warning' | 'critical';
        evidence: Record<string, unknown>;
    }> = [
            {
                signal_key: 'source_webhook_events_1d_zero',
                severity: webhookCount === 0 ? 'warning' : 'none',
                evidence: {
                    metric_date,
                    source_webhook_events_1d: webhookCount,
                },
            },
            {
                signal_key: 'source_domain_events_lag_1d',
                severity: gap <= 0 ? 'none' : (gap >= 5 ? 'critical' : 'warning'),
                evidence: {
                    metric_date,
                    source_webhook_events_1d: webhookCount,
                    source_domain_events_1d: domainCount,
                    lag_count_1d: gap,
                },
            },
            {
                signal_key: 'no_orders_7d',
                severity: ordersCreated7d === 0 ? 'critical' : 'none',
                evidence: {
                    metric_date,
                    window_days: 7,
                    window_start_date: windowStartDate,
                    orders_created_7d: ordersCreated7d,
                },
            },
        ];

    const signalKeys = candidates
        .filter((c) => c.severity !== 'none')
        .map((c) => c.signal_key);

    const existingKeys = new Set<string>();
    if (signalKeys.length > 0) {
        const { data: existingRows, error: existingErr } = await supabaseAdmin
            .from('v3_clinical_signals')
            .select('signal_key')
            .eq('tenant_id', tenant_id)
            .eq('store_id', store_id)
            .eq('run_id', run_id)
            .in('signal_key', signalKeys);
        if (existingErr) throw new Error(`[v3-signals-writer] existing signals lookup failed: ${existingErr.message}`);
        for (const row of existingRows ?? []) {
            const key = (row as { signal_key?: string }).signal_key;
            if (key) existingKeys.add(key);
        }
    }

    const results: V3SignalWriteResult[] = [];

    for (const candidate of candidates) {
        if (candidate.severity === 'none') {
            results.push({
                signal_key: candidate.signal_key,
                severity: 'none',
                created: false,
            });
            continue;
        }

        const { error: upsertErr } = await supabaseAdmin
            .from('v3_clinical_signals')
            .upsert(
                {
                    tenant_id,
                    store_id,
                    run_id,
                    snapshot_id: metricsRow.snapshot_id,
                    signal_key: candidate.signal_key,
                    severity: candidate.severity,
                    evidence: candidate.evidence,
                },
                { onConflict: 'tenant_id,store_id,run_id,signal_key' }
            );
        if (upsertErr) throw new Error(`[v3-signals-writer] signal upsert failed (${candidate.signal_key}): ${upsertErr.message}`);

        results.push({
            signal_key: candidate.signal_key,
            severity: candidate.severity,
            created: !existingKeys.has(candidate.signal_key),
        });
    }

    return {
        snapshot_id: metricsRow.snapshot_id,
        created_count: results.filter((r) => r.created).length,
        signals: results,
    };
}
