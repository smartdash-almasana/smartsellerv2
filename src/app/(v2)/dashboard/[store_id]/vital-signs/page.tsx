"use client";

import { useState } from "react";
import { AlertTriangle, Clock3, PackageOpen, ShieldCheck, Trophy, Truck } from "lucide-react";

const AREAS = [
    { key: "logistica", label: "Logistica", icon: Truck },
    { key: "atencion", label: "Atencion", icon: ShieldCheck },
    { key: "reputacion", label: "Reputacion", icon: AlertTriangle },
    { key: "competitividad", label: "Competitividad", icon: Trophy },
] as const;

export default function VitalSignsPage() {
    const [activeArea, setActiveArea] = useState<(typeof AREAS)[number]["key"]>("logistica");

    const metricCards = [
        {
            title: "Envios Tardios",
            value: "4.5%",
            delta: "+1.2% vs. sem. ant.",
            state: "CRITICO: Intervencion requerida",
            tone: "text-[#a22a2d]",
            icon: PackageOpen,
        },
        {
            title: "Cancelaciones",
            value: "0.8%",
            delta: "-0.3% vs. sem. ant.",
            state: "ESTABLE: Monitoreo continuo",
            tone: "text-[#0a8d78]",
            icon: AlertTriangle,
        },
        {
            title: "Tiempo de Manejo",
            value: "26h",
            delta: "Sin cambios",
            state: "ATENCION: Optimizacion posible",
            tone: "text-[#c48a18]",
            icon: Clock3,
        },
    ];

    const interventions = [
        { date: "15 MAY 2024", title: "Optimizacion de Rutas", result: "Reduccion del 15% en tiempos de transito.", tone: "bg-emerald-500" },
        { date: "02 MAY 2024", title: "Ajuste de Capacidad de Almacen", result: "Capacidad aumentada en 20%.", tone: "bg-sky-500" },
        { date: "20 ABR 2024", title: "Capacitacion de Personal de Deposito", result: "Mejora en la eficiencia de embalaje.", tone: "bg-slate-400" },
    ];

    return (
        <div className="flex flex-col gap-6 lg:flex-row">
            <aside className="w-full rounded-[28px] bg-[#0f2347] p-5 text-white shadow-[0_24px_60px_rgba(15,35,71,0.24)] lg:w-72">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-300">Imagen Base 4</p>
                <h1 className="mt-2 text-4xl font-black tracking-tight">Signos Vitales</h1>
                <p className="mt-2 text-sm leading-7 text-slate-200">Lectura por area, patologias activas e historial de intervenciones.</p>

                <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {AREAS.map((area) => {
                        const Icon = area.icon;
                        const active = activeArea === area.key;
                        return (
                            <button
                                key={area.key}
                                type="button"
                                onClick={() => setActiveArea(area.key)}
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
                                    <h2 className="text-4xl font-black tracking-tight text-[#0f2347]">Logistica - Signos Vitales</h2>
                                </div>
                                <svg viewBox="0 0 180 52" className="h-10 w-40 text-[#0f2347]">
                                    <path d="M2 28 H28 L38 8 L48 42 L58 20 H90 L100 5 L110 45 L120 28 H178" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>

                            <div className="grid gap-4 xl:grid-cols-3">
                                {metricCards.map((card) => {
                                    const Icon = card.icon;
                                    return (
                                        <article key={card.title} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                                            <div className="bg-[#0f2347] px-5 py-3 text-sm font-black uppercase tracking-wide text-white">{card.title}</div>
                                            <div className="flex items-center justify-between gap-4 p-5">
                                                <div>
                                                    <p className="text-5xl font-black tracking-tight text-slate-900">{card.value}</p>
                                                    <p className={`mt-2 text-sm font-bold ${card.tone}`}>{card.delta}</p>
                                                    <p className={`mt-3 text-base font-black ${card.tone}`}>{card.state}</p>
                                                </div>
                                                <Icon className="h-16 w-16 text-[#0f2347]" />
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    <div className="bg-[#0f2347] px-5 py-4 text-lg font-black tracking-tight text-white">Patologias Activas</div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead className="border-b border-slate-200 bg-slate-50 text-sm font-black text-slate-700">
                                <tr>
                                    <th className="px-5 py-4">Diagnostico</th>
                                    <th className="px-5 py-4">Severidad</th>
                                    <th className="px-5 py-4">Accion Sugerida</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                <tr>
                                    <td className="px-5 py-4 font-bold text-slate-900">Retraso en recoleccion (Zona Norte)</td>
                                    <td className="px-5 py-4">
                                        <span className="rounded-full bg-[#a22a2d] px-3 py-1 text-xs font-black text-white">ALTA</span>
                                    </td>
                                    <td className="px-5 py-4 text-slate-700">Contactar proveedor logistico inmediatamente</td>
                                </tr>
                                <tr>
                                    <td className="px-5 py-4 font-bold text-slate-900">Inconsistencia en etiquetas de envio</td>
                                    <td className="px-5 py-4">
                                        <span className="rounded-full bg-[#f2b632] px-3 py-1 text-xs font-black text-slate-900">MEDIA</span>
                                    </td>
                                    <td className="px-5 py-4 text-slate-700">Revisar proceso de impresion y embalaje</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                        <button className="rounded-2xl bg-[#0f2347] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#0b1b38]">
                            Ver Todo el Diagnostico
                        </button>
                    </div>
                </section>

                <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    <div className="bg-[#0f2347] px-5 py-4 text-lg font-black tracking-tight text-white">Historial de Intervenciones</div>
                    <div className="p-6">
                        <div className="relative ml-3 border-l-2 border-slate-200">
                            {interventions.map((item) => (
                                <div key={item.title} className="relative pl-8 pb-8 last:pb-0">
                                    <span className={`absolute -left-[11px] top-1 h-5 w-5 rounded-full border-4 border-white ${item.tone}`} />
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-lg font-black text-slate-900">{item.date} - {item.title}</p>
                                            <p className="text-sm text-slate-600">Resultado: {item.result}</p>
                                        </div>
                                        <ShieldCheck className="mt-1 h-5 w-5 text-emerald-500" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
