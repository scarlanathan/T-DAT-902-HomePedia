"use client";

import type { CommuneRankingRow } from "@/api";
import {
  formatRankingValue,
  RANKING_METRIC_COLUMN_KEYS,
  type RankingMetric,
} from "@/lib/ranking";
import { useFormat, useLocale } from "@/lib/locale-context";

type Props = {
  rows: CommuneRankingRow[];
  metric: RankingMetric;
  loading?: boolean;
  error?: string | null;
  offset?: number;
  selectedCodeCommune?: string;
  onSelect?: (row: CommuneRankingRow) => void;
};

export function CommuneRankingTable({
  rows,
  metric,
  loading,
  error,
  offset = 0,
  selectedCodeCommune,
  onSelect,
}: Props) {
  const { t } = useLocale();
  const fmt = useFormat();

  if (loading) {
    return (
      <div
        className="h-64 animate-pulse rounded-xl bg-ink-100 dark:bg-ink-800"
        aria-busy="true"
      />
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
    return (
      <p className="text-sm text-ink-700 dark:text-ink-300">
        {t("ranking.empty")}
      </p>
    );
  }

  const valueColumn = t(RANKING_METRIC_COLUMN_KEYS[metric]);

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-200 shadow-sm dark:border-ink-700">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
          <tr>
            <th className="px-3 py-2">{t("ranking.rank")}</th>
            <th className="px-3 py-2">{t("ranking.commune")}</th>
            <th className="px-3 py-2">{t("ranking.code")}</th>
            <th className="px-3 py-2 text-right">{valueColumn}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const selected = row.code_commune === selectedCodeCommune;
            return (
              <tr
                key={row.code_commune}
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
                <td className="px-3 py-2 tabular-nums text-ink-700 dark:text-ink-300">
                  {offset + index + 1}
                </td>
                <td className="px-3 py-2 font-medium text-ink-900 dark:text-ink-50">
                  {row.nom_commune ?? row.code_commune}
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-700 dark:text-ink-300">
                  {row.code_commune}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatRankingValue(
                    metric,
                    row.value,
                    fmt,
                    (score) => t("opportunity.scoreOutOf", { score }),
                    t("common.emDash"),
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
