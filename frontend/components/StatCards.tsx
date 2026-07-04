"use client";

import { DatasetCard } from "@/components/ui/DatasetCard";
import { MetricRow } from "@/components/ui/MetricRow";
import { inputClassName, labelClassName } from "@/components/ui/field-styles";
import { IconChart } from "@/components/ui/icons";
import { parseNumeric } from "@/lib/format";
import type { DashboardFilters } from "@/lib/filters";
import type { TransactionSummary } from "@/api";
import { useFormat, useLocale } from "@/lib/locale-context";

type Props = {
  summary: TransactionSummary | null;
  loading?: boolean;
  typeLocal?: DashboardFilters["typeLocal"];
  onTypeLocalChange?: (typeLocal: DashboardFilters["typeLocal"]) => void;
};

export function StatCards({
  summary,
  loading,
  typeLocal = "",
  onTypeLocalChange,
}: Props) {
  const { t } = useLocale();
  const fmt = useFormat();
  const count = parseNumeric(summary?.transaction_count);
  const medianPrice = parseNumeric(summary?.median_valeur_fonciere);
  const medianM2 = parseNumeric(summary?.median_price_per_sqm_built);

  const items = [
    {
      label: t("dvf.transactions"),
      value: loading
        ? t("common.ellipsis")
        : count != null
          ? fmt.formatFrNumber(count)
          : t("common.emDash"),
      info: t("dvf.infoTransactions"),
      hint: t("dvf.hintTransactions"),
    },
    {
      label: t("dvf.medianSalePrice"),
      value: loading ? t("common.ellipsis") : fmt.formatEuro(medianPrice),
      info: t("dvf.infoMedianSalePrice"),
      hint: t("dvf.hintMedianSalePrice"),
    },
    {
      label: t("dvf.medianPricePerSqm"),
      value: loading ? t("common.ellipsis") : fmt.formatEuro(medianM2),
      info: t("dvf.infoMedianPricePerSqm"),
      hint: t("dvf.hintMedianPricePerSqm"),
    },
    {
      label: t("dvf.dateRange"),
      value: loading
        ? t("common.ellipsis")
        : summary?.min_date_mutation && summary?.max_date_mutation
          ? `${summary.min_date_mutation.slice(0, 10)} → ${summary.max_date_mutation.slice(0, 10)}`
          : t("common.emDash"),
      info: t("dvf.infoDateRange"),
      hint: t("dvf.hintDateRange"),
    },
  ];

  return (
    <DatasetCard
      title={t("dvf.title")}
      description={t("dvf.description")}
      sourceInfo={{
        name: t("dvf.sourceName"),
        about: t("dvf.sourceAbout"),
      }}
      icon={<IconChart />}
      badge={t("dvf.badge")}
      tone="dvf"
      toolbar={
        onTypeLocalChange ? (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className={labelClassName}>{t("dvf.propertyType")}</span>
            <select
              className={inputClassName}
              value={typeLocal}
              onChange={(e) =>
                onTypeLocalChange(e.target.value as DashboardFilters["typeLocal"])
              }
            >
              <option value="">{t("dvf.allTypes")}</option>
              <option value="Appartement">{t("propertyType.Appartement")}</option>
              <option value="Maison">{t("propertyType.Maison")}</option>
            </select>
          </label>
        ) : null
      }
    >
      {items.map((item) => (
        <MetricRow
          key={item.label}
          label={item.label}
          value={item.value}
          hint={item.hint}
          info={item.info}
          loading={loading}
        />
      ))}
    </DatasetCard>
  );
}
