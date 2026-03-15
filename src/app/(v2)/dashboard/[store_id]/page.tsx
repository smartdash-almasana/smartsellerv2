import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import SyncButton from "./SyncButton";
import PolicyPanel from "./PolicyPanel";
import { DashboardBootstrapStatus, getNoScoreBootstrapMessage } from "./bootstrap-message";

type DashboardSignal = {
  signal_key: string;
  severity: "info" | "warning" | "critical";
  evidence: Record<string, unknown>;
};

function severityLabel(severity: DashboardSignal["severity"]): string {
  if (severity === "critical") return "Crítica";
  if (severity === "warning") return "Advertencia";
  return "Informativa";
}

function actionTextForSignal(signalKey: string): string {
  if (signalKey === "no_orders_7d") return "Activar campaña comercial y revisar publicaciones pausadas hoy.";
  if (signalKey === "cancellation_spike") return "Auditar causas de cancelación y ajustar stock/tiempos de despacho.";
  if (signalKey === "unanswered_messages_spike") return "Responder bandeja prioritaria y configurar cobertura de atención.";
  if (signalKey === "claims_opened") return "Revisar reclamos abiertos y cerrar cada caso con plan de resolución.";
  if (signalKey === "low_activity_14d") return "Incrementar actividad con nuevas publicaciones y seguimiento de mensajes.";
  return "Revisar la señal y ejecutar un plan correctivo hoy.";
}

function briefEvidence(evidence: Record<string, unknown>): string {
  const entries = Object.entries(evidence).slice(0, 2);
  if (entries.length === 0) return "Sin evidencia adicional";
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" | ");
}

export default async function StoreDashboardPage({
  params,
}: {
  params: Promise<{ store_id: string }>;
}) {
  const hdrs = await headers();
  const host = hdrs.get("host");
  const proto = process.env.VERCEL ? "https" : "http";
  const baseUrl = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const meRes = await fetch(`${baseUrl}/api/me`, {
    method: "GET",
    cache: "no-store",
    headers: { cookie: hdrs.get("cookie") ?? "" },
  });

  if (meRes.status !== 200) {
    redirect("/enter");
  }

  const { store_id } = await params;
  const me = await meRes.json();
  const stores = Array.isArray(me?.stores) ? me.stores : [];
  const allowed = stores.some((s: { store_id: string }) => s?.store_id === store_id);

  if (!allowed) {
    redirect("/choose-store");
  }

  if (!store_id) {
    notFound();
  }

  // Fetch current score (server-side, best-effort)
  let initialScore: { score: number; computed_at: string; active_signals?: DashboardSignal[] } | null = null;
  let bootstrapStatus: DashboardBootstrapStatus = null;
  try {
    const bootstrapRes = await fetch(`${baseUrl}/api/bootstrap/${store_id}`, {
      cache: "no-store",
      headers: { cookie: hdrs.get("cookie") ?? "" },
    });
    if (bootstrapRes.ok) {
      const bootstrap = await bootstrapRes.json();
      bootstrapStatus = bootstrap?.bootstrap_status ?? null;
    }

    const scoreRes = await fetch(`${baseUrl}/api/score/${store_id}`, {
      cache: "no-store",
      headers: { cookie: hdrs.get("cookie") ?? "" },
    });
    if (scoreRes.ok) {
      initialScore = await scoreRes.json();
    }
  } catch {
    // score is optional; fail silently
  }

  const storeInfo = stores.find(
    (s: { store_id: string; display_name?: string }) => s.store_id === store_id
  );
  const displayName = storeInfo?.display_name ?? store_id;

  return (
    <main className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-slate-600">{displayName}</p>

      {/* Score */}
      {initialScore !== null ? (
        <>
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "#f8fafc",
              borderRadius: 8,
              fontSize: 14,
              border: "1px solid #e2e8f0",
            }}
          >
            <strong>Score V0:</strong> {initialScore.score} / 100
            <span style={{ marginLeft: 12, color: "#64748b", fontSize: 12 }}>
              (calculado {new Date(initialScore.computed_at).toLocaleString()})
            </span>
          </div>

          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: "#fffbeb",
              borderRadius: 8,
              fontSize: 13,
              border: "1px solid #fde68a",
            }}
          >
            <strong>Estado clínico</strong>
            {(initialScore.active_signals ?? []).length === 0 ? (
              <p style={{ marginTop: 8, color: "#334155" }}>No hay alertas clínicas activas.</p>
            ) : (
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                {(initialScore.active_signals ?? []).map((signal) => (
                  <li key={signal.signal_key} style={{ marginBottom: 6 }}>
                    <strong>{signal.signal_key}</strong> [{severityLabel(signal.severity)}]
                    <div style={{ color: "#475569", fontSize: 12 }}>
                      Evidencia: {briefEvidence(signal.evidence)}
                    </div>
                    <div style={{ color: "#92400e", fontSize: 12 }}>
                      Acción: {actionTextForSignal(signal.signal_key)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div style={{ marginTop: 16, color: "#64748b", fontSize: 13 }}>
          {getNoScoreBootstrapMessage(bootstrapStatus)}
        </div>
      )}

      {/* Sync */}
      <SyncButton storeId={store_id} />

      {/* Divider */}
      <hr style={{ margin: "32px 0", borderColor: "#e2e8f0" }} />

      {/* Policy panel (client component) */}
      <PolicyPanel storeId={store_id} />
    </main>
  );
}
