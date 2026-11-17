"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Outcome, SimulationStatus } from "@/lib/engine/types";
import { initials } from "@/lib/format";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-2xl border border-line bg-white p-6", className)}>{children}</div>;
}

export function DarkCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-2xl bg-ink p-6 text-white", className)}>{children}</div>;
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-soft",
  secondary: "border border-line bg-white text-ink hover:bg-page",
  danger: "bg-bad text-white hover:opacity-90",
  ghost: "text-ink hover:bg-page",
};
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...props} className={clsx(buttonBase, variants[variant], className)} />;
}

export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={clsx(buttonBase, variants[variant], className)}>
      {children}
    </Link>
  );
}

type Tone = "good" | "warn" | "bad" | "info" | "neutral";
const tones: Record<Tone, string> = {
  good: "bg-lime-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-blue-soft text-blue",
  neutral: "bg-page text-muted",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome?: Outcome | "queued" | "running" }) {
  const map: Record<string, [Tone, string]> = {
    completed: ["good", "Completed"],
    abandoned: ["warn", "Abandoned"],
    timeout: ["neutral", "Step limit"],
    error: ["bad", "Error"],
    running: ["info", "Running"],
    queued: ["neutral", "Queued"],
  };
  const [tone, label] = map[outcome ?? "queued"];
  return <Badge tone={tone}>{label}</Badge>;
}

export function StatusBadge({ status }: { status: SimulationStatus }) {
  const map: Record<SimulationStatus, [Tone, string]> = {
    queued: ["neutral", "Queued"],
    running: ["info", "Running"],
    analyzing: ["info", "Analysing"],
    completed: ["good", "Completed"],
    failed: ["bad", "Failed"],
    cancelled: ["neutral", "Cancelled"],
  };
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[34px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none";

export function Toggle({
  checked,
  onChange,
  label,
  tone = "blue",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  tone?: "blue" | "lime";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-medium",
        tone === "blue" ? "bg-blue-soft" : "bg-lime-soft",
      )}
    >
      <span
        className={clsx(
          "relative h-5 w-9 shrink-0 rounded-full transition",
          checked ? (tone === "blue" ? "bg-blue" : "bg-good") : "bg-muted/40",
        )}
      >
        <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      {text && <p className="mx-auto mt-2 max-w-xl text-[15px] text-muted">{text}</p>}
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  note,
  dark,
  noteTone = "good",
}: {
  label: string;
  value: string;
  note?: string;
  dark?: boolean;
  noteTone?: "good" | "muted";
}) {
  return (
    <div className={clsx("rounded-2xl p-6", dark ? "bg-ink text-white" : "border border-line bg-white")}>
      <div className={clsx("text-sm", dark ? "text-white/80" : "text-muted")}>{label}</div>
      <div className="mt-2 text-[40px] font-semibold leading-none tracking-tight">{value}</div>
      {note && (
        <div className={clsx("mt-3 text-sm", dark ? "text-lime" : noteTone === "good" ? "text-good" : "text-muted")}>{note}</div>
      )}
    </div>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-blue-soft font-bold text-blue"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function TraitBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted">{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-page">
        <div className="h-2 rounded-full bg-ink" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function Slider({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm font-semibold">
        <span>{label}</span>
        <span className="tabular-nums text-muted">{value}</span>
      </span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl bg-white p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <div className="mt-3 text-[15px] text-muted">{children}</div>
      </div>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "bad"; children: ReactNode }) {
  const cls = tone === "info" ? "bg-blue-soft text-ink" : tone === "warn" ? "bg-warn-soft text-ink" : "bg-bad-soft text-bad";
  return <div className={clsx("rounded-xl px-4 py-3 text-sm", cls)}>{children}</div>;
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={clsx(
            "min-w-[150px] rounded-xl px-5 py-3 text-sm font-semibold transition",
            value === o.id ? "bg-ink text-white" : "border border-line bg-white hover:bg-page",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
