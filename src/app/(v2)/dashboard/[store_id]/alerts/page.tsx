"use client";

import { useState } from "react";
import {
    Bell,
    CalendarDays,
    Check,
    CircleAlert,
    Clock3,
    Mail,
    MessageCircle,
    Settings2,
    ShieldAlert,
    Smartphone,
    Zap,
} from "lucide-react";

type Freq = "ahora" | "dia" | "resumen";
type Attention = "full" | "business" | "weekend-off";

const problemGroups = [
    {
        title: "Operacion del negocio",
        items: ["Cancelaciones de ventas", "Quiebres de stock", "Despachos en riesgo"],
    },
    {
        title: "Atencion y ventas",
        items: ["Nuevos reclamos", "Preguntas demoradas", "Caidas de ventas repentinas"],
    },
];

const triggerRows = [
    { rule: "Sin ventas registradas por mas de", value: 7, unit: "Dias corridos", level: "alto" },
    { rule: "Tasa de cancelaciones superior al", value: 15, unit: "% de ordenes", level: "alto" },
    { rule: "Descenso de salud del negocio en", value: 8, unit: "Puntos semanales", level: "medio" },
];

export default function AlertsCenterPage() {
    const [channelsActive, setChannelsActive] = useState({
        whatsapp: true,
        telegram: true,
        email: true,
        push: false,
    });
    const [selectedFreq, setSelectedFreq] = useState<Freq>("ahora");
    const [selectedAttention, setSelectedAttention] = useState<Attention>("business");
    const [selectedProblems, setSelectedProblems] = useState<Record<string, boolean>>({
        "Cancelaciones de ventas": true,
        "Quiebres de stock": true,
        "Despachos en riesgo": true,
        "Nuevos reclamos": true,
        "Preguntas demoradas": true,
        "Caidas de ventas repentinas": true,
    });

    return (
        <div className="mx-auto w-full max-w-6xl">
            <section className="mb-8">
                <h1 className="text-5xl font-black tracking-tight text-[#07163d]">Notificaciones y alertas</h1>
                <p className="mt-3 max-w-4xl text-2xl leading-9 text-slate-700">
                    SmartSeller te avisa antes de que los problemas afecten tus ventas. Elegi que cosas queres que te avisemos, por donde y con que urgencia.
                </p>
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-7">
                    <section className="space-y-4">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Como te estamos avisando hoy</p>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                                {
                                    key: "whatsapp" as const,
                                    title: "WhatsApp",
                                    subtitle: "Urgente al instante",
                                    icon: Smartphone,
                                    activeLabel: "ACTIVO",
                                    activeTone: "bg-[#d7f5dc] text-[#1b7a2f]",
                                },
                                {
                                    key: "telegram" as const,
                                    title: "Telegram",
                                    subtitle: "Urgente al instante",
                                    icon: MessageCircle,
                                    activeLabel: "ACTIVO",
                                    activeTone: "bg-[#d7f5dc] text-[#1b7a2f]",
                                },
                                {
                                    key: "email" as const,
                                    title: "Email",
                                    subtitle: "Resumen diario",
                                    icon: Mail,
                                    activeLabel: "ACTIVO",
                                    activeTone: "bg-[#dce9ff] text-[#1d4f9a]",
                                },
                                {
                                    key: "push" as const,
                                    title: "SmartSeller",
                                    subtitle: "Notificaciones push",
                                    icon: Bell,
                                    activeLabel: "DESACTIVADO",
                                    activeTone: "bg-slate-100 text-slate-500",
                                },
                            ].map((item) => {
                                const Icon = item.icon;
                                const enabled = channelsActive[item.key];
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => setChannelsActive((curr) => ({ ...curr, [item.key]: !curr[item.key] }))}
                                        className={`rounded-2xl border p-5 text-left transition ${
                                            enabled ? "border-slate-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)]" : "border-slate-200 bg-slate-50"
                                        }`}
                                    >
                                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <p className="mt-4 text-xl font-black text-slate-900">{item.title}</p>
                                        <p className="mt-1 text-sm font-medium text-slate-600">{item.subtitle}</p>
                                        <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em] ${item.activeTone}`}>
                                            {enabled ? "ACTIVO" : item.activeLabel}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="space-y-3">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Que problemas queres detectar</p>
                        <p className="text-sm font-medium text-slate-600">Elegi las situaciones que SmartSeller va a vigilar por vos.</p>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                            <div className="space-y-6">
                                {problemGroups.map((group) => (
                                    <div key={group.title}>
                                        <p className="mb-3 border-b border-slate-100 pb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{group.title}</p>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {group.items.map((item) => (
                                                <button
                                                    key={item}
                                                    type="button"
                                                    onClick={() => setSelectedProblems((curr) => ({ ...curr, [item]: !curr[item] }))}
                                                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
                                                >
                                                    <span className="text-sm font-semibold text-slate-800">{item}</span>
                                                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-[4px] ${selectedProblems[item] ? "bg-[#07245c] text-white" : "bg-slate-100 text-slate-400"}`}>
                                                        <Check className="h-3.5 w-3.5" />
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Frecuencia de avisos</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {[
                                { key: "ahora" as const, title: "En el momento", desc: "Notificacion al instante", icon: Zap },
                                { key: "dia" as const, title: "En el dia", desc: "Agrupado cada 4 horas", icon: Clock3 },
                                { key: "resumen" as const, title: "Resumen unico", desc: "Un solo reporte al dia", icon: CalendarDays },
                            ].map((item) => {
                                const Icon = item.icon;
                                const active = selectedFreq === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => setSelectedFreq(item.key)}
                                        className={`rounded-2xl border p-5 text-left transition ${
                                            active ? "border-[#031a44] bg-[#031a44] text-white" : "border-slate-200 bg-white text-slate-800"
                                        }`}
                                    >
                                        <Icon className={`h-5 w-5 ${active ? "text-white" : "text-slate-500"}`} />
                                        <p className="mt-6 text-lg font-black">{item.title}</p>
                                        <p className={`mt-1 text-sm ${active ? "text-slate-200" : "text-slate-600"}`}>{item.desc}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Configuracion de umbrales</p>
                                <p className="mt-1 text-sm text-slate-600">Defini los limites para disparar alertas.</p>
                            </div>
                            <button type="button" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.08em] text-[#07245c]">
                                <Settings2 className="h-3.5 w-3.5" />
                                Editar valores
                            </button>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white">
                            <div className="grid grid-cols-[1.8fr_0.7fr_0.9fr_0.5fr] border-b border-slate-100 px-5 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
                                <span>Regla</span>
                                <span>Valor</span>
                                <span>Unidad</span>
                                <span>Nivel</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {triggerRows.map((row) => (
                                    <div key={row.rule} className="grid grid-cols-[1.8fr_0.7fr_0.9fr_0.5fr] items-center px-5 py-4">
                                        <p className="text-sm font-semibold text-slate-800">{row.rule}</p>
                                        <div className="w-14 rounded-md bg-slate-100 px-3 py-2 text-center text-sm font-black text-slate-900">{row.value}</div>
                                        <p className="text-sm text-slate-600">{row.unit}</p>
                                        <span className={`mx-auto h-2.5 w-2.5 rounded-full ${row.level === "alto" ? "bg-red-500" : "bg-amber-500"}`} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Canales de envio</p>
                        <div className="space-y-3">
                            {[
                                { title: "WhatsApp", value: "+54 9 11 5555-0192", action: "Cambiar", icon: Smartphone, hint: "El mas rapido" },
                                { title: "Telegram", value: "@smart_owner_bot", action: "Verificar", icon: MessageCircle, hint: "Reporte extendido" },
                                { title: "Correo electronico", value: "direccion@negocio.com", action: "Editar", icon: Mail, hint: "Bitacora diaria" },
                            ].map((channel) => {
                                const Icon = channel.icon;
                                return (
                                    <div key={channel.title} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">{channel.title} - {channel.hint}</p>
                                                <p className="text-lg font-black text-slate-900">{channel.value}</p>
                                            </div>
                                        </div>
                                        <button type="button" className="text-xs font-black uppercase tracking-[0.08em] text-[#07245c]">{channel.action}</button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Disponibilidad de atencion</p>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                            <div className="grid gap-6 md:grid-cols-[1fr_240px]">
                                <div className="space-y-3">
                                    {[
                                        { key: "full" as const, label: "Alertas activas 24/7" },
                                        { key: "business" as const, label: "Horario comercial (09:00 - 19:00)" },
                                        { key: "weekend-off" as const, label: "Silenciar noches y fines de semana" },
                                    ].map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => setSelectedAttention(item.key)}
                                            className="flex items-center gap-3 text-left"
                                        >
                                            <span className={`h-4 w-4 rounded-full border ${selectedAttention === item.key ? "border-[#07245c] bg-[#07245c]" : "border-slate-400 bg-white"}`} />
                                            <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="border-l border-slate-200 pl-5">
                                    <p className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Envio de resumen diario</p>
                                    <div className="mt-3 flex items-center gap-2">
                                        <div className="rounded-md bg-slate-100 px-3 py-2 text-sm font-black text-slate-900">08:30 AM</div>
                                        <span className="text-sm font-semibold text-slate-600">Cada manana</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_22px_rgba(15,23,42,0.08)]">
                        <h2 className="text-3xl font-black leading-8 text-[#07163d]">Atencion inmediata</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">Resumen del estado operativo y disparadores recientes.</p>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">Total</p>
                                <p className="mt-2 text-4xl font-black text-slate-900">24</p>
                            </div>
                            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-red-500">Criticas</p>
                                <p className="mt-2 text-4xl font-black text-red-600">3</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">Moderadas</p>
                                <p className="mt-2 text-4xl font-black text-amber-500">12</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">Pendientes</p>
                                <p className="mt-2 text-4xl font-black text-slate-700">5</p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-2">
                            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">Disparadores recientes</p>
                            {[
                                { title: "Sin ventas en 7 dias", time: "Hoy, 08:30 AM" },
                                { title: "Cancelaciones: 40%", time: "Ayer, 21:15 PM" },
                            ].map((item) => (
                                <div key={item.title} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3">
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{item.title}</p>
                                        <p className="text-xs text-slate-500">{item.time}</p>
                                    </div>
                                    <CircleAlert className="h-4 w-4 text-red-600" />
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-2xl bg-[#031a44] p-5 text-white shadow-[0_14px_26px_rgba(3,26,68,0.35)]">
                        <h3 className="text-3xl font-black">Guardar cambios</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-200">Esta configuracion impacta en como te protegemos desde ahora.</p>
                        <button type="button" className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-black text-[#031a44]">
                            Aplicar ahora
                        </button>
                        <button type="button" className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-slate-200">
                            Restablecer sugerido
                        </button>
                    </section>

                    <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
                        <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-red-700">
                            <ShieldAlert className="h-4 w-4" />
                            Protocolo de crisis
                        </p>
                        <p className="mt-3 text-sm leading-6 text-red-800">
                            Detectamos 2 eventos criticos pendientes que pueden comprometer tu reputacion.
                        </p>
                        <button type="button" className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white">
                            Resolver incidentes
                        </button>
                    </section>
                </aside>
            </div>
        </div>
    );
}
