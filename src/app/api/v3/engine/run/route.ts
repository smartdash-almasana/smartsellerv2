import { ensureV3EngineRun } from '@/v3/engine/run-writer';
import { materializeV3MetricsDaily } from '@/v3/engine/metrics-writer';
import { materializeV3ClinicalSignals } from '@/v3/engine/signals-writer';
import { materializeV3HealthScore } from '@/v3/engine/health-score-writer';
import { ensureV3Snapshot } from '@/v3/engine/snapshot-writer';

interface V3EngineRunRequestBody {
    tenant_id?: string;
    store_id?: string;
    metric_date?: string;
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as V3EngineRunRequestBody;
        const tenant_id = (body.tenant_id ?? '').trim();
        const store_id = (body.store_id ?? '').trim();
        const metric_date = body.metric_date?.trim();

        if (!tenant_id) return Response.json({ ok: false, error: 'Missing tenant_id' }, { status: 400 });
        if (!store_id) return Response.json({ ok: false, error: 'Missing store_id' }, { status: 400 });

        const runResult = await ensureV3EngineRun({
            tenant_id,
            store_id,
            metric_date,
        });

        const snapshotResult = await ensureV3Snapshot({
            tenant_id,
            store_id,
            run_id: runResult.run_id,
            payload: {
                source: 'v3_engine_run_skeleton',
                metric_date: runResult.metric_date,
                clinical_inputs: {
                    source_webhook_events_1d: 0,
                    source_domain_events_1d: 0,
                },
                seeded_at: new Date().toISOString(),
            },
        });

        const metricsResult = await materializeV3MetricsDaily({
            tenant_id,
            store_id,
            run_id: runResult.run_id,
            metric_date: runResult.metric_date,
        });

        const signalsResult = await materializeV3ClinicalSignals({
            tenant_id,
            store_id,
            run_id: runResult.run_id,
            metric_date: runResult.metric_date,
        });

        const healthScoreResult = await materializeV3HealthScore({
            tenant_id,
            store_id,
            run_id: runResult.run_id,
        });

        return Response.json(
            {
                ok: true,
                run_id: runResult.run_id,
                run_created: runResult.created,
                snapshot_id: snapshotResult.snapshot_id,
                snapshot_created: snapshotResult.created,
                metric_date: runResult.metric_date,
                metrics_created: metricsResult.created,
                metrics: metricsResult.metrics,
                signals_created: signalsResult.created_count,
                signals: signalsResult.signals,
                health_score_id: healthScoreResult.score_id,
                health_score_created: healthScoreResult.created,
                health_score: healthScoreResult.score,
                health_score_payload: healthScoreResult.score_payload,
            },
            { status: 200 }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json({ ok: false, error: message }, { status: 500 });
    }
}
