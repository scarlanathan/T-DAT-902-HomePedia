"use client";

import { DatasetCard } from "@/components/ui/DatasetCard";
import { MetricRow } from "@/components/ui/MetricRow";
import { IconSparkles } from "@/components/ui/icons";
import type {
  CitySocialSummaryRow,
  OpportunityScoreRow,
  TransactionSummary,
} from "@/api";
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
import {
  buildInequalityHint,
  buildInequalityInfo,
  formatInequalityRatio,
} from "@/lib/social-metrics";
import { useFormat, useLocale } from "@/lib/locale-context";

type Props = {
  communeName: string;
  social: CitySocialSummaryRow | null;
  irisCount?: number;
  dvf: TransactionSummary | null;
  opportunity: OpportunityScoreRow | null;
  loading?: boolean;
};

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="col-span-2 border-t border-ink-200/80 pt-3 first:border-t-0 first:pt-0 dark:border-ink-700/80">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
        {children}
      </h3>
    </div>
  );
}

export function RankingCommuneStatsCard({
  communeName,
  social,
  irisCount = 0,
  dvf,
  opportunity,
  loading = false,
}: Props) {
  const { t } = useLocale();
  const fmt = useFormat();
  const inequalityRatio = parseNumeric(social?.inequality_ratio);
  const count = parseNumeric(dvf?.transaction_count);
  const medianPrice = parseNumeric(dvf?.median_valeur_fonciere);
  const medianM2 = parseNumeric(dvf?.median_price_per_sqm_built);
  const composite = parseNumeric(opportunity?.composite_score);
  const priceScore = parseNumeric(opportunity?.price_score);
  const socialMixScore = parseNumeric(opportunity?.social_mix_score);
  const medianIncome = parseOptional(opportunity?.median_income_eur);
  const povertyRate = parseNumeric(opportunity?.poverty_rate);
  const medianPricePerSqm = parseOptional(opportunity?.price_median_per_sqm);
  const qualityScore = parseNumeric(opportunity?.quality_of_life_score);
  const equipmentCount = parseOptional(opportunity?.equipment_density);

  return (
    <DatasetCard
      title={communeName}
      description={t("ranking.communeStatsDescription")}
      sourceInfo={{
        name: t("ranking.communeStatsSourceName"),
        about: t("ranking.communeStatsSourceAbout"),
      }}
      icon={<IconSparkles />}
      tone="opportunity"
    >
      <SectionLabel>{t("ranking.sectionSocial")}</SectionLabel>
      <MetricRow
        label={t("social.medianIncome")}
        value={
          loading
            ? t("common.ellipsis")
            : fmt.formatEuro(parseNumeric(social?.median_income_eur))
        }
        info={t("social.infoMedianIncome")}
        hint={t("social.hintMedianIncome")}
        loading={loading}
      />
      <MetricRow
        label={t("social.povertyRate")}
        value={
          loading
            ? t("common.ellipsis")
            : fmt.formatPercent(parseNumeric(social?.poverty_rate))
        }
        info={t("social.infoPovertyRate")}
        hint={t("social.hintPovertyRate")}
        loading={loading}
      />
      <MetricRow
        label={t("social.inequality")}
        value={
          loading
            ? t("common.ellipsis")
            : formatInequalityRatio(inequalityRatio, fmt)
        }
        info={buildInequalityInfo(
          inequalityRatio,
          social?.income_d1_eur,
          social?.income_d9_eur,
          t,
          fmt,
        )}
        hint={buildInequalityHint(
          inequalityRatio,
          social?.income_d1_eur,
          social?.income_d9_eur,
          t,
          fmt,
        )}
        loading={loading}
      />
      <MetricRow
        label={t("social.cafBeneficiaries")}
        value={
          loading
            ? t("common.ellipsis")
            : fmt.formatPercent(parseNumeric(social?.caf_beneficiary_share))
        }
        info={
          irisCount > 0
            ? `${t("social.infoCafBeneficiaries")} ${irisCount === 1 ? t("social.infoIrisOne", { count: irisCount }) : t("social.infoIrisMany", { count: irisCount })}`
            : t("social.infoCafBeneficiaries")
        }
        hint={
          irisCount > 0
            ? irisCount === 1
              ? t("social.hintIrisOne", { count: irisCount })
              : t("social.hintIrisMany", { count: irisCount })
            : t("social.hintCafBeneficiaries")
        }
        loading={loading}
      />

      <SectionLabel>{t("ranking.sectionHousing")}</SectionLabel>
      <MetricRow
        label={t("dvf.transactions")}
        value={
          loading
            ? t("common.ellipsis")
            : count != null
              ? fmt.formatFrNumber(count)
              : t("common.emDash")
        }
        info={t("dvf.infoTransactions")}
        hint={t("dvf.hintTransactions")}
        loading={loading}
      />
      <MetricRow
        label={t("dvf.medianSalePrice")}
        value={loading ? t("common.ellipsis") : fmt.formatEuro(medianPrice)}
        info={t("dvf.infoMedianSalePrice")}
        hint={t("dvf.hintMedianSalePrice")}
        loading={loading}
      />
      <MetricRow
        label={t("dvf.medianPricePerSqm")}
        value={loading ? t("common.ellipsis") : fmt.formatEuro(medianM2)}
        info={t("dvf.infoMedianPricePerSqm")}
        hint={t("dvf.hintMedianPricePerSqm")}
        loading={loading}
      />
      <MetricRow
        label={t("dvf.dateRange")}
        value={
          loading
            ? t("common.ellipsis")
            : dvf?.min_date_mutation && dvf?.max_date_mutation
              ? `${dvf.min_date_mutation.slice(0, 10)} → ${dvf.max_date_mutation.slice(0, 10)}`
              : t("common.emDash")
        }
        info={t("dvf.infoDateRange")}
        hint={t("dvf.hintDateRange")}
        loading={loading}
      />

      <SectionLabel>{t("ranking.sectionOpportunity")}</SectionLabel>
      <MetricRow
        label={t("opportunity.composite")}
        value={
          loading
            ? t("common.ellipsis")
            : composite != null
              ? t("opportunity.scoreOutOf", { score: fmt.formatScore(composite) })
              : t("common.emDash")
        }
        info={t("opportunity.infoComposite")}
        hint={t("opportunity.hintComposite")}
        loading={loading}
        highlight
      />
      <MetricRow
        label={t("opportunity.price")}
        value={
          loading
            ? t("common.ellipsis")
            : priceScore != null
              ? t("opportunity.scoreOutOf", { score: fmt.formatScore(priceScore) })
              : t("common.emDash")
        }
        info={buildPriceInfo(medianPricePerSqm, t, fmt)}
        hint={buildPriceHint(t)}
        loading={loading}
      />
      <MetricRow
        label={t("opportunity.socialMix")}
        value={
          loading
            ? t("common.ellipsis")
            : socialMixScore != null
              ? t("opportunity.scoreOutOf", {
                  score: fmt.formatScore(socialMixScore),
                })
              : t("common.emDash")
        }
        info={buildSocialMixInfo(medianIncome, povertyRate, t, fmt)}
        hint={buildSocialMixHint(t)}
        loading={loading}
      />
      <MetricRow
        label={t("opportunity.qualityOfLife")}
        value={
          loading
            ? t("common.ellipsis")
            : qualityScore != null
              ? t("opportunity.scoreOutOf", {
                  score: fmt.formatScore(qualityScore),
                })
              : t("common.emDash")
        }
        info={buildAmenitiesInfo(equipmentCount, t, fmt)}
        hint={buildAmenitiesHint(t)}
        loading={loading}
      />
    </DatasetCard>
  );
}
