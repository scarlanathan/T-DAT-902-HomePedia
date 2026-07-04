"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  fetchCityEquipmentSummary,
  fetchCityHousingSummary,
  fetchCitySocialSummary,
  fetchHealth,
  fetchIrisSocialSummary,
  fetchLocation,
  fetchOpportunityScore,
  fetchTransactions,
  type CityEquipmentSummaryRow,
  type CityHousingSummaryRow,
  type CitySocialSummaryRow,
  type HealthResponse,
  type IrisSocialSummaryRow,
  type LocationRow,
  type OpportunityScoreRow,
  type TransactionRow,
} from "@/api";
import type { DashboardFilters } from "@/lib/filters";
import { communeQueryKey, hasCommuneSelected } from "@/lib/filters";

export type DashboardData = {
  health: HealthResponse | null;
  location: LocationRow | null;
  housingSummary: CityHousingSummaryRow[];
  transactions: TransactionRow[];
  equipmentSummary: CityEquipmentSummaryRow | null;
  socialSummary: CitySocialSummaryRow | null;
  irisSocialSummary: IrisSocialSummaryRow[];
  opportunityScore: OpportunityScoreRow | null;
};

export type DashboardLoadState = {
  loading: boolean;
  error: string | null;
  apiReachable: boolean;
};

const empty: DashboardData = {
  health: null,
  location: null,
  housingSummary: [],
  transactions: [],
  equipmentSummary: null,
  socialSummary: null,
  irisSocialSummary: [],
  opportunityScore: null,
};

export function useDashboardData(filters: DashboardFilters) {
  const [data, setData] = useState<DashboardData>(empty);
  const [state, setState] = useState<DashboardLoadState>({
    loading: true,
    error: null,
    apiReachable: true,
  });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const queryKey = communeQueryKey(filters);

  const reload = useCallback(async () => {
    const filters = filtersRef.current;
    const key = communeQueryKey(filters);
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const health = await fetchHealth().catch(() => null);

      if (!hasCommuneSelected(filters)) {
        if (communeQueryKey(filters) !== key) return;
        setData({ ...empty, health });
        setState({
          loading: false,
          error: null,
          apiReachable: health !== null,
        });
        return;
      }

      const query = {
        code_commune: filters.codeCommune,
        from: filters.from || undefined,
        to: filters.to || undefined,
      };

      const [
        location,
        housingSummary,
        transactions,
        equipmentRows,
        socialRows,
        irisRows,
        opportunityRows,
      ] = await Promise.all([
        fetchLocation(filters.codeCommune),
        fetchCityHousingSummary({ ...query, limit: 500 }),
        fetchTransactions({ ...query, limit: 50, include_location: true }),
        fetchCityEquipmentSummary({ code_commune: filters.codeCommune, limit: 1 }),
        fetchCitySocialSummary({ code_commune: filters.codeCommune, limit: 1 }),
        fetchIrisSocialSummary({ code_commune: filters.codeCommune, limit: 50 }),
        fetchOpportunityScore({ ...query, limit: 1 }),
      ]);

      if (communeQueryKey(filters) !== key) return;

      setData({
        health,
        location,
        housingSummary,
        transactions,
        equipmentSummary: equipmentRows[0] ?? null,
        socialSummary: socialRows[0] ?? null,
        irisSocialSummary: irisRows,
        opportunityScore: opportunityRows[0] ?? null,
      });
      setState({
        loading: false,
        error: null,
        apiReachable: health !== null,
      });
    } catch (e) {
      if (communeQueryKey(filters) !== key) return;
      const message =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not load dashboard data";
      setData(empty);
      setState({
        loading: false,
        error: message,
        apiReachable: !(e instanceof TypeError),
      });
    }
  }, [queryKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, state, reload };
}
