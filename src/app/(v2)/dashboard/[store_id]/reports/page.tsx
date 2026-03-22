"use client";

import { useState } from "react";
import {
    BarChart3,
    CalendarDays,
    Check,
    ClipboardList,
    Gauge,
    LayoutGrid,
    MessageSquareWarning,
    Search,
    Sparkles,
    Target,
    Truck,
    UserRoundSearch,
} from "lucide-react";

type ReportType = "resumen" | "riesgos" | "ventas" | "atencion" | "despacho" | "completo";
type RangeType = "7d" | "30d" | "mes" | "anterior";

const reportCards: Array<{
    id: ReportType;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
}> = [
    { id: "resumen", title: "Resumen del negocio", icon: LayoutGrid },
    { id: "riesgos", title: "Riesgos de la cuenta", icon: UserRoundSearch },
    { id: "ventas", title: "Ventas y rendimiento", icon: BarChart3 },
    { id: "atencion", title: "Atencion y reputacion", icon: Gauge },
    { id: "despacho", title: "Despacho y operacion", icon: Truck },
    { id: "completo", title: "Reporte completo", icon: ClipboardList },
];

const mainQuestions = [
    "Que te esta frenando ventas hoy",
    "Donde perdes rentabilidad",
    "Que puede afectar tu reputacion",
    "Que publicaciones necesitan ajustes",
    "Que errores se repiten en la operacion",
    "Donde hay oportunidades rapidas",
];

const previewBlocks = [
    { title: "Resumen rapido", pages: "Pagina 01" },
    { title: "Problemas clave", pages: "Paginas 02-03" },
    { title: "Metricas del periodo", pages: "Paginas 04-05" },
    { title: "Sugerencias practicas", pages: "Paginas 06-07" },
    { title: "Plan de accion", pages: "Pagina 08" },
];

export default function DashboardReportsPage() {
    const [selectedReport, setSelectedReport] = useState<ReportType>("completo");
    const [selectedRange, setSelectedRange] = useState<RangeType>("30d");
    const [selectedQuestion, setSelectedQuestion] = useState(0);
    const [aiEnabled, setAiEnabled] = useState(true);

    return (
        <div className="mx-auto w-full max-w-6xl">
            <div className="mb-8 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                <span>Reportes</span>
                <span>/</span>
                <span className="text-slate-900">Crear reporte</span>
            </div>

            <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_295px]">
                <div className="space-y-8">
                    <section>
                        <h1 className="text-4xl font-black tracking-tight text-[#06102c]">Crear reporte</h1>
                        <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
                            Elegi que queres mirar primero para tomar decisiones claras y mover tu negocio con foco.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#031a44] text-[11px] font-black text-white">01</span>
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-slate-700">Tipo de reporte</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {reportCards.map((card) => {
                                const Icon = card.icon;
                                const active = selectedReport === card.id;
                                return (
                                    <button
                                        key={card.id}
                                        type="button"
                                        onClick={() => setSelectedReport(card.id)}
                                        className={`relative rounded-2xl border p-5 text-left transition ${
                                            active
                                                ? "border-[#031a44] bg-[#031a44] text-white shadow-[0_12px_28px_rgba(3,26,68,0.28)]"
                                                : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                                        }`}
                                    >
                                        {card.id === "completo" ? (
                                            <span className="absolute right-3 top-2 rounded-full bg-[#b5f3b0] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#0d4921]">
                                                Recomendado
                                            </span>
                                        ) : null}
                                        <Icon className={`mb-10 h-5 w-5 ${active ? "text-[#9fe1a9]" : "text-slate-400"}`} />
                                        <p className="text-[15px] font-black leading-5">{card.title}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#031a44] text-[11px] font-black text-white">02</span>
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-slate-700">Periodo de analisis</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="grid gap-2 sm:grid-cols-4">
                                {[
                                    { id: "7d" as const, label: "Ultimos 7 dias" },
                                    { id: "30d" as const, label: "Ultimos 30 dias" },
                                    { id: "mes" as const, label: "Este mes" },
                                    { id: "anterior" as const, label: "Mes anterior" },
                                ].map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setSelectedRange(option.id)}
                                        className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                                            selectedRange === option.id
                                                ? "bg-[#031a44] text-white shadow-[0_8px_18px_rgba(3,26,68,0.25)]"
                                                : "text-slate-700 hover:bg-slate-50"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                            <button type="button" className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                <CalendarDays className="h-4 w-4" />
                                Personalizar rango
                            </button>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#031a44] text-[11px] font-black text-white">03</span>
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-slate-700">Contenido del reporte</p>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-white p-6">
                            <div className="grid gap-8 md:grid-cols-2">
                                <div>
                                    <p className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Resultados</p>
                                    <div className="space-y-3">
                                        {[
                                            "Ventas y facturacion",
                                            "Cancelaciones",
                                            "Reclamos abiertos",
                                            "Estado de reputacion",
                                        ].map((item) => (
                                            <div key={item} className="flex items-start gap-3 text-sm font-semibold text-slate-800">
                                                <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-[4px] bg-[#031a44] text-white">
                                                    <Check className="h-3 w-3" />
                                                </span>
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Operacion</p>
                                    <div className="space-y-3">
                                        {[
                                            "Tiempos de respuesta",
                                            "Ritmo de despacho",
                                            "Publicaciones criticas",
                                            "Pasos recomendados",
                                        ].map((item) => (
                                            <div key={item} className="flex items-start gap-3 text-sm font-semibold text-slate-800">
                                                <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-[4px] bg-[#031a44] text-white">
                                                    <Check className="h-3 w-3" />
                                                </span>
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#031a44] text-[11px] font-black text-white">04</span>
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-slate-700">Foco principal del informe</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {mainQuestions.map((question, index) => {
                                const active = selectedQuestion === index;
                                return (
                                    <button
                                        key={question}
                                        type="button"
                                        onClick={() => setSelectedQuestion(index)}
                                        className={`rounded-2xl border px-5 py-4 text-left text-sm font-semibold leading-6 transition ${
                                            active
                                                ? "border-[#111827] bg-white text-[#111827] shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
                                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                        }`}
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            {active ? <Sparkles className="h-4 w-4" /> : null}
                                            {question}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <div className="flex flex-col gap-6 border-b border-slate-200 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-4">
                                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#031a44] text-white shadow-[0_10px_20px_rgba(3,26,68,0.22)]">
                                    <Sparkles className="h-6 w-6" />
                                </span>
                                <div>
                                    <h2 className="text-3xl font-black tracking-tight text-slate-900">Analisis inteligente</h2>
                                    <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
                                        Si lo activas, sumamos patrones y alertas utiles para que el reporte te marque prioridades.
                                    </p>
                                </div>
                            </div>
                            <div className="inline-flex rounded-full bg-slate-100 p-1.5">
                                <button
                                    type="button"
                                    onClick={() => setAiEnabled(true)}
                                    className={`rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.08em] transition ${
                                        aiEnabled ? "bg-[#031a44] text-white" : "text-slate-500"
                                    }`}
                                >
                                    Activado
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAiEnabled(false)}
                                    className={`rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.08em] transition ${
                                        !aiEnabled ? "bg-[#031a44] text-white" : "text-slate-500"
                                    }`}
                                >
                                    Desactivado
                                </button>
                            </div>
                        </div>
                        <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                { icon: Search, title: "Hallazgos clave", text: "Te muestra lo mas importante sin leer todo el detalle." },
                                { icon: Target, title: "Patrones", text: "Detecta comportamientos que se repiten en periodos similares." },
                                { icon: MessageSquareWarning, title: "Riesgos", text: "Marca desajustes antes de que peguen en ventas o reputacion." },
                            ].map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.title} className="rounded-2xl bg-slate-50 px-4 py-4">
                                        <Icon className="h-4 w-4 text-slate-500" />
                                        <p className="mt-3 text-sm font-black text-slate-900">{item.title}</p>
                                        <p className="mt-2 text-xs leading-5 text-slate-600">{item.text}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>

                <aside className="lg:sticky lg:top-6 lg:h-fit">
                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.09)]">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-600">Vista previa</p>
                        <div className="mt-4 space-y-2.5">
                            {previewBlocks.map((block) => (
                                <div key={block.title} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                    <p className="text-sm font-bold text-slate-900">{block.title}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{block.pages}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                            <p className="text-sm leading-6 text-slate-700">
                                Se arma un PDF de <span className="font-black text-slate-900">8 paginas</span> con datos del periodo y pasos recomendados para accionar hoy.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#031a44] px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-white shadow-[0_10px_22px_rgba(3,26,68,0.28)] transition hover:bg-[#021232]"
                        >
                            Generar reporte PDF
                        </button>
                        <button
                            type="button"
                            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Ver antes de descargar
                        </button>
                    </section>
                </aside>
            </div>
        </div>
    );
}
