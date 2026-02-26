// ============================================================================
// SmartSeller V2 — Score API
// GET /api/score/[store_id]
// Responsibility: read the latest v2_health_scores for a store. Nothing else.
// No engine execution. No external API calls. No writes.
// ============================================================================

import { supabaseAdmin } from '@v2/lib/supabase';

export interface ScoreResponse {
    store_id: string;
    score: number;
    computed_at: string;
    run_id: string;
    snapshot_id: string;
}

/**
 * Fetches the latest health score for a given store_id.
 * Returns the score row or null if no score exists yet.
 * Throws on DB errors (caller decides HTTP status).
 */
export async function getLatestScore(storeId: string): Promise<ScoreResponse | null> {
    const { data, error } = await supabaseAdmin
        .from('v2_health_scores')
        .select('store_id, score, computed_at, run_id')
        .eq('store_id', storeId)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle<Omit<ScoreResponse, 'snapshot_id'>>();

    if (error) {
        throw new Error(
            `[score-api] Failed to read health score for store ${storeId}: ${error.message} (code: ${error.code})`
        );
    }

    if (!data) {
        return null;
    }

    const { data: storeRow, error: storeErr } = await supabaseAdmin
        .from('v2_stores')
        .select('tenant_id')
        .eq('store_id', storeId)
        .limit(1)
        .maybeSingle<{ tenant_id: string }>();

    if (storeErr) {
        throw new Error(
            `[score-api] Failed to read tenant for store ${storeId}: ${storeErr.message} (code: ${storeErr.code})`
        );
    }
    if (!storeRow?.tenant_id) {
        throw new Error(`[score-api] Missing tenant for store ${storeId}`);
    }

    const { data: snapshotRow, error: snapshotErr } = await supabaseAdmin
        .from('v2_snapshots')
        .insert({
            tenant_id: storeRow.tenant_id,
            store_id: data.store_id,
            snapshot_at: new Date().toISOString(),
            payload: {
                source: 'api/score',
                score: data.score,
                computed_at: data.computed_at,
                run_id: data.run_id,
            },
            run_id: data.run_id,
        })
        .select('snapshot_id')
        .single<{ snapshot_id: string }>();

    if (snapshotErr) {
        throw new Error(
            `[score-api] Failed to create snapshot for store ${storeId}: ${snapshotErr.message} (code: ${snapshotErr.code})`
        );
    }

    const snapshotId = snapshotRow.snapshot_id;

    const { data: upsertedScore, error: scoreUpsertErr } = await supabaseAdmin
        .from('v2_health_scores')
        .upsert(
            {
                tenant_id: storeRow.tenant_id,
                store_id: data.store_id,
                run_id: data.run_id,
                snapshot_id: snapshotId,
                computed_at: data.computed_at,
                score: data.score,
            },
            { onConflict: 'store_id,run_id' }
        )
        .select('store_id, score, computed_at, run_id')
        .single<Omit<ScoreResponse, 'snapshot_id'>>();

    if (scoreUpsertErr) {
        throw new Error(
            `[score-api] Failed to upsert health score for store ${storeId}: ${scoreUpsertErr.message} (code: ${scoreUpsertErr.code})`
        );
    }

    const { error: signalsUpdateErr } = await supabaseAdmin
        .from('v2_clinical_signals')
        .update({
            snapshot_id: snapshotId,
            run_id: data.run_id,
        })
        .eq('store_id', data.store_id)
        .eq('run_id', data.run_id);

    if (signalsUpdateErr) {
        throw new Error(
            `[score-api] Failed to link clinical signals for store ${storeId}: ${signalsUpdateErr.message} (code: ${signalsUpdateErr.code})`
        );
    }

    return {
        ...upsertedScore,
        snapshot_id: snapshotId,
    };
}

// ─── Next.js Route Handler ────────────────────────────────────────────────────
// Wire this into app/api/score/[store_id]/route.ts as:
//
//   import { getLatestScore } from '../../../../src/api/score';
//   export async function GET(_req: Request, { params }: { params: { store_id: string } }) {
//     const result = await getLatestScore(params.store_id);
//     if (!result) return Response.json({ error: 'No score yet' }, { status: 404 });
//     return Response.json(result, { status: 200 });
//   }
