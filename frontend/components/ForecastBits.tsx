"use client";

import type { ForecastReliability } from "@/api";
import { useFormat, useLocale } from "@/lib/locale-context";

/** Text color for a signed change (green up, red down). */
export function changeToneClass(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "text-ink-700 dark:text-ink-200";
  return value > 0
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-red-700 dark:text-red-400";
}

/** "+1,2 %" / "-0,8 %" with the sign always shown. */
export function useSignedPercent() {
  const fmt = useFormat();
  return (value: number | null | undefined, digits = 1) => {
    if (value == null || !Number.isFinite(value)) return fmt.formatPercent(null);
    const sign = value > 0 ? "+" : "";
    return `${sign}${fmt.formatPercent(value, digits)}`;
  };
}

export function SignedPercent({ value, digits = 1 }: { value: number | null; digits?: number }) {
  const format = useSignedPercent();
  return <span className={`tabular-nums ${changeToneClass(value)}`}>{format(value, digits)}</span>;
}

const RELIABILITY_CLASS: Record<ForecastReliability, string> = {
  elevee: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  moyenne: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  faible: "bg-red-500/10 text-red-700 ring-red-500/30 dark:text-red-300",
};

export function ReliabilityBadge({ value }: { value: ForecastReliability | null | undefined }) {
  const { t } = useLocale();
  if (!value) return <span className="text-ink-500">{t("common.emDash")}</span>;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${RELIABILITY_CLASS[value]}`}
    >
      {t(`forecast.reliability.${value}`)}
    </span>
  );
}
