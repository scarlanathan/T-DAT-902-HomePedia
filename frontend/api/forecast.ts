import { apiGet } from "./client";
import type {
  ForecastHorizon,
  ForecastLevel,
  ForecastMapRow,
  ForecastModelResponse,
  ForecastPropertyType,
  ForecastRankingRow,
  ForecastScenario,
  ForecastSeriesResponse,
} from "./types";

export function fetchForecastModel(): Promise<ForecastModelResponse> {
  return apiGet<ForecastModelResponse>("/forecast/model");
}

export function fetchForecastSeries(params: {
  level: ForecastLevel;
  /** Optional when level is "france" (defaults to "FR" server side). */
  code?: string;
  property_type?: ForecastPropertyType;
}): Promise<ForecastSeriesResponse> {
  return apiGet<ForecastSeriesResponse>("/forecast/series", params);
}

export function fetchForecastMap(params: {
  level: "departement" | "region";
  scenario?: ForecastScenario;
  property_type?: ForecastPropertyType;
  horizon?: ForecastHorizon;
}): Promise<ForecastMapRow[]> {
  return apiGet<ForecastMapRow[]>("/forecast/map", params);
}

export function fetchForecastRanking(params: {
  level: "commune" | "departement";
  scenario?: ForecastScenario;
  property_type?: ForecastPropertyType;
  horizon?: ForecastHorizon;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  code_departement?: string;
  min_annual_sales?: number;
}): Promise<ForecastRankingRow[]> {
  return apiGet<ForecastRankingRow[]>("/forecast/ranking", params);
}
