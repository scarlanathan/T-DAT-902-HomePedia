"use client";

import { useEffect, useState } from "react";
import { fetchCommuneRanking, fetchCommuneRankingCount } from "@/api";
import type { CommuneRankingRow } from "@/api";
import type { PageSize, RankingMetric } from "@/lib/ranking";

export type { PageSize } from "@/lib/ranking";

type UseCommuneRankingParams = {
  page: number;
  pageSize: PageSize;
  metric: RankingMetric;
  /** Weights applied when metric === "personalized". */
  weights?: { price: number; social: number; quality: number };
};

export function useCommuneRanking({
  page,
  pageSize,
  metric,
  weights,
}: UseCommuneRankingParams) {
  const [rows, setRows] = useState<CommuneRankingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wKey = weights
    ? `${weights.price}|${weights.social}|${weights.quality}`
    : "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const offset = (page - 1) * pageSize;
    const personalWeights =
      metric === "personalized" && weights
        ? {
            w_price: weights.price,
            w_social: weights.social,
            w_quality: weights.quality,
          }
        : {};

    void Promise.all([
      fetchCommuneRanking({
        metric,
        order: "desc",
        limit: pageSize,
        offset,
        ...personalWeights,
      }),
      fetchCommuneRankingCount({ metric }),
    ])
      .then(([data, { count }]) => {
        if (cancelled) return;
        setRows(data);
        setTotal(count);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setError("ranking.loadError");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, metric, wKey]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;

  return { rows, total, totalPages, offset, loading, error };
}
