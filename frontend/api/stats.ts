import { apiGet } from "./client";
import type {
  CityEquipmentSummaryRow,
  CityHousingSummaryRow,
  CitySocialSummaryRow,
  CommuneRankingRow,
  IrisSocialSummaryRow,
  OpportunityScoreRow,
  TransactionSummary,
} from "./types";

export function fetchTransactionSummary(params: {
  code_commune?: string;
  from?: string;
  to?: string;
  type_local?: string;
}): Promise<TransactionSummary> {
  return apiGet<TransactionSummary>("/stats/transaction-summary", params);
}

export function fetchCityHousingSummary(params: {
  code_commune?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<CityHousingSummaryRow[]> {
  return apiGet<CityHousingSummaryRow[]>("/stats/city-housing-summary", params);
}

export function fetchCityEquipmentSummary(params: {
  code_commune?: string;
  limit?: number;
}): Promise<CityEquipmentSummaryRow[]> {
  return apiGet<CityEquipmentSummaryRow[]>("/stats/city-equipment-summary", params);
}

export function fetchCitySocialSummary(params: {
  code_commune?: string;
  sort_by?: "median_income_eur";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}): Promise<CitySocialSummaryRow[]> {
  return apiGet<CitySocialSummaryRow[]>("/stats/city-social-summary", params);
}

export function fetchCitySocialSummaryCount(params: {
  code_commune?: string;
  sort_by?: "median_income_eur";
}): Promise<{ count: number }> {
  return apiGet<{ count: number }>("/stats/city-social-summary/count", params);
}

export function fetchIrisSocialSummary(params: {
  code_commune?: string;
  code_iris?: string;
  limit?: number;
}): Promise<IrisSocialSummaryRow[]> {
  return apiGet<IrisSocialSummaryRow[]>("/stats/iris-social-summary", params);
}

export function fetchOpportunityScore(params: {
  code_commune?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<OpportunityScoreRow[]> {
  return apiGet<OpportunityScoreRow[]>("/stats/opportunity-score", params);
}

export function fetchCommuneRanking(params: {
  metric:
    | "median_income_eur"
    | "composite_score"
    | "social_mix_score"
    | "quality_of_life_score"
    | "price_median_per_sqm"
    | "personalized";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  /** Personalized metric only — user's price/social/quality weights (0-1). */
  w_price?: number;
  w_social?: number;
  w_quality?: number;
}): Promise<CommuneRankingRow[]> {
  return apiGet<CommuneRankingRow[]>("/stats/commune-ranking", params);
}

export function fetchCommuneRankingCount(params: {
  metric:
    | "median_income_eur"
    | "composite_score"
    | "social_mix_score"
    | "quality_of_life_score"
    | "price_median_per_sqm"
    | "personalized";
}): Promise<{ count: number }> {
  return apiGet<{ count: number }>("/stats/commune-ranking/count", params);
}
