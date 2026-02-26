import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import SyncButton from "./SyncButton";
import PolicyPanel from "./PolicyPanel";

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
  let initialScore: { score: number; computed_at: string } | null = null;
  try {
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
      ) : (
        <div style={{ marginTop: 16, color: "#64748b", fontSize: 13 }}>
          Sin score calculado aún. Sincronizá para generarlo.
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
