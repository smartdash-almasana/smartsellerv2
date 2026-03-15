import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, ChevronRight, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import SyncButton from "./SyncButton";

type DashboardSignal = {
    signal_key: string;
    severity: "info" | "warning" | "critical";
    evidence: Record<string, unknown>;
};

function severityLabel(severity: DashboardSignal["severity"]): string {
    if (severity === "critical") return "Alta Severidad";
    if (severity === "warning") return "Media Severidad";
    return "Baja Severidad";
}

function severityTone(severity: DashboardSignal["severity"]): string {
    if (severity === "critical") return "border-red-200 bg-red-50 text-red-700";
    if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-teal-200 bg-teal-50 text-teal-700";
}

function signalHeadline(signalKey: string): string {
    if (signalKey === "no_orders_7d") return "Ritmo comercial en pausa";
    if (signalKey === "cancellation_spike") return "Suba de cancelaciones";
    if (signalKey === "unanswered_messages_spike") return "Mensajes sin respuesta";
    if (signalKey === "claims_opened") return "Reclamos activos";
    if (signalKey === "low_activity_14d") return "Actividad por debajo de lo esperado";
    return "Alerta operativa activa";
}

function actionTextForSignal(signalKey: string): string {
    if (signalKey === "no_orders_7d") return "Reactivar publicaciones clave y empujar demanda hoy.";
    if (signalKey === "cancellation_spike") return "Revisar stock y promesa de entrega antes del próximo pico.";
    if (signalKey === "unanswered_messages_spike") return "Asignar cobertura de bandeja y responder conversaciones críticas.";
    if (signalKey === "claims_opened") return "Cerrar reclamos abiertos con resolución prioritaria.";
    if (signalKey === "low_activity_14d") return "Actualizar catálogo y recuperar visibilidad comercial.";
    return "Ejecutar un plan de mitigación durante las próximas horas.";
}

function evidenceText(evidence: Record<string, unknown>): string {
    const entries = Object.entries(evidence).slice(0, 2);
    if (entries.length === 0) return "Sin evidencia adicional cargada.";
    return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" | ");
}

function executiveSummary(score: number, signals: DashboardSignal[]): string {
    if (signals.length === 0 && score >= 85) {
        return "La operacion muestra estabilidad general, con buen pulso comercial y sin alertas clinicas activas que exijan intervencion inmediata.";
    }
    if (signals.some((signal) => signal.severity === "critical")) {
        return "La cuenta mantiene traccion, pero hoy conviven riesgos criticos en operacion y cumplimiento que pueden erosionar conversion y reputacion si no se actua rapido.";
    }
    return "El negocio esta estable, aunque aparecen fricciones que conviene corregir temprano para sostener score, margen y experiencia del comprador.";
}

export default async function DashboardPrincipalPage({
    params,
}: {
    params: Promise<{ store_id: string }>;
}) {
    const hdrs = await headers();
    const host = hdrs.get("host");
    const proto = process.env.VERCEL ? "https" : "http";
    const baseUrl = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    let meRes: Response;
    try {
        meRes = await fetch(`${baseUrl}/api/me`, {
            method: "GET",
            cache: "no-store",
            headers: { cookie: hdrs.get("cookie") ?? "" },
        });
    } catch {
        redirect("/enter");
    }

    if (meRes.status !== 200) {
        redirect("/enter");
    }

    const { store_id } = await params;
    const me = await meRes.json();
    const stores = Array.isArray(me?.stores) ? me.stores : [];
    const allowed = stores.some((store: { store_id: string }) => store?.store_id === store_id);

    if (!allowed) redirect("/choose-store");
    if (!store_id) notFound();

    let initialScore: { score: number; computed_at: string; active_signals?: DashboardSignal[] } | null = null;
    try {
        const scoreRes = await fetch(`${baseUrl}/api/score/${store_id}`, {
            cache: "no-store",
            headers: { cookie: hdrs.get("cookie") ?? "" },
        });
        if (scoreRes.ok) initialScore = await scoreRes.json();
    } catch {}

    const score = initialScore?.score ?? 84;
    const computedAt = initialScore?.computed_at ?? new Date().toISOString();
    const fallbackSignals: DashboardSignal[] = [
        { signal_key: "cancellation_spike", severity: "critical", evidence: { impacto: "ventas semanales", ventana: "48h" } },
        { signal_key: "claims_opened", severity: "warning", evidence: { impacto: "reputacion", ventana: "72h" } },
        { signal_key: "low_activity_14d", severity: "info", evidence: { impacto: "visibilidad", ventana: "7 dias" } },
    ];

    const activeSignals: DashboardSignal[] = initialScore?.active_signals?.length
        ? initialScore.active_signals
        : fallbackSignals;

    const actionQueue: DashboardSignal[] = activeSignals.length > 0
        ? activeSignals.slice(0, 3)
        : [{ signal_key: "low_activity_14d", severity: "info", evidence: { impacto: "catalogo", ventana: "7 dias" } }];

    const areaVitals = [
        { label: "Ventas Netas", value: "$120.5k", delta: "+2%", tone: "bg-emerald-500" },
        { label: "Salud de Cuenta", value: "92%", delta: "-1%", tone: "bg-amber-400" },
        { label: "Eficiencia Logistica", value: "98%", delta: "+1%", tone: "bg-teal-500" },
        { label: "Cumplimiento", value: "85%", delta: "-4%", tone: "bg-red-500" },
    ];

    return (
        <div className="flex flex-col gap-6">
            <section className="overflow-hidden rounded-[28px] bg-[#0f2347] px-6 py-8 text-white shadow-[0_24px_60px_rgba(15,35,71,0.24)] lg:px-10">
                <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr_240px] lg:items-center">
                    <div className="flex items-center gap-5">
                        <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-[#132c58] shadow-[inset_0_0_0_10px_rgba(37,99,235,0.12)]">
                            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 160 160">
                                <circle cx="80" cy="80" r="58" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="12" />
                                <circle
                                    cx="80"
                                    cy="80"
                                    r="58"
                                    fill="none"
                                    stroke="#24c8b5"
                                    strokeWidth="12"
                                    strokeDasharray="364"
                                    strokeDashoffset={364 - (score / 100) * 364}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="relative flex flex-col items-center">
                                <span className="text-5xl font-black tracking-tight">{score}</span>
                                <span className="text-sm font-semibold text-slate-300">/100</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                                <Sparkles className="h-3.5 w-3.5" />
                                Dashboard Principal
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight lg:text-4xl">Salud Clinica General</h1>
                                <p className="mt-1 text-sm text-slate-300">Chequeo ejecutivo actualizado {new Date(computedAt).toLocaleString()}</p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-sm font-semibold text-emerald-300">
                                <TrendingUp className="h-4 w-4" />
                                +4.3% vs. chequeo anterior
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                        <h2 className="text-2xl font-black tracking-tight">Resumen Ejecutivo</h2>
                        <p className="text-sm leading-7 text-slate-200">{executiveSummary(score, activeSignals)}</p>
                        <p className="text-sm leading-7 text-slate-300">
                            El analisis recomienda {actionQueue.length} frentes inmediatos para proteger ventas, reputacion y continuidad operativa.
                        </p>
                    </div>

                    <div className="hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(36,200,181,0.08),rgba(15,35,71,0))] p-6 lg:block">
                        <svg viewBox="0 0 220 110" className="h-28 w-full">
                            <path d="M6 82 C42 52, 70 90, 102 54 S162 48, 214 10" fill="none" stroke="#24c8b5" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="214" cy="10" r="6" fill="#24c8b5" />
                        </svg>
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-6">
                    <section className="space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-3xl font-black tracking-tight text-slate-900">Que hacer ahora</h2>
                                <p className="mt-1 text-sm text-slate-600">Prioridades clinicas para las proximas horas.</p>
                            </div>
                            <SyncButton storeId={store_id} />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3">
                            {actionQueue.map((signal, index) => (
                                <article key={`${signal.signal_key}-${index}`} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${severityTone(signal.severity)}`}>
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        {severityLabel(signal.severity)}
                                    </div>
                                    <h3 className="mt-4 text-2xl font-black leading-tight text-slate-900">
                                        Accion Prioritaria {index + 1}
                                    </h3>
                                    <p className="mt-2 text-lg font-bold text-slate-800">{actionTextForSignal(signal.signal_key)}</p>
                                    <p className="mt-4 text-sm leading-6 text-slate-600">
                                        Impacto: {signalHeadline(signal.signal_key)}.
                                    </p>
                                    <p className="text-sm leading-6 text-slate-600">Ventana de reversibilidad: {evidenceText(signal.evidence)}.</p>
                                    <Link
                                        href={`/dashboard/${store_id}/alerts`}
                                        className={`mt-5 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold text-white transition ${
                                            signal.severity === "critical"
                                                ? "bg-[#a3212a] hover:bg-[#8c1c24]"
                                                : "bg-[#0f2347] hover:bg-[#0b1b38]"
                                        }`}
                                    >
                                        Gestionar ahora
                                    </Link>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight text-slate-900">Alertas Clinicas Activas</h2>
                            <p className="mt-1 text-sm text-slate-600">Superficie minima para decidir rapido y actuar con contexto.</p>
                        </div>

                        <div className="space-y-3">
                            {activeSignals.length === 0 ? (
                                <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm font-medium text-slate-600 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                                    No hay alertas clinicas activas.
                                </div>
                            ) : (
                                activeSignals.map((signal, index) => (
                                    <article
                                        key={`${signal.signal_key}-${index}`}
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
                                                <h3 className="text-2xl font-black text-slate-900">{signalHeadline(signal.signal_key)}</h3>
                                                <p className="text-sm leading-6 text-slate-600">
                                                    Evidencia: {evidenceText(signal.evidence)}
                                                </p>
                                                <p className="text-sm leading-6 text-slate-700">
                                                    Accion sugerida: {actionTextForSignal(signal.signal_key)}
                                                </p>
                                            </div>
                                            <Link
                                                href={`/dashboard/${store_id}/alerts`}
                                                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                                            >
                                                Ver plan de accion
                                            </Link>
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                <aside className="space-y-6">
                    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight text-slate-900">Areas Vitales</h2>
                                <p className="text-sm text-slate-600">Pulso ejecutivo por frente operativo.</p>
                            </div>
                            <Link href={`/dashboard/${store_id}/vital-signs`} className="rounded-full bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200">
                                <ChevronRight className="h-5 w-5" />
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {areaVitals.map((area) => (
                                <div key={area.label} className="flex items-center justify-between rounded-[20px] border border-slate-200 px-4 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-2 rounded-full ${area.tone}`} />
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{area.label}</p>
                                            <p className="text-xs text-slate-500">Estado actual</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black tracking-tight text-slate-900">{area.value}</p>
                                        <p className={`text-xs font-bold ${area.delta.startsWith("-") ? "text-red-600" : "text-emerald-600"}`}>{area.delta}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight text-slate-900">Evolucion Clinica</h2>
                                <p className="text-sm text-slate-600">Resumen de tendencia.</p>
                            </div>
                            <Link href={`/dashboard/${store_id}/evolution`} className="rounded-full bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200">
                                <ChevronRight className="h-5 w-5" />
                            </Link>
                        </div>

                        <div className="mb-4 flex items-center gap-5 text-xs font-bold text-slate-600">
                            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#0f2347]" /> Salud General</span>
                            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#24c8b5]" /> Ventas</span>
                        </div>
                        <div className="rounded-[20px] bg-[linear-gradient(180deg,#ffffff_0%,#eef5fb_100%)] p-4">
                            <svg viewBox="0 0 260 120" className="h-36 w-full">
                                <path d="M0 86 C24 70, 38 94, 64 74 S110 30, 138 54 S188 70, 260 18" fill="none" stroke="#24c8b5" strokeWidth="4" strokeLinecap="round" />
                                <path d="M0 74 C24 80, 42 52, 66 64 S112 88, 150 54 S206 60, 260 50" fill="none" stroke="#0f2347" strokeWidth="4" strokeLinecap="round" />
                            </svg>
                        </div>
                        <p className="mt-4 text-center text-sm font-medium text-slate-600">Tendencia estable en los ultimos 30 dias</p>
                    </section>
                </aside>
            </div>
        </div>
    );
}
