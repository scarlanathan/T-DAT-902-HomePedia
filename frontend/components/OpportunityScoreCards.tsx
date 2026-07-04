"use client";

import { DatasetCard } from "@/components/ui/DatasetCard";
import { MetricRow } from "@/components/ui/MetricRow";
import { IconSparkles } from "@/components/ui/icons";
import type { OpportunityScoreRow, SearchPreferences } from "@/api";
import { parseNumeric } from "@/lib/format";
import {
  buildAmenitiesHint,
  buildAmenitiesInfo,
  buildPriceHint,
  buildPriceInfo,
  buildSocialMixHint,
  buildSocialMixInfo,
  parseOptional,
} from "@/lib/opportunity-metrics";
import { weightedComposite } from "@/lib/preferences";
import { useFormat, useLocale } from "@/lib/locale-context";

type Props = {
  row: OpportunityScoreRow | null;
  loading?: boolean;
  /** When set, the headline score is reweighted with the user's priorities. */
  weights?: SearchPreferences["weights"];
};

export function OpportunityScoreCards({ row, loading, weights }: Props) {
  const { t } = useLocale();
  const fmt = useFormat();
  const priceScore = parseNumeric(row?.price_score);
  const socialMixScore = parseNumeric(row?.social_mix_score);
  const qualityScore = parseNumeric(row?.quality_of_life_score);
  const medianIncome = parseOptional(row?.median_income_eur);
  const povertyRate = parseNumeric(row?.poverty_rate);

  const medianPricePerSqm = parseOptional(row?.price_median_per_sqm);
  const equipmentCount = parseOptional(row?.equipment_density);

  const personalized = weights
    ? weightedComposite(
        { price: priceScore, social: socialMixScore, quality: qualityScore },
        weights,
      )
    : null;
  const composite = personalized ?? parseNumeric(row?.composite_score);

  const items = [
    {
      label: personalized != null ? t("opportunity.compositePersonalized") : t("opportunity.composite"),
      value: loading
        ? t("common.ellipsis")
        : composite != null
          ? t("opportunity.scoreOutOf", { score: fmt.formatScore(composite) })
          : t("common.emDash"),
      info: t("opportunity.infoComposite"),
      hint: personalized != null ? t("opportunity.hintPersonalized") : t("opportunity.hintComposite"),
      highlight: true,
    },
    {
      label: t("opportunity.price"),
      value: loading
        ? t("common.ellipsis")
        : priceScore != null
          ? t("opportunity.scoreOutOf", { score: fmt.formatScore(priceScore) })
          : t("common.emDash"),
      info: buildPriceInfo(medianPricePerSqm, t, fmt),
      hint: buildPriceHint(t),
    },
    {
      label: t("opportunity.socialMix"),
      value: loading
        ? t("common.ellipsis")
        : socialMixScore != null
          ? t("opportunity.scoreOutOf", { score: fmt.formatScore(socialMixScore) })
          : t("common.emDash"),
      info: buildSocialMixInfo(medianIncome, povertyRate, t, fmt),
      hint: buildSocialMixHint(t),
    },
    {
      label: t("opportunity.qualityOfLife"),
      value: loading
        ? t("common.ellipsis")
        : qualityScore != null
          ? t("opportunity.scoreOutOf", { score: fmt.formatScore(qualityScore) })
          : t("common.emDash"),
      info: buildAmenitiesInfo(equipmentCount, t, fmt),
      hint: buildAmenitiesHint(t),
    },
  ];

  return (
    <DatasetCard
      title={t("opportunity.title")}
      description={t("opportunity.description")}
      sourceInfo={{
        name: t("opportunity.sourceName"),
        about: t("opportunity.sourceAbout"),
        detail: row?.period_month
          ? t("opportunity.sourcePeriod", {
              month: fmt.formatMonthLabel(row.period_month),
            })
          : undefined,
      }}
      icon={<IconSparkles />}
      tone="opportunity"
    >
      {items.map((item) => (
        <MetricRow
          key={item.label}
          label={item.label}
          value={item.value}
          hint={item.hint}
          info={item.info}
          loading={loading}
          highlight={item.highlight}
        />
      ))}
    </DatasetCard>
  );
}
