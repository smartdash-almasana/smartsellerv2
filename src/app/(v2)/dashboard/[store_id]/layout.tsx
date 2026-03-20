"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Activity, Bell, LogOut, Menu, TrendingUp } from "lucide-react";

type NavItem = {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const routeParams = useParams<{ store_id: string }>();
    const store_id = typeof routeParams?.store_id === "string" ? routeParams.store_id : "";
    const pathname = usePathname();
    const [storeName, setStoreName] = useState("SmartSeller Principal");

    useEffect(() => {
        fetch("/api/me", { cache: "no-store" })
            .then((res) => res.json())
            .then((data) => {
                const stores = Array.isArray(data?.stores) ? data.stores : [];
                const store = stores.find((item: { store_id: string; display_name?: string }) => item.store_id === store_id);
                setStoreName(store?.display_name ?? "SmartSeller Principal");
            })
            .catch(() => setStoreName("SmartSeller Principal"));
    }, [store_id]);

    const navItems: NavItem[] = [
        { name: "Dashboard", href: `/dashboard/${store_id}`, icon: Menu },
        { name: "Areas Vitales", href: `/dashboard/${store_id}/vital-signs`, icon: Activity },
        { name: "Evolucion", href: `/dashboard/${store_id}/evolution`, icon: TrendingUp },
        { name: "Centro de Alertas", href: `/dashboard/${store_id}/alerts`, icon: Bell },
    ];

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f8fbff_0%,#eef4fb_42%,#f8fafc_100%)] text-slate-900">
            <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0f2347] text-white shadow-[0_16px_40px_rgba(15,35,71,0.25)]">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                    <nav className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-2 md:flex">
                        {navItems.map((item) => {
                            const active = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                        active
                                            ? "bg-white text-[#0f2347] shadow-sm"
                                            : "text-slate-200 hover:bg-white/10 hover:text-white"
                                    }`}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="ml-auto flex items-center gap-3">
                        <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 md:block">
                            {storeName}
                        </div>
                        <form action="/api/auth/logout" method="post">
                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                            >
                                <LogOut className="h-4 w-4" />
                                Logout
                            </button>
                        </form>
                    </div>
                </div>

                <div className="border-t border-white/10 md:hidden">
                    <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                        active
                                            ? "border-white bg-white text-[#0f2347]"
                                            : "border-white/10 bg-white/5 text-slate-200"
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                {children}
            </main>
        </div>
    );
}
