import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ChevronRight, ShieldAlert, TrendingUp } from "lucide-react";
import { supabaseAdmin } from "@v2/lib/supabase";
import { getLatestScore, type ScoreResponse } from "@v2/api/score";
import SyncButton from "./SyncButton";
import { getNoScoreBootstrapMessage, type DashboardBootstrapStatus } from "./bootstrap-message";

type StoreSlim = {
    store_id: string;
    display_name: string | null;
    provider_key: string;
};

type DashboardSignal = ScoreResponse["active_signals"][number];

type ScoreHistoryRow = {
    score: number;
    computed_at: string;
};

type MetricsRow = {
    metric_date: string;
    metrics: Record<string, unknown> | null;
};

type BootstrapRow = {
    bootstrap_status: DashboardBootstrapStatus;
    bootstrap_requested_at: string | null;
    bootstrap_started_at: string | null;
    bootstrap_completed_at: string | null;
};

function bandFromScore(score: number): string {
    if (score >= 85) return "Saludable";
    if (score >= 60) return "En observacion";
    return "Atencion prioritaria";
}

function signalLabel(signalKey: string): string {
    if (signalKey === "no_orders_7d") return "Ritmo comercial en pausa";
    if (signalKey === "cancellation_spike") return "Suba de cancelaciones";
    if (signalKey === "unanswered_messages_spike") return "Mensajes sin respuesta";
    if (signalKey === "claims_opened") return "Reclamos activos";
    if (signalKey === "low_activity_14d") return "Actividad por debajo de lo esperado";
    return "Alerta clinica activa";
}

function signalAction(signalKey: string): string {
    if (signalKey === "no_orders_7d") return "Revisar publicaciones activas y demanda de los ultimos dias.";
    if (signalKey === "cancellation_spike") return "Revisar cancelaciones recientes y validar stock o promesa de entrega.";
    if (signalKey === "unanswered_messages_spike") return "Priorizar respuesta de bandeja para evitar demora con compradores.";
    if (signalKey === "claims_opened") return "Revisar reclamos abiertos y avanzar con resolucion hoy.";
    if (signalKey === "low_activity_14d") return "Revisar visibilidad comercial antes de tomar una nueva accion.";
    return "Revisar esta alerta con el equipo operativo.";
}

function severityLabel(severity: DashboardSignal["severity"]): string {
    if (severity === "critical") return "Alta severidad";
    if (severity === "warning") return "Media severidad";
    return "Baja severidad";
}

function severityTone(severity: DashboardSignal["severity"]): string {
    if (severity === "critical") return "border-red-200 bg-red-50 text-red-700";
    if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-teal-200 bg-teal-50 text-teal-700";
}

function evidenceLabel(key: string): string {
    if (key === "orders_created_7d") return "Ordenes creadas en 7 dias";
    if (key === "orders_cancelled_1d") return "Cancelaciones hoy";
    if (key === "orders_created_1d") return "Ordenes creadas hoy";
    if (key === "ratio") return "Ratio observado";
    if (key === "messages_received_1d") return "Mensajes recibidos hoy";
    if (key === "messages_answered_1d") return "Mensajes respondidos hoy";
    if (key === "claims_opened_14d") return "Reclamos abiertos en 14 dias";
    if (key === "orders_created_14d") return "Ordenes creadas en 14 dias";
    if (key === "messages_received_14d") return "Mensajes recibidos en 14 dias";
    if (key === "total_activity") return "Actividad total en 14 dias";
    return key.replace(/_/g, " ");
}

function evidenceItems(evidence: Record<string, unknown>): Array<{ label: string; value: string }> {
    return Object.entries(evidence)
        .slice(0, 3)
        .map(([key, value]) => ({
            label: evidenceLabel(key),
            value: String(value),
        }));
}

function parseMetricValue(metrics: Record<string, unknown> | null, key: string): number | null {
    const value = metrics?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildVitalMetrics(metricsRow: MetricsRow | null) {
    if (!metricsRow?.metrics) return [];

    const items = [
        {
            label: "Ordenes creadas hoy",
            value: parseMetricValue(metricsRow.metrics, "orders_created_1d"),
        },
        {
            label: "Cancelaciones hoy",
            value: parseMetricValue(metricsRow.metrics, "orders_cancelled_1d"),
        },
        {
            label: "Mensajes recibidos hoy",
            value: parseMetricValue(metricsRow.metrics, "messages_received_1d"),
        },
        {
            label: "Reclamos abiertos hoy",
            value: parseMetricValue(metricsRow.metrics, "claims_opened_1d"),
        },
    ];

    return items.filter((item) => item.value !== null);
}

function sparklinePath(scores: number[]): string {
    if (scores.length === 0) return "";
    const width = 240;
    const height = 96;
    const step = scores.length === 1 ? 0 : width / (scores.length - 1);

    return scores
        .map((score, index) => {
            const x = index * step;
            const y = height - (score / 100) * height;
            return `${index === 0 ? "M" : "L"}${x} ${y}`;
        })
        .join(" ");
}

async function getSessionStores(): Promise<{ userId: string; stores: StoreSlim[] } | null> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: () => { },
            },
        },
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: memberships, error } = await supabase
        .from("v2_store_memberships")
        .select(`
            store_id,
            v2_stores (
                store_id,
                display_name,
                provider_key
            )
        `)
        .eq("user_id", session.user.id);

    if (error) return null;

    const stores: StoreSlim[] = (memberships ?? [])
        .map((membership) => membership.v2_stores as unknown as StoreSlim | null)
        .filter((store): store is StoreSlim => Boolean(store))
        .map((store) => ({
            store_id: store.store_id,
            display_name: store.display_name ?? null,
            provider_key: store.provider_key,
        }));

    return { userId: session.user.id, stores };
}

export default async function DashboardPrincipalPage({
    params,
}: {
    params: Promise<{ store_id: string }>;
}) {
    await headers();

    const sessionData = await getSessionStores();
    if (!sessionData) {
        redirect("/enter");
    }

    const { store_id } = await params;
    if (!store_id) notFound();

    const { stores } = sessionData;
    const allowed = stores.some((store) => store.store_id === store_id);
    if (!allowed) redirect("/choose-store");

    const currentStore = stores.find((store) => store.store_id === store_id) ?? null;

    const [scoreData, scoreHistoryResp, metricsResp, bootstrapResp] = await Promise.all([
        getLatestScore(store_id).catch(() => null),
        supabaseAdmin
            .from("v2_health_scores")
            .select("score,computed_at")
            .eq("store_id", store_id)
            .order("computed_at", { ascending: false })
            .limit(8),
        supabaseAdmin
            .from("v2_metrics_daily")
            .select("metric_date,metrics")
            .eq("store_id", store_id)
            .order("metric_date", { ascending: false })
            .limit(1)
            .maybeSingle<MetricsRow>(),
        supabaseAdmin
            .from("v2_oauth_installations")
            .select("bootstrap_status,bootstrap_requested_at,bootstrap_started_at,bootstrap_completed_at")
            .eq("linked_store_id", store_id)
            .order("linked_at", { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle<BootstrapRow>(),
    ]);

    const scoreHistory = ((scoreHistoryResp.data ?? []) as ScoreHistoryRow[]).reverse();
    const latestMetrics = (metricsResp.data ?? null) as MetricsRow | null;
    const bootstrap = (bootstrapResp.data ?? null) as BootstrapRow | null;

    const activeSignals = scoreData?.active_signals ?? [];
    const vitalMetrics = buildVitalMetrics(latestMetrics);
    const previousScore = scoreHistory.length >= 2 ? scoreHistory[scoreHistory.length - 2]?.score ?? null : null;
    const delta = scoreData && previousScore !== null ? scoreData.score - previousScore : null;
    const sparklineScores = scoreHistory.map((row) => row.score).filter((value) => Number.isFinite(value));
    const bootstrapStatus = bootstrap?.bootstrap_status ?? null;
    const calibrationMessage = getNoScoreBootstrapMessage(bootstrapStatus);

    return (
        <div className="flex flex-col gap-6">
            <section className="overflow-hidden rounded-[28px] bg-[#0f2347] px-6 py-8 text-white shadow-[0_24px_60px_rgba(15,35,71,0.24)] lg:px-10">
                <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
                    <div className="flex items-center gap-5">
                        <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-[#132c58] shadow-[inset_0_0_0_10px_rgba(37,99,235,0.12)]">
                            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 160 160">
                                <circle cx="80" cy="80" r="58" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="12" />
                                {scoreData ? (
                                    <circle
                                        cx="80"
                                        cy="80"
                                        r="58"
                                        fill="none"
                                        stroke="#24c8b5"
                                        strokeWidth="12"
                                        strokeDasharray="364"
                                        strokeDashoffset={364 - (scoreData.score / 100) * 364}
                                        strokeLinecap="round"
                                    />
                                ) : null}
                            </svg>
                            <div className="relative flex flex-col items-center">
                                <span className="text-5xl font-black tracking-tight">{scoreData ? scoreData.score : "--"}</span>
                                <span className="text-sm font-semibold text-slate-300">/100</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <h1 className="text-3xl font-black tracking-tight lg:text-4xl">Salud Clinica General</h1>
                                <p className="mt-1 text-sm text-slate-300">{currentStore?.display_name ?? store_id}</p>
                            </div>

                            {scoreData ? (
                                <>
                                    <p className="text-sm text-slate-200">
                                        Score real calculado {new Date(scoreData.computed_at).toLocaleString()}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-semibold text-slate-100">
                                            Banda: {bandFromScore(scoreData.score)}
                                        </span>
                                        {delta !== null ? (
                                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${delta >= 0 ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>
                                                <TrendingUp className="h-4 w-4" />
                                                Delta real: {delta > 0 ? "+" : ""}{delta}
                                            </span>
                                        ) : null}
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                                    <p className="font-bold">Sistema en calibracion inicial</p>
                                    <p className="mt-1 text-slate-300">{calibrationMessage}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3 border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                        <h2 className="text-2xl font-black tracking-tight">Resumen Ejecutivo</h2>
                        {scoreData ? (
                            <div className="space-y-2 text-sm leading-7 text-slate-200">
                                <p>Score actual: {scoreData.score} puntos.</p>
                                <p>Señales activas registradas: {activeSignals.length}.</p>
                                <p>Ultimo calculo: {new Date(scoreData.computed_at).toLocaleString()}.</p>
                            </div>
                        ) : (
                            <div className="space-y-2 text-sm leading-7 text-slate-200">
                                <p>Sistema en calibracion inicial.</p>
                                <p>{calibrationMessage}</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-6">
                    <section className="space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-3xl font-black tracking-tight text-slate-900">Que hacer ahora</h2>
                                <p className="mt-1 text-sm text-slate-600">Acciones disponibles solo cuando hay señales clinicas reales.</p>
                            </div>
                            <SyncButton storeId={store_id} />
                        </div>

                        {activeSignals.length > 0 ? (
                            <div className="grid gap-4 lg:grid-cols-3">
                                {activeSignals.map((signal) => (
                                    <article key={signal.signal_key} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                                        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${severityTone(signal.severity)}`}>
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            {severityLabel(signal.severity)}
                                        </div>
                                        <h3 className="mt-4 text-xl font-black leading-tight text-slate-900">{signalLabel(signal.signal_key)}</h3>
                                        <p className="mt-3 text-sm leading-6 text-slate-700">{signalAction(signal.signal_key)}</p>
                                        <div className="mt-4 space-y-2 text-sm text-slate-600">
                                            {evidenceItems(signal.evidence).map((item) => (
                                                <p key={`${signal.signal_key}-${item.label}`}>
                                                    <span className="font-semibold text-slate-800">{item.label}:</span> {item.value}
                                                </p>
                                            ))}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm font-medium text-slate-600 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                                {scoreData
                                    ? "Todavia no hay evidencia suficiente para mostrar prioridades clinicas."
                                    : calibrationMessage}
                            </div>
                        )}
                    </section>

                    <section className="space-y-4">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight text-slate-900">Alertas Clinicas Activas</h2>
                            <p className="mt-1 text-sm text-slate-600">Se muestran solo señales reales registradas por el motor actual.</p>
                        </div>

                        {activeSignals.length > 0 ? (
                            <div className="space-y-3">
                                {activeSignals.map((signal) => (
                                    <article
                                        key={`alert-${signal.signal_key}`}
                                        className={`rounded-[24px] border bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ${
                                            signal.severity === "critical"
                                                ? "border-red-200"
                                                : signal.severity === "warning"
                                                  ? "border-amber-200"
                                                  : "border-teal-200"
                                        }`}
                                    >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="space-y-2">
                                                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${severityTone(signal.severity)}`}>
                                                    <ShieldAlert className="h-3.5 w-3.5" />
                                                    {severityLabel(signal.severity)}
                                                </div>
                                                <h3 className="text-2xl font-black text-slate-900">{signalLabel(signal.signal_key)}</h3>
                                                <div className="space-y-1 text-sm leading-6 text-slate-600">
                                                    {evidenceItems(signal.evidence).length > 0 ? (
                                                        evidenceItems(signal.evidence).map((item) => (
                                                            <p key={`evidence-${signal.signal_key}-${item.label}`}>
                                                                <span className="font-semibold text-slate-800">{item.label}:</span> {item.value}
                                                            </p>
                                                        ))
                                                    ) : (
                                                        <p>No se registraron detalles adicionales para esta señal.</p>
                                                    )}
                                                </div>
                                            </div>
                                            <Link
                                                href={`/dashboard/${store_id}/alerts`}
                                                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                                            >
                                                Ver centro de alertas
                                            </Link>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm font-medium text-slate-600 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                                {scoreData
                                    ? "No detectamos alertas clinicas activas en este momento."
                                    : "Se activara cuando haya señales reales disponibles."}
                            </div>
                        )}
                    </section>
                </div>

                <aside className="space-y-6">
                    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight text-slate-900">Areas Vitales</h2>
                                <p className="text-sm text-slate-600">Lecturas reales desde metricas diarias.</p>
                            </div>
                            <Link href={`/dashboard/${store_id}/vital-signs`} className="rounded-full bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200">
                                <ChevronRight className="h-5 w-5" />
                            </Link>
                        </div>

                        {vitalMetrics.length > 0 ? (
                            <div className="space-y-3">
                                {vitalMetrics.map((metric) => (
                                    <div key={metric.label} className="rounded-[20px] border border-slate-200 px-4 py-4">
                                        <p className="text-sm font-black text-slate-900">{metric.label}</p>
                                        <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{metric.value}</p>
                                        <p className="mt-1 text-xs text-slate-500">Lectura del {latestMetrics?.metric_date}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                                Sin lectura suficiente para mostrar areas vitales todavia.
                            </div>
                        )}
                    </section>

                    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight text-slate-900">Evolucion Clinica</h2>
                                <p className="text-sm text-slate-600">Serie real de scores calculados.</p>
                            </div>
                            <Link href={`/dashboard/${store_id}/evolution`} className="rounded-full bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200">
                                <ChevronRight className="h-5 w-5" />
                            </Link>
                        </div>

                        {sparklineScores.length >= 2 ? (
                            <>
                                <div className="rounded-[20px] bg-[linear-gradient(180deg,#ffffff_0%,#eef5fb_100%)] p-4">
                                    <svg viewBox="0 0 240 96" className="h-32 w-full">
                                        <path d={sparklinePath(sparklineScores)} fill="none" stroke="#0f2347" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <p className="mt-4 text-center text-sm font-medium text-slate-600">
                                    Ultimas {sparklineScores.length} mediciones registradas.
                                </p>
                            </>
                        ) : (
                            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                                Sistema en calibracion inicial. La evolucion resumida se activara cuando exista serie real de scores.
                            </div>
                        )}
                    </section>
                </aside>
            </div>
        </div>
    );
}
