"use client";

import clsx from "clsx";
import { BarChart3, LayoutDashboard, Play, Settings as SettingsIcon, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fmtDate, initials } from "@/lib/format";
import { hasKey, useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/personas", label: "Personas", icon: Users },
  { href: "/simulations", label: "Simulations", icon: Play },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function Logo() {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink" aria-hidden>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#d7f25c" strokeWidth="1.8">
        <circle cx="14" cy="14" r="3" />
        <circle cx="14" cy="4.5" r="2" />
        <circle cx="23" cy="10.5" r="2" />
        <circle cx="20" cy="22" r="2" />
        <circle cx="8" cy="22" r="2" />
        <circle cx="5" cy="10.5" r="2" />
        <path d="M14 11V6.5M16.7 12.8l4.5-1.6M15.7 16.4l3.2 4M12.3 16.4l-3.2 4M11.3 12.8l-4.5-1.6" />
      </svg>
    </span>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The store reads from localStorage, so render page content only in the browser.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const settings = useStore((s) => s.settings);
  const simulations = useStore((s) => s.simulations);
  const running = useMemo(() => simulations.filter((x) => x.status === "running" || x.status === "analyzing"), [simulations]);

  // Warn before leaving while a run is in progress, because the run lives in this tab.
  useEffect(() => {
    if (!running.length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running.length]);

  const active = NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href))) ?? NAV[0];
  const connected = ready && hasKey(settings);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[88px] shrink-0 flex-col items-center bg-white py-5">
        <Link href="/" aria-label="SUBS home">
          <Logo />
        </Link>
        <nav className="mt-24 flex flex-col gap-5" aria-label="Main">
          {NAV.map((n) => {
            const Icon = n.icon;
            const on = n === active;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-label={n.label}
                title={n.label}
                aria-current={on ? "page" : undefined}
                className={clsx(
                  "flex h-12 w-12 items-center justify-center rounded-xl transition",
                  on ? "bg-ink text-white" : "text-muted hover:bg-page hover:text-ink",
                )}
              >
                <Icon size={20} strokeWidth={2} />
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] items-center gap-4 bg-white px-8">
          <Link href="/" className="text-2xl font-semibold tracking-tight">
            SUBS
          </Link>
          <span className="text-sm text-muted">/ {active.label}</span>
          <div className="ml-auto flex items-center gap-4">
            {ready && running.length > 0 && (
              <Link href={`/simulations/${running[0].id}`} className="flex items-center gap-2 rounded-full bg-blue-soft px-3 py-1.5 text-xs font-semibold text-blue">
                <span className="pulse-dot h-2 w-2 rounded-full bg-blue" />
                {running.length === 1 ? "1 simulation running" : `${running.length} simulations running`}
              </Link>
            )}
            {ready && (
              <Link
                href="/settings"
                className={clsx(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
                  connected ? "bg-lime-soft text-good" : "bg-page text-muted",
                )}
              >
                <span className={clsx("h-2 w-2 rounded-full", connected ? "bg-good" : "bg-muted/60")} />
                {connected ? `Gemini · ${settings.model}` : "Add API key"}
              </Link>
            )}
            <span className="hidden text-sm text-muted sm:block">{ready ? fmtDate(Date.now()) : ""}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-soft text-xs font-bold text-blue" aria-hidden>
              {ready && settings.displayName ? initials(settings.displayName) : "SU"}
            </span>
          </div>
        </header>
        <main className="flex-1 px-6 py-9 md:px-10">
          <div className="mx-auto max-w-[1280px]">{ready ? children : null}</div>
        </main>
      </div>
    </div>
  );
}
