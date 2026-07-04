"use client";

import type { LocationRow, TransactionSummary } from "@/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { IconMapPin } from "@/components/ui/icons";
import { communePostalCode } from "@/lib/commune-display";
import { parseNumeric } from "@/lib/format";
import { useFormat, useLocale } from "@/lib/locale-context";

type Props = {
  location: LocationRow | null;
  summary: TransactionSummary | null;
  loading?: boolean;
};

export function CommuneDetailPanel({ location, summary, loading }: Props) {
  const { t } = useLocale();
  const fmt = useFormat();

  if (loading) {
    return (
      <div
        className="h-56 animate-pulse rounded-2xl bg-gradient-to-br from-ink-100 to-ink-50 dark:from-ink-800 dark:to-ink-900"
        aria-busy="true"
      />
    );
  }

  if (!location) {
    return (
      <EmptyState icon={<IconMapPin />}>
        {t("communeDetail.empty")}
      </EmptyState>
    );
  }

  const count = parseNumeric(summary?.transaction_count);
  const postalMeta = t("communeDetail.postalMeta", {
    postal: communePostalCode(location),
    dept: location.code_departement
      ? t("communeDetail.dept", { code: location.code_departement })
      : "",
    region: location.code_region
      ? t("communeDetail.region", { code: location.code_region })
      : "",
    type: location.type_commune
      ? t("communeDetail.type", { code: location.type_commune })
      : "",
  });

  return (
    <Panel className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl"
        aria-hidden
      />
      <div className="relative">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          {t("communeDetail.selected")}
        </p>
        <h3 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50 sm:text-3xl">
          {location.nom_commune ?? t("common.commune")}
        </h3>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300 sm:text-base">
          {postalMeta}
        </p>
      </div>
      <dl className="relative mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-ink-50/80 px-3 py-2.5 ring-1 ring-ink-200/60 dark:bg-ink-800/80 dark:ring-ink-700/60">
          <dt className="text-sm font-semibold uppercase tracking-wide text-ink-600 dark:text-ink-300">
            {t("communeDetail.sales")}
          </dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-ink-900 dark:text-ink-50">
            {count != null ? fmt.formatFrNumber(count) : t("common.emDash")}
          </dd>
        </div>
        <div className="rounded-xl bg-ink-50/80 px-3 py-2.5 ring-1 ring-ink-200/60 dark:bg-ink-800/80 dark:ring-ink-700/60">
          <dt className="text-sm font-semibold uppercase tracking-wide text-ink-600 dark:text-ink-300">
            {t("communeDetail.medianSalePrice")}
          </dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-ink-900 dark:text-ink-50">
            {fmt.formatEuro(parseNumeric(summary?.median_valeur_fonciere))}
          </dd>
        </div>
        <div className="rounded-xl bg-brand-500/5 px-3 py-2.5 ring-1 ring-brand-500/15 dark:bg-brand-500/10 sm:col-span-2">
          <dt className="text-sm font-semibold uppercase tracking-wide text-ink-600 dark:text-ink-300">
            {t("communeDetail.medianPricePerSqm")}
          </dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums text-brand-700 dark:text-brand-300">
            {fmt.formatEuro(parseNumeric(summary?.median_price_per_sqm_built))}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}
