"use client";

import type { ReactNode } from "react";

export type MetricTone = "dvf" | "cog" | "social" | "equipment" | "opportunity";

const toneStyles: Record<
  MetricTone,
  { ring: string; icon: string; glow: string }
> = {
  dvf: {
    ring: "ring-brand-500/20",
    icon: "bg-brand-500/10 text-brand-600",
    glow: "from-brand-500/8 to-transparent",
  },
  cog: {
    ring: "ring-slate-500/15",
    icon: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    glow: "from-slate-500/8 to-transparent",
  },
  social: {
    ring: "ring-cyan-500/20",
    icon: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    glow: "from-cyan-500/8 to-transparent",
  },
  equipment: {
    ring: "ring-emerald-500/20",
    icon: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    glow: "from-emerald-500/8 to-transparent",
  },
  opportunity: {
    ring: "ring-violet-500/20",
    icon: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    glow: "from-violet-500/8 to-transparent",
  },
};

type Props = {
  label: string;
  value: string;
  hint: string;
  tone?: MetricTone;
  icon?: ReactNode;
  loading?: boolean;
  highlight?: boolean;
};

export function MetricCard({
  label,
  value,
  hint,
  tone = "dvf",
  icon,
  loading,
  highlight,
}: Props) {
  const styles = toneStyles[tone];

  return (
    <article
      className={`group relative w-full overflow-hidden hp-card p-5 sm:p-6 ${styles.ring}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.glow} opacity-80`}
        aria-hidden
      />
      <div className="relative flex items-center gap-4 sm:gap-5">
        {icon ? (
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14 ${styles.icon}`}
          >
            <span className="scale-110">{icon}</span>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-600 dark:text-ink-300 sm:text-base">
            {label}
          </p>
          <p
            className={`mt-2 font-bold tabular-nums tracking-tight text-ink-900 dark:text-ink-50 ${
              highlight ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"
            } ${loading ? "animate-pulse text-ink-400" : ""}`}
          >
            {value}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300 sm:text-base">
            {hint}
          </p>
        </div>
      </div>
    </article>
  );
}
