'use client';

import { useState } from 'react';

interface SyncResult {
    store_id: string;
    fetched_orders: number;
    inserted_webhooks: number;
    deduped_webhooks: number;
    domain_events_by_type: Record<string, number>;
}

interface ScoreResult {
    store_id: string;
    score: number;
    computed_at: string;
    run_id: string;
    snapshot_id: string;
}

interface SyncButtonProps {
    storeId: string;
}

export default function SyncButton({ storeId }: SyncButtonProps) {
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
    const [score, setScore] = useState<ScoreResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleSync() {
        setSyncing(true);
        setError(null);
        setSyncResult(null);
        setScore(null);

        try {
            // Step 1: Sync
            const syncRes = await fetch(`/api/meli/sync/${storeId}`, {
                method: 'POST',
                cache: 'no-store',
            });
            const syncData = await syncRes.json();

            if (!syncRes.ok) {
                setError(syncData?.error ?? `Sync failed (${syncRes.status})`);
                return;
            }
            setSyncResult(syncData);

            // Step 2: Refresh score (force via ?force=true handled gracefully)
            const scoreRes = await fetch(`/api/score/${storeId}?t=${Date.now()}`, {
                cache: 'no-store',
            });
            if (scoreRes.ok) {
                const scoreData = await scoreRes.json();
                setScore(scoreData);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setSyncing(false);
        }
    }

    return (
        <div style={{ marginTop: 24 }}>
            <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                    padding: '10px 20px',
                    background: syncing ? '#94a3b8' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                }}
            >
                {syncing ? 'Sincronizando…' : '⟳ Sincronizar ahora'}
            </button>

            {error && (
                <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', borderRadius: 8, color: '#b91c1c', fontSize: 13 }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {syncResult && (
                <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8, fontSize: 13 }}>
                    <strong>✓ Sincronización completada</strong>
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                        <li>Órdenes ML fetched: <strong>{syncResult.fetched_orders}</strong></li>
                        <li>Webhooks insertados: <strong>{syncResult.inserted_webhooks}</strong></li>
                        <li>Webhooks deduplicados: <strong>{syncResult.deduped_webhooks}</strong></li>
                        {Object.entries(syncResult.domain_events_by_type).map(([k, v]) => (
                            <li key={k}>{k}: <strong>{v}</strong></li>
                        ))}
                    </ul>
                </div>
            )}

            {score && (
                <div style={{ marginTop: 12, padding: 12, background: '#eff6ff', borderRadius: 8, fontSize: 13 }}>
                    <strong>Score actualizado</strong>
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                        <li>Score: <strong>{score.score}</strong> / 100</li>
                        <li>Computed at: <strong>{new Date(score.computed_at).toLocaleString()}</strong></li>
                        <li style={{ fontSize: 11, color: '#64748b' }}>run_id: {score.run_id}</li>
                        <li style={{ fontSize: 11, color: '#64748b' }}>snapshot_id: {score.snapshot_id}</li>
                    </ul>
                    {score.score <= 55 && (
                        <p style={{ marginTop: 8, color: '#92400e', fontSize: 12 }}>
                            ⚠ Score reciente ya existía (&lt;1h); si no cambió, espere 1h o use fuerza manual.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
