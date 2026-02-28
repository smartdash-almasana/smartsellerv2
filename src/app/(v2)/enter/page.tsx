type EnterPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

function sanitizeNext(raw: string | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

export default async function EnterPage({ searchParams }: EnterPageProps) {
  const params = (await searchParams) ?? {};
  const nextPath = sanitizeNext(params.next);
  const oauthHref = nextPath
    ? `/api/auth/meli/start?next=${encodeURIComponent(nextPath)}`
    : "/api/auth/meli/start";

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Ingresar</h1>
      <p className="mt-2 text-sm text-slate-600">
        Conecta tu cuenta de Mercado Libre para ver la historia clinica.
      </p>
      <a
        href={oauthHref}
        className="mt-6 inline-flex rounded-md bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-[#2968c8]"
      >
        Conectar con Mercado Libre
      </a>
    </main>
  );
}
