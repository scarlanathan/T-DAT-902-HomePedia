"use client";

import type { TransactionRow } from "@/api";
import { parseNumeric } from "@/lib/format";
import { useFormat, useLocale } from "@/lib/locale-context";

type Props = {
  rows: TransactionRow[];
  loading?: boolean;
};

export function TransactionsTable({ rows, loading }: Props) {
  const { t } = useLocale();
  const fmt = useFormat();

  if (loading) {
    return (
      <div className="h-40 animate-pulse rounded-xl bg-ink-100 dark:bg-ink-800" aria-busy="true" />
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-700 dark:text-ink-300">
        {t("transactions.empty")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-200 shadow-sm dark:border-ink-700">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
          <tr>
            <th className="px-3 py-2">{t("transactions.date")}</th>
            <th className="px-3 py-2">{t("transactions.type")}</th>
            <th className="px-3 py-2">{t("transactions.price")}</th>
            <th className="px-3 py-2">{t("transactions.euroPerSqm")}</th>
            <th className="px-3 py-2">{t("transactions.surface")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => (
            <tr
              key={tx.transaction_id}
              className="border-b border-ink-100 last:border-0 dark:border-ink-800"
            >
              <td className="px-3 py-2 tabular-nums text-ink-900 dark:text-ink-50">
                {tx.date_mutation?.slice(0, 10) ?? t("common.emDash")}
              </td>
              <td className="px-3 py-2 text-ink-700 dark:text-ink-300">
                {fmt.formatPropertyType(tx.type_local)}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {fmt.formatEuro(parseNumeric(tx.valeur_fonciere))}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {fmt.formatEuro(parseNumeric(tx.price_per_sqm_built))}
              </td>
              <td className="px-3 py-2 tabular-nums text-ink-700">
                {tx.surface_reelle_bati
                  ? `${parseNumeric(tx.surface_reelle_bati) ?? tx.surface_reelle_bati} ${t("common.squareMeters")}`
                  : t("common.emDash")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
