"use client";

import type { ReactNode } from "react";
import type { MetricTone } from "@/components/ui/MetricCard";
import {
  DatasetInfoButton,
  type DatasetSourceInfo,
} from "@/components/ui/DatasetInfoButton";

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
  title?: string;
  description?: string;
  sourceInfo?: DatasetSourceInfo;
  /** Accessible label for the info button when `title` is omitted. */
  infoTitle?: string;
  sourceInfoPlacement?: "title" | "description";
  icon?: ReactNode;
  badge?: string;
  tone?: MetricTone;
  toolbar?: ReactNode;
  children: ReactNode;
};

export function DatasetCard({
  title,
  description,
  sourceInfo,
  infoTitle,
  sourceInfoPlacement = "title",
  icon,
  badge,
  tone = "dvf",
  toolbar,
  children,
}: Props) {
  const styles = toneStyles[tone];
  const infoLabel = infoTitle ?? title ?? "";
  const showTitle = Boolean(title);
  const infoBesideDescription = sourceInfoPlacement === "description";

  return (
    <article className={`relative h-full hp-card-sm ${styles.ring}`}>
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] bg-gradient-to-br ${styles.glow} opacity-80`}
        aria-hidden
      />
      <div className="relative flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}
              >
                {icon}
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              {showTitle ? (
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-display text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-50">
                    {title}
                  </h2>
                  {sourceInfo && !infoBesideDescription ? (
                    <DatasetInfoButton title={infoLabel} source={sourceInfo} />
                  ) : null}
                </div>
              ) : null}
              {description ? (
                <div
                  className={`flex items-start gap-2 ${showTitle ? "mt-1" : ""}`}
                >
                  <p className="min-w-0 flex-1 text-sm leading-snug text-ink-600 dark:text-ink-300">
                    {description}
                  </p>
                  {sourceInfo && infoBesideDescription ? (
                    <DatasetInfoButton title={infoLabel} source={sourceInfo} />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {badge ? (
            <span className="shrink-0 rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-500/20 dark:text-brand-300">
              {badge}
            </span>
          ) : null}
        </div>
        {toolbar ? <div className="mt-3">{toolbar}</div> : null}
        <div className="mt-4 grid flex-1 grid-cols-2 gap-x-3 gap-y-3">{children}</div>
      </div>
    </article>
  );
}
