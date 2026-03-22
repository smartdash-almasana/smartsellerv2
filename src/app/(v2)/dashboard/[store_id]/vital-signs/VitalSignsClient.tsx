"use client";

import { useMemo, useState } from "react";
import {
    AlertTriangle,
    Clock3,
    MessageCircle,
    ShieldCheck,
    Trophy,
    Truck,
} from "lucide-react";
import type { ScoreResponse } from "@v2/api/score";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export const AREAS = [
    { key: "logistica",      label: "Ventas",      icon: Truck },
    { key: "reputacion",     label: "Reputación",  icon: ShieldCheck },
    { key: "atencion",       label: "Atención",    icon: MessageCircle },
    { key: "competitividad", label: "Despacho",    icon: Trophy },
] as const;

export type AreaKey = (typeof AREAS)[number]["key"];

export type MetricsRow = {
    metric_date: string;
    metrics: Record<string, unknown> | null;
};

type VitalSignsClientProps = {
    scoreData: ScoreResponse | null;
    metricsRow: MetricsRow | null;
};

export type MetricCard = {
    title: string;
    value: string;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
    alert?: boolean;
};

export type AreaSignal = {
    signal_key: string;
    severity: "info" | "warning" | "critical";
    evidence: Record<string, unknown>;
};

// ─── Lógica de datos (sin cambios semánticos) ─────────────────────────────────

function signalLabel(signalKey: string): string {
    if (signalKey === "no_orders_7d") return "Sin ventas en los últimos 7 días";
    if (signalKey === "cancellation_spike") return "Suba de cancelaciones detectada";
    if (signalKey === "unanswered_messages_spike") return "Mensajes sin respuesta";
    if (signalKey === "claims_opened") return "Reclamos activos";
    if (signalKey === "low_activity_14d") return "Actividad por debajo de lo esperado";
    return "Alerta operativa activa";
}

function signalDescription(signal: AreaSignal): string {
    const ev = signal.evidence;
    if (signal.signal_key === "no_orders_7d") {
        const n = ev["orders_created_7d"];
        return n !== undefined ? `${n} órdenes creadas en los últimos 7 días.` : "Sin datos suficientes.";
    }
    if (signal.signal_key === "cancellation_spike") {
        const ratio = ev["ratio"];
        return ratio !== undefined ? `Ratio de cancelación: ${(Number(ratio) * 100).toFixed(1)}% del total de órdenes.` : "Índice elevado de cancelaciones.";
    }
    if (signal.signal_key === "unanswered_messages_spike") {
        const received = ev["messages_received_1d"];
        const answered = ev["messages_answered_1d"];
        if (received !== undefined && answered !== undefined) {
            return `${answered} de ${received} mensajes respondidos hoy.`;
        }
        return "Alta proporción de mensajes sin respuesta.";
    }
    if (signal.signal_key === "claims_opened") {
        const n = ev["claims_opened_14d"];
        return n !== undefined ? `${n} reclamos abiertos en los últimos 14 días.` : "Reclamos activos detectados.";
    }
    if (signal.signal_key === "low_activity_14d") {
        const n = ev["total_activity"];
        return n !== undefined ? `Actividad total en 14 días: ${n}.` : "Actividad por debajo de lo normal.";
    }
    return "Revisá el detalle en Alertas.";
}

function metricNumber(metrics: Record<string, unknown> | null, key: string): number | null {
    const value = metrics?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildAreaMetricCards(areaKey: AreaKey, metricsRow: MetricsRow | null): MetricCard[] {
    const metrics = metricsRow?.metrics ?? null;
    const period = metricsRow?.metric_date ?? null;
    const sub = period ? `Período: ${period}` : "Sin datos del período";

    if (areaKey === "logistica") {
        const created = metricNumber(metrics, "orders_created_1d");
        const cancelled = metricNumber(metrics, "orders_cancelled_1d");
        const cards: MetricCard[] = [];
        if (created !== null) {
            cards.push({ title: "Órdenes creadas hoy", value: String(created), sub, icon: Truck });
        }
        if (cancelled !== null) {
            cards.push({
                title: "Cancelaciones hoy",
                value: String(cancelled),
                sub,
                icon: AlertTriangle,
                alert: cancelled > 0,
            });
        }
        return cards;
    }

    if (areaKey === "atencion") {
        const received = metricNumber(metrics, "messages_received_1d");
        const answered = metricNumber(metrics, "messages_answered_1d");
        const cards: MetricCard[] = [];
        if (received !== null) {
            cards.push({ title: "Mensajes recibidos hoy", value: String(received), sub, icon: MessageCircle });
        }
        if (answered !== null) {
            cards.push({ title: "Mensajes respondidos hoy", value: String(answered), sub, icon: Clock3 });
        }
        return cards;
    }

    if (areaKey === "reputacion") {
        const claims = metricNumber(metrics, "claims_opened_1d");
        return claims !== null
            ? [{ title: "Reclamos abiertos hoy", value: String(claims), sub, icon: ShieldCheck, alert: claims > 0 }]
            : [];
    }

    // competitividad / despacho — no tiene métricas directas de 1d propias
    return [];
}

function filterSignalsByArea(areaKey: AreaKey, signals: AreaSignal[]): AreaSignal[] {
    const map: Record<AreaKey, string[]> = {
        logistica:      ["cancellation_spike"],
        atencion:       ["unanswered_messages_spike"],
        reputacion:     ["claims_opened"],
        competitividad: ["low_activity_14d", "no_orders_7d"],
    };
    return signals.filter((s) => map[areaKey].includes(s.signal_key));
}

function deriveHealthLabel(score: number | null | undefined): { text: string; good: boolean } {
    if (score === null || score === undefined) return { text: "Sin datos", good: false };
    if (score >= 80) return { text: "Operativo", good: true };
    if (score >= 60) return { text: "Bajo observación", good: false };
    return { text: "Requiere atención", good: false };
}

function deriveEstadoGeneral(
    areaSig: AreaSignal[],
    areaLabel: string,
): string {
    const criticals = areaSig.filter((s) => s.severity === "critical");
    const warnings = areaSig.filter((s) => s.severity === "warning");
    if (criticals.length > 0) {
        return `${areaLabel} tiene ${criticals.length} alerta${criticals.length > 1 ? "s" : ""} crítica${criticals.length > 1 ? "s" : ""} que requieren acción inmediata.`;
    }
    if (warnings.length > 0) {
        return `${areaLabel} tiene ${warnings.length} señal${warnings.length > 1 ? "es" : ""} de advertencia. Revisá los indicadores activos.`;
    }
    return `${areaLabel} no registra alertas activas. Los indicadores del período se muestran abajo.`;
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: AreaSignal["severity"] }) {
    if (severity === "critical") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-red-700">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Crítico
            </span>
        );
    }
    if (severity === "warning") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Advertencia
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-teal-700">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            Informativo
        </span>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function VitalSignsClient({ scoreData, metricsRow }: VitalSignsClientProps) {
    const [selectedAreaKey, setSelectedAreaKey] = useState<AreaKey>("logistica");

    const allSignals = useMemo(
        () => ((scoreData?.active_signals ?? []) as AreaSignal[]),
        [scoreData],
    );

    const selectedArea = AREAS.find((a) => a.key === selectedAreaKey) ?? AREAS[0];
    const areaLabel = selectedArea.label;

    const areaSignals = useMemo(
        () => filterSignalsByArea(selectedAreaKey, allSignals),
        [selectedAreaKey, allSignals],
    );

    const areaMetricCards = useMemo(
        () => buildAreaMetricCards(selectedAreaKey, metricsRow),
        [selectedAreaKey, metricsRow],
    );

    const score = scoreData?.score ?? null;
    const health = deriveHealthLabel(score);
    const estadoTexto = deriveEstadoGeneral(areaSignals, areaLabel);

    // "A qué prestar atención" — solo señales de TODAS las áreas de prioridad alta
    const topSignals = useMemo(
        () => [...allSignals]
            .filter((s) => s.severity === "critical" || s.severity === "warning")
            .slice(0, 3),
        [allSignals],
    );

    const hasMetrics = areaMetricCards.length > 0;
    const hasSignals = areaSignals.length > 0;

    return (
        <div className="w-full min-w-0">
            {/* ── Encabezado de la sección ─────────────────────────────── */}
            <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">
                    Estado general
                </p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-3xl font-black tracking-tight text-[#06102c] sm:text-4xl">
                        Áreas del negocio
                    </h1>
                    <span
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-widest ${
                            health.good
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                        }`}
                    >
                        <span className={`h-2 w-2 rounded-full ${health.good ? "bg-green-500" : "bg-red-500"}`} />
                        {health.text}
                    </span>
                </div>
                <p className="mt-2 text-base text-slate-500">{estadoTexto}</p>
            </div>

            {/* ── Tabs de áreas ────────────────────────────────────────── */}
            <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                {AREAS.map((area) => {
                    const active = area.key === selectedAreaKey;
                    const hasAlert = filterSignalsByArea(area.key, allSignals).some(
                        (s) => s.severity === "critical" || s.severity === "warning",
                    );
                    return (
                        <button
                            key={area.key}
                            type="button"
                            onClick={() => setSelectedAreaKey(area.key)}
                            className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition-all ${
                                active
                                    ? "bg-[#1d4ed8] text-white shadow-sm"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                        >
                            {hasAlert && !active && (
                                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
                            )}
                            {area.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Cuerpo principal: panel izquierdo + columna derecha ──── */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">

                {/* Panel de métricas del área */}
                <div className="space-y-5">

                    {/* Card principal del panel */}
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                    Panel de {areaLabel}
                                </p>
                                {score !== null && (
                                    <p className="mt-0.5 text-xs text-slate-400">
                                        Score global del negocio: {score}/100
                                    </p>
                                )}
                            </div>
                            {hasSignals ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-600">
                                    <AlertTriangle className="h-3 w-3" />
                                    Con alertas
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-green-600">
                                    En orden
                                </span>
                            )}
                        </div>

                        <div className="p-5">
                            {/* Métricas de tarjetas */}
                            {hasMetrics ? (
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {areaMetricCards.map((card) => {
                                        const Icon = card.icon;
                                        return (
                                            <div
                                                key={card.title}
                                                className={`rounded-xl border p-4 ${
                                                    card.alert
                                                        ? "border-red-200 bg-red-50"
                                                        : "border-slate-200 bg-slate-50"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                                        {card.title}
                                                    </p>
                                                    <Icon
                                                        className={`h-4 w-4 shrink-0 ${
                                                            card.alert ? "text-red-400" : "text-slate-400"
                                                        }`}
                                                    />
                                                </div>
                                                <p
                                                    className={`mt-2 text-4xl font-black tracking-tight ${
                                                        card.alert ? "text-red-600" : "text-slate-900"
                                                    }`}
                                                >
                                                    {card.value}
                                                </p>
                                                <p className="mt-1.5 text-[11px] text-slate-400">{card.sub}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                                    No hay métricas disponibles para{" "}
                                    <span className="font-semibold text-slate-700">{areaLabel}</span>{" "}
                                    en este período.
                                    {!metricsRow && (
                                        <span className="ml-1 text-slate-400">
                                            El sistema aún no registró datos suficientes.
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Alertas activas del área */}
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                Alertas activas en {areaLabel}
                            </p>
                            {hasSignals && (
                                <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white">
                                    {areaSignals.length}
                                </span>
                            )}
                        </div>

                        {hasSignals ? (
                            <ul className="divide-y divide-slate-100">
                                {areaSignals.map((signal) => (
                                    <li key={signal.signal_key} className="flex items-start gap-4 px-5 py-4">
                                        <div className="mt-0.5">
                                            <SeverityBadge severity={signal.severity} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-slate-900">
                                                {signalLabel(signal.signal_key)}
                                            </p>
                                            <p className="mt-0.5 text-xs leading-5 text-slate-500">
                                                {signalDescription(signal)}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="px-5 py-6 text-sm text-slate-500">
                                No hay alertas activas para{" "}
                                <span className="font-semibold text-slate-700">{areaLabel}</span>{" "}
                                en este momento.
                            </div>
                        )}
                    </section>
                </div>

                {/* Columna derecha */}
                <div className="space-y-5">

                    {/* Score del negocio */}
                    {score !== null && (
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                                Salud del negocio
                            </p>
                            <div className="mt-3 flex items-end gap-2">
                                <span className="text-5xl font-black tracking-tight text-[#06102c]">{score}</span>
                                <span className="mb-1 text-lg font-bold text-slate-400">/100</span>
                            </div>
                            {/* Barra de score */}
                            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className={`h-2 rounded-full transition-all ${
                                        score >= 80
                                            ? "bg-green-500"
                                            : score >= 60
                                              ? "bg-amber-500"
                                              : "bg-red-500"
                                    }`}
                                    style={{ width: `${score}%` }}
                                />
                            </div>
                            <p className="mt-2 text-xs text-slate-400">
                                Lectura del{" "}
                                {scoreData?.computed_at
                                    ? new Date(scoreData.computed_at).toLocaleDateString("es-AR", {
                                          day: "numeric",
                                          month: "short",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                      })
                                    : "período actual"}
                            </p>
                        </section>
                    )}

                    {/* A qué prestar atención — señales prioritarias de todo el negocio */}
                    <section className="overflow-hidden rounded-2xl bg-[#06102c] text-white shadow-sm">
                        <div className="border-b border-white/10 px-5 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">
                                A qué prestar atención
                            </p>
                        </div>
                        {topSignals.length > 0 ? (
                            <ul className="divide-y divide-white/10">
                                {topSignals.map((signal) => (
                                    <li key={signal.signal_key} className="px-5 py-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-bold text-white">
                                                {signalLabel(signal.signal_key)}
                                            </p>
                                            {signal.severity === "critical" && (
                                                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-slate-400">
                                            {signalDescription(signal)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="px-5 py-6 text-sm text-slate-400">
                                Sin señales de alta prioridad detectadas en este momento.
                            </div>
                        )}
                    </section>

                    {/* Fuente de datos */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                            Fuente de datos
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                            Métricas del período más reciente registradas por el motor clínico.{" "}
                            {metricsRow?.metric_date
                                ? `Última lectura: ${metricsRow.metric_date}.`
                                : "Sin lectura disponible aún."}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
