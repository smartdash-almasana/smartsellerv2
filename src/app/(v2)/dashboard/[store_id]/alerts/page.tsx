"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, MessageCircle, Smartphone } from "lucide-react";

export default function AlertsCenterPage() {
    const [emailToggle, setEmailToggle] = useState(true);
    const [telegramToggle, setTelegramToggle] = useState(true);
    const [whatsappToggle, setWhatsappToggle] = useState(false);
    const [globalPolicy, setGlobalPolicy] = useState("personalizada");
    const [minSeverity, setMinSeverity] = useState("critica");
    const [categories, setCategories] = useState({
        logistica: true,
        reputacion: true,
        reclamos: true,
        precios: true,
        inventario: true,
        salud: true,
    });
    const [quietHoursToggle, setQuietHoursToggle] = useState(true);
    const [dailyBriefToggle, setDailyBriefToggle] = useState(true);

    const channelCards = [
        {
            label: "Correo Electronico",
            value: "contact@example.com",
            icon: Mail,
            tone: "border-emerald-200 bg-emerald-50/70",
            status: "Verified",
            active: emailToggle,
            toggle: () => setEmailToggle((value) => !value),
        },
        {
            label: "Telegram",
            value: "@SmartSellerBot",
            icon: MessageCircle,
            tone: "border-sky-200 bg-sky-50/70",
            status: "Connected",
            active: telegramToggle,
            toggle: () => setTelegramToggle((value) => !value),
        },
        {
            label: "WhatsApp",
            value: "+52 55 1234 5678",
            icon: Smartphone,
            tone: "border-amber-200 bg-amber-50/70",
            status: "Pending",
            active: whatsappToggle,
            toggle: () => setWhatsappToggle((value) => !value),
        },
    ];

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <section className="rounded-[28px] bg-[#0f2347] px-6 py-7 text-white shadow-[0_24px_60px_rgba(15,35,71,0.24)]">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-300">Imagen Base 2</p>
                <h1 className="mt-2 text-4xl font-black tracking-tight">Configuracion del Centro de Alertas</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-200">
                    Destinos reales, politica global, severidad minima y horarios de silencio bajo un mismo criterio clinico.
                </p>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:px-8">
                <div className="space-y-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16325c] text-sm font-black text-white">1</span>
                            <h2 className="text-3xl font-black tracking-tight text-slate-900">Destinos de Notificacion</h2>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            {channelCards.map((channel) => {
                                const Icon = channel.icon;
                                return (
                                    <div key={channel.label} className={`rounded-[22px] border p-4 ${channel.tone}`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-4 w-4 text-slate-700" />
                                                <p className="text-lg font-black text-slate-900">{channel.label}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={channel.toggle}
                                                className={`relative h-7 w-12 rounded-full transition ${channel.active ? "bg-[#16325c]" : "bg-slate-300"}`}
                                            >
                                                <span
                                                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${channel.active ? "left-6" : "left-1"}`}
                                                />
                                            </button>
                                        </div>
                                        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-slate-700">
                                            {channel.status === "Pending" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                                            {channel.status}
                                        </div>
                                        <input
                                            type="text"
                                            defaultValue={channel.value}
                                            disabled={!channel.active}
                                            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-8">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16325c] text-sm font-black text-white">2</span>
                            <h2 className="text-3xl font-black tracking-tight text-slate-900">Politica Global</h2>
                        </div>
                        <div className="mt-5 grid gap-3 md:grid-cols-4">
                            {[
                                { key: "todas", label: "Todas" },
                                { key: "ninguna", label: "Ninguna" },
                                { key: "hibrida", label: "Hibrida (Recomendada)" },
                                { key: "personalizada", label: "Personalizada" },
                            ].map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => setGlobalPolicy(option.key)}
                                    className={`rounded-[18px] border px-4 py-4 text-left text-sm font-bold transition ${
                                        globalPolicy === option.key
                                            ? "border-[#16325c] bg-[#16325c] text-white"
                                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-8">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16325c] text-sm font-black text-white">3</span>
                            <h2 className="text-3xl font-black tracking-tight text-slate-900">Severidad Minima</h2>
                        </div>
                        <div className="mt-5 grid gap-2 rounded-[22px] border border-slate-200 bg-slate-50 p-2 sm:grid-cols-4">
                            {[
                                ["critica", "Critica (Solo Urgente)"],
                                ["alta", "Alta"],
                                ["media", "Media"],
                                ["todas", "Todas"],
                            ].map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setMinSeverity(key)}
                                    className={`rounded-[18px] px-4 py-3 text-sm font-bold transition ${
                                        minSeverity === key
                                            ? key === "critica"
                                                ? "bg-[#b92c2c] text-white shadow-sm"
                                                : "bg-[#16325c] text-white shadow-sm"
                                            : "text-slate-700 hover:bg-white"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-8">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16325c] text-sm font-black text-white">4</span>
                            <h2 className="text-3xl font-black tracking-tight text-slate-900">Categorias</h2>
                        </div>
                        <div className="mt-5 flex flex-wrap gap-3">
                            {Object.entries(categories).map(([key, value]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setCategories((current) => ({ ...current, [key]: !value }))}
                                    className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                                        value ? "border-[#16325c] bg-[#16325c] text-white" : "border-slate-200 bg-white text-slate-700"
                                    }`}
                                >
                                    {key === "salud" ? "Salud de Cuenta" : key.charAt(0).toUpperCase() + key.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-8 border-t border-slate-100 pt-8 md:grid-cols-2">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16325c] text-sm font-black text-white">5</span>
                                <h2 className="text-3xl font-black tracking-tight text-slate-900">Horario Silencioso</h2>
                            </div>
                            <div className="mt-5 space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                                <button
                                    type="button"
                                    onClick={() => setQuietHoursToggle((value) => !value)}
                                    className={`relative h-7 w-12 rounded-full transition ${quietHoursToggle ? "bg-[#16325c]" : "bg-slate-300"}`}
                                >
                                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${quietHoursToggle ? "left-6" : "left-1"}`} />
                                </button>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800">
                                        <option>UTC-6 (CDMX)</option>
                                    </select>
                                    <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800">
                                        <option>Solo Notificaciones Menores</option>
                                    </select>
                                    <input className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800" defaultValue="22:00" />
                                    <input className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800" defaultValue="06:00" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16325c] text-sm font-black text-white">6</span>
                                <h2 className="text-3xl font-black tracking-tight text-slate-900">Resumen Diario</h2>
                            </div>
                            <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setDailyBriefToggle((value) => !value)}
                                        className={`relative h-7 w-12 rounded-full transition ${dailyBriefToggle ? "bg-[#16325c]" : "bg-slate-300"}`}
                                    >
                                        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${dailyBriefToggle ? "left-6" : "left-1"}`} />
                                    </button>
                                    <div>
                                        <p className="text-lg font-black text-slate-900">Daily Brief</p>
                                        <p className="text-sm text-slate-600">Enviar resumen de actividad a las 08:00.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row">
                    <button className="rounded-2xl bg-[#b92c2c] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#a32626]">
                        Guardar Cambios
                    </button>
                    <button className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                        Cancelar
                    </button>
                </div>
            </section>
        </div>
    );
}
