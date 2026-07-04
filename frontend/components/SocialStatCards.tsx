"use client";

import { DatasetCard } from "@/components/ui/DatasetCard";
import { MetricRow } from "@/components/ui/MetricRow";
import { IconUsers } from "@/components/ui/icons";
import type { CitySocialSummaryRow } from "@/api";
import { parseNumeric } from "@/lib/format";
import {
  buildInequalityHint,
  buildInequalityInfo,
  formatInequalityRatio,
} from "@/lib/social-metrics";
import { useFormat, useLocale } from "@/lib/locale-context";

type Props = {
  row: CitySocialSummaryRow | null;
  irisCount?: number;
  loading?: boolean;
};

export function SocialStatCards({ row, irisCount = 0, loading }: Props) {
  const { t } = useLocale();
  const fmt = useFormat();
  const inequalityRatio = parseNumeric(row?.inequality_ratio);

  const items = [
    {
      label: t("social.medianIncome"),
      value: loading ? t("common.ellipsis") : fmt.formatEuro(parseNumeric(row?.median_income_eur)),
      info: t("social.infoMedianIncome"),
      hint: t("social.hintMedianIncome"),
    },
    {
      label: t("social.povertyRate"),
      value: loading ? t("common.ellipsis") : fmt.formatPercent(parseNumeric(row?.poverty_rate)),
      info: t("social.infoPovertyRate"),
      hint: t("social.hintPovertyRate"),
    },
    {
      label: t("social.inequality"),
      value: loading
        ? t("common.ellipsis")
        : formatInequalityRatio(inequalityRatio, fmt),
      info: buildInequalityInfo(
        inequalityRatio,
        row?.income_d1_eur,
        row?.income_d9_eur,
        t,
        fmt,
      ),
      hint: buildInequalityHint(
        inequalityRatio,
        row?.income_d1_eur,
        row?.income_d9_eur,
        t,
        fmt,
      ),
    },
    {
      label: t("social.cafBeneficiaries"),
      value: loading
        ? t("common.ellipsis")
        : fmt.formatPercent(parseNumeric(row?.caf_beneficiary_share)),
      info:
        irisCount > 0
          ? `${t("social.infoCafBeneficiaries")} ${irisCount === 1 ? t("social.infoIrisOne", { count: irisCount }) : t("social.infoIrisMany", { count: irisCount })}`
          : t("social.infoCafBeneficiaries"),
      hint:
        irisCount > 0
          ? irisCount === 1
            ? t("social.hintIrisOne", { count: irisCount })
            : t("social.hintIrisMany", { count: irisCount })
          : t("social.hintCafBeneficiaries"),
    },
  ];

  return (
    <DatasetCard
      title={t("social.title")}
      description={t("social.description")}
      sourceInfo={{
        name: t("social.sourceName"),
        about: t("social.sourceAbout"),
        detail: row?.filosofi_millesime
          ? t("social.sourceVintage", { year: row.filosofi_millesime })
          : undefined,
      }}
      icon={<IconUsers />}
      tone="social"
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
