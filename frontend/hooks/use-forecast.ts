"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  fetchForecastMap,
  fetchForecastModel,
  fetchForecastRanking,
  fetchForecastSeries,
  listDepartments,
  listRegions,
} from "@/api";
import type {
  DepartmentRow,
  ForecastHorizon,
  ForecastLevel,
  ForecastMapRow,
  ForecastModelResponse,
  ForecastPropertyType,
  ForecastRankingRow,
  ForecastScenario,
  ForecastSeriesResponse,
  RegionRow,
} from "@/api";
import type { MessageKey } from "@/lib/i18n";

type AsyncState<T> = {
  data: T;
  loading: boolean;
  error: MessageKey | null;
};

/** Model card, scenario hypotheses and backtest (`/forecast/model`). */
export function useForecastModel(): AsyncState<ForecastModelResponse | null> {
  const [data, setData] = useState<ForecastModelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchForecastModel()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError("forecast.errors.model");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}

type SeriesParams = {
  level: ForecastLevel;
  /** Required unless level is "france"; when missing, nothing is fetched. */
  code?: string | null;
  propertyType: ForecastPropertyType;
};

/** History + forecast for one area. A 404 is reported as `notFound`, not an error. */
export function useForecastSeries({ level, code, propertyType }: SeriesParams) {
  const [data, setData] = useState<ForecastSeriesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [notFound, setNotFound] = useState(false);
  const enabled = level === "france" || Boolean(code);

  useEffect(() => {
    setData(null);
    setNotFound(false);
    setError(null);
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchForecastSeries({
      level,
      code: level === "france" ? undefined : (code ?? undefined),
      property_type: propertyType,
    })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError("forecast.errors.series");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, level, code, propertyType]);

  return { data, loading, error, notFound };
}

type MapParams = {
  scenario: ForecastScenario;
  propertyType: ForecastPropertyType;
  horizon: ForecastHorizon;
  level?: "departement" | "region";
};

/** Forecast change per département (or région) for the choropleth. */
export function useForecastMap({
  scenario,
  propertyType,
  horizon,
  level = "departement",
}: MapParams): AsyncState<ForecastMapRow[]> {
  const [data, setData] = useState<ForecastMapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchForecastMap({ level, scenario, property_type: propertyType, horizon })
      .then((rows) => {
        if (!cancelled) setData(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setData([]);
          setError("forecast.errors.map");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [level, scenario, propertyType, horizon]);

  return { data, loading, error };
}

type RankingParams = {
  level: "commune" | "departement";
  scenario: ForecastScenario;
  propertyType: ForecastPropertyType;
  horizon: ForecastHorizon;
  order: "asc" | "desc";
  limit?: number;
  codeDepartement?: string;
};

/** Top rises (order desc) or falls (order asc). */
export function useForecastRanking({
  level,
  scenario,
  propertyType,
  horizon,
  order,
  limit = 10,
  codeDepartement,
}: RankingParams): AsyncState<ForecastRankingRow[]> {
  const [data, setData] = useState<ForecastRankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);
  const deptFilter = level === "commune" ? codeDepartement : undefined;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchForecastRanking({
      level,
      scenario,
      property_type: propertyType,
      horizon,
      order,
      limit,
      code_departement: deptFilter,
    })
      .then((rows) => {
        if (!cancelled) setData(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setData([]);
          setError("forecast.errors.ranking");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [level, scenario, propertyType, horizon, order, limit, deptFilter]);

  return { data, loading, error };
}

/** Régions and départements for the area pickers. */
export function useForecastLocations() {
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listRegions(50).catch(() => [] as RegionRow[]),
      listDepartments({ limit: 200 }).catch(() => [] as DepartmentRow[]),
    ])
      .then(([r, d]) => {
        if (cancelled) return;
        setRegions(
          [...r].sort((a, b) =>
            (a.nom_region ?? a.code_region).localeCompare(b.nom_region ?? b.code_region, "fr"),
          ),
        );
        setDepartments(
          [...d].sort((a, b) => a.code_departement.localeCompare(b.code_departement)),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { regions, departments, loading };
}
