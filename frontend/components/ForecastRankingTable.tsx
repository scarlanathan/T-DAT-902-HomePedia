"use client";

import type { ForecastRankingRow } from "@/api";
import type { MessageKey } from "@/lib/i18n";
import { parseNumeric } from "@/lib/format";
import { useFormat, useLocale } from "@/lib/locale-context";
import { ReliabilityBadge, SignedPercent } from "@/components/ForecastBits";

type Props = {
  rows: ForecastRankingRow[];
  loading?: boolean;
  error?: MessageKey | null;
  selectedCode?: string;
  onSelect?: (row: ForecastRankingRow) => void;
};

export function ForecastRankingTable({ rows, loading, error, selectedCode, onSelect }: Props) {
  const { t } = useLocale();
  const fmt = useFormat();

  if (loading) {
    return (
      <div className="h-64 animate-pulse rounded-xl bg-ink-100 dark:bg-ink-800" aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400" role="alert">
        {t(error)}
      </p>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-ink-700 dark:text-ink-300">{t("forecast.ranking.empty")}</p>;
  }

  const price = (v: string | null) =>
    fmt.formatFrNumber(parseNumeric(v), { maximumFractionDigits: 0 });

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-200 shadow-sm dark:border-ink-700">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">{t("forecast.ranking.area")}</th>
            <th className="px-3 py-2 text-right">{t("forecast.ranking.lastPrice")}</th>
            <th className="px-3 py-2 text-right">{t("forecast.ranking.forecastPrice")}</th>
            <th className="px-3 py-2 text-right">{t("forecast.ranking.change")}</th>
            <th className="hidden px-3 py-2 sm:table-cell">{t("forecast.ranking.reliability")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const selected = row.code === selectedCode;
            return (
              <tr
                key={`${row.level}-${row.code}`}
                className={`border-b border-ink-100 last:border-0 dark:border-ink-800 ${
                  onSelect
                    ? "cursor-pointer transition hover:bg-brand-50/60 dark:hover:bg-brand-950/20"
                    : ""
                } ${selected ? "bg-brand-50/80 dark:bg-brand-950/30" : ""}`}
                tabIndex={onSelect ? 0 : undefined}
                aria-selected={onSelect ? selected : undefined}
                onClick={onSelect ? () => onSelect(row) : undefined}
                onKeyDown={
                  onSelect
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(row);
                        }
                      }
                    : undefined
                }
              >
                <td className="px-3 py-2 tabular-nums text-ink-700 dark:text-ink-300">{index + 1}</td>
                <td className="px-3 py-2">
                  <span className="font-medium text-ink-900 dark:text-ink-50">{row.nom ?? row.code}</span>{" "}
                  <span className="text-xs tabular-nums text-ink-500">{row.code}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{price(row.last_price)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{price(row.forecast_price)}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  <SignedPercent value={parseNumeric(row.change_pct)} />
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  <ReliabilityBadge value={row.reliability} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
