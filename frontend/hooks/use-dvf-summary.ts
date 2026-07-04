"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchTransactionSummary, type TransactionSummary } from "@/api";
import type { DashboardFilters } from "@/lib/filters";
import { filtersQueryKey, hasCommuneSelected } from "@/lib/filters";

type DvfSummaryParams = Pick<
  DashboardFilters,
  "codeCommune" | "from" | "to" | "typeLocal"
>;

export function useDvfSummary(params: DvfSummaryParams) {
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const queryKey = filtersQueryKey(params);

  const reload = useCallback(async () => {
    const params = paramsRef.current;
    const key = filtersQueryKey(params);

    if (!hasCommuneSelected(params)) {
      setSummary(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const summary = await fetchTransactionSummary({
        code_commune: params.codeCommune,
        from: params.from || undefined,
        to: params.to || undefined,
        type_local: params.typeLocal || undefined,
      });

      if (filtersQueryKey(params) !== key) return;

      setSummary(summary);
      setError(null);
    } catch (e) {
      if (filtersQueryKey(params) !== key) return;

      const message =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not load DVF summary";
      setSummary(null);
      setError(message);
    } finally {
      if (filtersQueryKey(params) === key) {
        setLoading(false);
      }
    }
  }, [queryKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { summary, loading, error, reload };
}
