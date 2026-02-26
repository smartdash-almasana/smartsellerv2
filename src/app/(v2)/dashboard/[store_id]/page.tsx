import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

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
  const allowed = stores.some((s: any) => s?.store_id === store_id);

  if (!allowed) {
    redirect("/choose-store");
  }

  if (!store_id) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-slate-600">Store: {store_id}</p>
    </main>
  );
}
