import type { MessageKey } from "@/lib/i18n";
import { parseNumeric } from "@/lib/format";

export const PAGE_SIZE_OPTIONS = [50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const RANKING_METRICS = [
  "personalized",
  "median_income_eur",
  "composite_score",
  "social_mix_score",
  "quality_of_life_score",
  "price_median_per_sqm",
] as const;

export type RankingMetric = (typeof RANKING_METRICS)[number];

export const DEFAULT_RANKING_METRIC: RankingMetric = "median_income_eur";

export const RANKING_METRIC_OPTION_KEYS: Record<
  RankingMetric,
  MessageKey
> = {
  personalized: "ranking.metricPersonalized",
  median_income_eur: "ranking.metricMedianIncome",
  composite_score: "ranking.metricComposite",
  social_mix_score: "ranking.metricSocialMix",
  quality_of_life_score: "ranking.metricAmenities",
  price_median_per_sqm: "ranking.metricPricePerSqm",
};

export const RANKING_METRIC_TITLE_KEYS: Record<RankingMetric, MessageKey> = {
  personalized: "ranking.titlePersonalized",
  median_income_eur: "ranking.medianIncomeTitle",
  composite_score: "ranking.titleComposite",
  social_mix_score: "ranking.titleSocialMix",
  quality_of_life_score: "ranking.titleAmenities",
  price_median_per_sqm: "ranking.titlePricePerSqm",
};

export const RANKING_METRIC_DESCRIPTION_KEYS: Record<RankingMetric, MessageKey> =
  {
    personalized: "ranking.descPersonalized",
    median_income_eur: "ranking.medianIncomeDescription",
    composite_score: "ranking.descComposite",
    social_mix_score: "ranking.descSocialMix",
    quality_of_life_score: "ranking.descAmenities",
    price_median_per_sqm: "ranking.descPricePerSqm",
  };

export const RANKING_METRIC_COLUMN_KEYS: Record<RankingMetric, MessageKey> = {
  personalized: "ranking.columnPersonalized",
  median_income_eur: "ranking.medianIncome",
  composite_score: "ranking.columnComposite",
  social_mix_score: "ranking.columnSocialMix",
  quality_of_life_score: "ranking.columnAmenities",
  price_median_per_sqm: "ranking.columnPricePerSqm",
};

const SCORE_METRICS = new Set<RankingMetric>([
  "personalized",
  "composite_score",
  "social_mix_score",
  "quality_of_life_score",
]);

export function formatRankingValue(
  metric: RankingMetric,
  value: string | null | undefined,
  fmt: {
    formatEuro: (n: number | null) => string;
    formatScore: (n: number | null) => string;
  },
  scoreOutOfTemplate: (score: string) => string,
  emDash: string,
): string {
  const parsed = parseNumeric(value);
  if (parsed == null) return emDash;

  if (SCORE_METRICS.has(metric)) {
    return scoreOutOfTemplate(fmt.formatScore(parsed));
  }

  return fmt.formatEuro(parsed);
}
