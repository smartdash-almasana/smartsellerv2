"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Clock3, MessageCircle, ShieldCheck, Trophy, Truck } from "lucide-react";
import type { ScoreResponse } from "@v2/api/score";

export const AREAS = [
    { key: "logistica", label: "Logistica", icon: Truck },
    { key: "atencion", label: "Atencion", icon: MessageCircle },
    { key: "reputacion", label: "Reputacion", icon: ShieldCheck },
    { key: "competitividad", label: "Competitividad", icon: Trophy },
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
    helper: string;
    icon: React.ComponentType<{ className?: string }>;
};

export type AreaSignal = {
    signal_key: string;
    severity: "info" | "warning" | "critical";
    evidence: Record<string, unknown>;
};

function signalLabel(signalKey: string): string {
    if (signalKey === "no_orders_7d") return "Ritmo comercial en pausa";
    if (signalKey === "cancellation_spike") return "Suba de cancelaciones";
    if (signalKey === "unanswered_messages_spike") return "Mensajes sin respuesta";
    if (signalKey === "claims_opened") return "Reclamos activos";
    if (signalKey === "low_activity_14d") return "Actividad por debajo de lo esperado";
    return "Alerta clinica activa";
}

function severityLabel(severity: AreaSignal["severity"]): string {
    if (severity === "critical") return "ALTA";
    if (severity === "warning") return "MEDIA";
    return "BAJA";
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

function evidenceSummary(evidence: Record<string, unknown>): string {
    const items = Object.entries(evidence).slice(0, 2);
    if (items.length === 0) return "Sin detalle adicional disponible.";
    return items.map(([key, value]) => `${evidenceLabel(key)}: ${String(value)}`).join(" | ");
}

function metricNumber(metrics: Record<string, unknown> | null, key: string): number | null {
    const value = metrics?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildAreaMetricCards(areaKey: AreaKey, metricsRow: MetricsRow | null): MetricCard[] {
    const metrics = metricsRow?.metrics ?? null;
    const metricDate = metricsRow?.metric_date ? `Lectura del ${metricsRow.metric_date}` : "Sin lectura suficiente";

    if (areaKey === "logistica") {
        const ordersCreated = metricNumber(metrics, "orders_created_1d");
        const cancelled = metricNumber(metrics, "orders_cancelled_1d");
        return [
            ordersCreated !== null ? { title: "Ordenes creadas hoy", value: String(ordersCreated), helper: metricDate, icon: Truck } : null,
            cancelled !== null ? { title: "Cancelaciones hoy", value: String(cancelled), helper: metricDate, icon: AlertTriangle } : null,
        ].filter((item): item is MetricCard => Boolean(item));
    }

    if (areaKey === "atencion") {
        const received = metricNumber(metrics, "messages_received_1d");
        const answered = metricNumber(metrics, "messages_answered_1d");
        return [
            received !== null ? { title: "Mensajes recibidos hoy", value: String(received), helper: metricDate, icon: MessageCircle } : null,
            answered !== null ? { title: "Mensajes respondidos hoy", value: String(answered), helper: metricDate, icon: Clock3 } : null,
        ].filter((item): item is MetricCard => Boolean(item));
    }

    if (areaKey === "reputacion") {
        const claims = metricNumber(metrics, "claims_opened_1d");
        return claims !== null
            ? [{ title: "Reclamos abiertos hoy", value: String(claims), helper: metricDate, icon: ShieldCheck }]
            : [];
    }

    return [];
}

function filterSignalsByArea(areaKey: AreaKey, signals: Array<AreaSignal>): Array<AreaSignal> {
    const signalKeysByArea: Record<AreaKey, string[]> = {
        logistica: ["cancellation_spike"],
        atencion: ["unanswered_messages_spike"],
        reputacion: ["claims_opened"],
        competitividad: ["low_activity_14d", "no_orders_7d"],
    };

    return signals.filter((signal) => signalKeysByArea[areaKey].includes(signal.signal_key));
}

export function deriveVitalSignsPanelData(
    selectedAreaKey: AreaKey,
    scoreData: ScoreResponse | null,
    metricsRow: MetricsRow | null,
): {
    selectedAreaLabel: string;
    areaMetricCards: MetricCard[];
    areaSignals: AreaSignal[];
    hasPanelData: boolean;
} {
    const selectedArea = AREAS.find((area) => area.key === selectedAreaKey) ?? AREAS[0];
    const areaMetricCards = buildAreaMetricCards(selectedAreaKey, metricsRow);
    const areaSignals = filterSignalsByArea(selectedAreaKey, (scoreData?.active_signals ?? []) as AreaSignal[]);
    const hasPanelData = areaMetricCards.length > 0 || areaSignals.length > 0;

    return {
        selectedAreaLabel: selectedArea.label,
        areaMetricCards,
        areaSignals,
        hasPanelData,
    };
}

export default function VitalSignsClient({ scoreData, metricsRow }: VitalSignsClientProps) {
    const [selectedAreaKey, setSelectedAreaKey] = useState<AreaKey>("logistica");

    const { selectedAreaLabel, areaMetricCards, areaSignals, hasPanelData } = useMemo(
        () => deriveVitalSignsPanelData(selectedAreaKey, scoreData, metricsRow),
        [selectedAreaKey, scoreData, metricsRow],
    );

    return (
        <div className="flex flex-col gap-6 lg:flex-row">
            <aside className="w-full rounded-[28px] bg-[#0f2347] p-5 text-white shadow-[0_24px_60px_rgba(15,35,71,0.24)] lg:w-72">
                <h1 className="mt-2 text-4xl font-black tracking-tight">Signos Vitales</h1>
                <p className="mt-2 text-sm leading-7 text-slate-200">Lectura por area, patologias activas e historial de intervenciones.</p>

                <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {AREAS.map((area) => {
                        const Icon = area.icon;
                        const active = selectedAreaKey === area.key;
                        return (
                            <button
                                key={area.key}
                                type="button"
                                onClick={() => setSelectedAreaKey(area.key)}
                                className={`flex items-center gap-3 rounded-[20px] border px-4 py-4 text-left text-base font-bold transition ${
                                    active ? "border-white bg-white text-[#0f2347]" : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                                }`}
                            >
                                <Icon className="h-5 w-5" />
                                {area.label}
                            </button>
                        );
                    })}
                </div>
            </aside>

            <div className="flex-1 space-y-6">
                <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    <div className="rounded-[24px] bg-[linear-gradient(180deg,#ffffff_0%,#f6fafe_100%)] p-5">
                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Area Vital</p>
                                    <h2 className="text-4xl font-black tracking-tight text-[#0f2347]">{selectedAreaLabel} - Signos Vitales</h2>
                                </div>
                                <svg viewBox="0 0 180 52" className="h-10 w-40 text-[#0f2347]">
                                    <path d="M2 28 H28 L38 8 L48 42 L58 20 H90 L100 5 L110 45 L120 28 H178" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>

                            {areaMetricCards.length > 0 ? (
                                <div className="grid gap-4 xl:grid-cols-3">
                                    {areaMetricCards.map((card) => {
                                        const Icon = card.icon;
                                        return (
                                            <article key={card.title} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                                                <div className="bg-[#0f2347] px-5 py-3 text-sm font-black uppercase tracking-wide text-white">{card.title}</div>
                                                <div className="flex items-center justify-between gap-4 p-5">
                                                    <div>
                                                        <p className="text-5xl font-black tracking-tight text-slate-900">{card.value}</p>
                                                        <p className="mt-3 text-sm text-slate-600">{card.helper}</p>
                                                    </div>
                                                    <Icon className="h-16 w-16 text-[#0f2347]" />
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                                    Sin lectura suficiente para mostrar indicadores reales de {selectedAreaLabel.toLowerCase()}.
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    <div className="bg-[#0f2347] px-5 py-4 text-lg font-black tracking-tight text-white">Patologias Activas</div>
                    {areaSignals.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left">
                                <thead className="border-b border-slate-200 bg-slate-50 text-sm font-black text-slate-700">
                                    <tr>
                                        <th className="px-5 py-4">Diagnostico</th>
                                        <th className="px-5 py-4">Severidad</th>
                                        <th className="px-5 py-4">Lectura Actual</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {areaSignals.map((signal) => (
                                        <tr key={signal.signal_key}>
                                            <td className="px-5 py-4 font-bold text-slate-900">{signalLabel(signal.signal_key)}</td>
                                            <td className="px-5 py-4">
                                                <span className={`rounded-full px-3 py-1 text-xs font-black ${
                                                    signal.severity === "critical"
                                                        ? "bg-[#a22a2d] text-white"
                                                        : signal.severity === "warning"
                                                          ? "bg-[#f2b632] text-slate-900"
                                                          : "bg-teal-100 text-teal-800"
                                                }`}>
                                                    {severityLabel(signal.severity)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-slate-700">{evidenceSummary(signal.evidence)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-5 py-5 text-sm text-slate-600">
                            No hay patologias activas con evidencia suficiente para {selectedAreaLabel.toLowerCase()}.
                        </div>
                    )}
                </section>

                <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    <div className="bg-[#0f2347] px-5 py-4 text-lg font-black tracking-tight text-white">Historial de Intervenciones</div>
                    <div className="p-6">
                        {hasPanelData ? (
                            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                                Todavia no hay historial de intervenciones reales registradas para {selectedAreaLabel.toLowerCase()}.
                            </div>
                        ) : (
                            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                                Sistema en calibracion inicial para {selectedAreaLabel.toLowerCase()}. Se activara cuando existan registros reales.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
