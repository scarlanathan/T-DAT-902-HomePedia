"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { CommuneRankingRow } from "@/api";
import { fetchLocation } from "@/api";
import { CommuneRankingTable } from "@/components/CommuneRankingTable";
import { AppViewNav } from "@/components/AppViewNav";
import { RankingCommuneStatsCard } from "@/components/RankingCommuneStatsCard";
import { RankingPagination } from "@/components/RankingPagination";
import { DatasetCard } from "@/components/ui/DatasetCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClassName } from "@/components/ui/field-styles";
import { IconChart, IconMapPin } from "@/components/ui/icons";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useDvfSummary } from "@/hooks/use-dvf-summary";
import { useDepartmentCommunes } from "@/hooks/use-department-communes";
import { useCommuneRanking } from "@/hooks/use-commune-ranking";
import { EMPTY_FILTERS, type DashboardFilters } from "@/lib/filters";
import { APP_PAGE_SHELL_CLASS } from "@/lib/page-layout";
import { MAP_PANEL_HEIGHT_CLASS } from "@/lib/map-layout";
import {
  DEFAULT_RANKING_METRIC,
  RANKING_METRICS,
  RANKING_METRIC_DESCRIPTION_KEYS,
  RANKING_METRIC_OPTION_KEYS,
  RANKING_METRIC_TITLE_KEYS,
  type PageSize,
  type RankingMetric,
} from "@/lib/ranking";
import { useLocale } from "@/lib/locale-context";
import { useAuth } from "@/lib/auth-context";

const FranceMap = dynamic(() => import("./FranceMap").then((m) => m.FranceMap), {
  ssr: false,
  loading: () => (
    <div
      className={`${MAP_PANEL_HEIGHT_CLASS} animate-pulse rounded-2xl bg-gradient-to-br from-ink-100 to-ink-50 ring-1 ring-ink-200/60 dark:from-ink-800 dark:to-ink-900 dark:ring-ink-700/50`}
    />
  ),
});

export function RankingDashboard() {
  const { t } = useLocale();
  const { user } = useAuth();
  const weights = user?.preferences?.weights;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [metric, setMetric] = useState<RankingMetric>(DEFAULT_RANKING_METRIC);
  const [autoPicked, setAutoPicked] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CommuneRankingRow | null>(
    null,
  );
  const [focusedDepartment, setFocusedDepartment] = useState<
    string | undefined
  >();

  // Once the profile's weights are known, default to the personalized ranking.
  useEffect(() => {
    if (!autoPicked && weights) {
      setMetric("personalized");
      setAutoPicked(true);
    }
  }, [autoPicked, weights]);

  const { rows, total, totalPages, offset, loading, error } = useCommuneRanking({
    page,
    pageSize,
    metric,
    weights,
  });

  useEffect(() => {
    if (total > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages, total]);

  useEffect(() => {
    if (!selectedRow) {
      setFocusedDepartment(undefined);
      return;
    }

    let cancelled = false;
    void fetchLocation(selectedRow.code_commune)
      .then((loc) => {
        if (!cancelled && loc.code_departement) {
          setFocusedDepartment(loc.code_departement);
        }
      })
      .catch(() => {
        if (!cancelled) setFocusedDepartment(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRow]);

  const filters = useMemo<DashboardFilters>(
    () => ({
      ...EMPTY_FILTERS,
      codeCommune: selectedRow?.code_commune ?? "",
      nomCommune: selectedRow?.nom_commune ?? "",
      codePostal: "",
    }),
    [selectedRow],
  );

  const { data, state } = useDashboardData(filters);
  const dvf = useDvfSummary(filters);

  const { communes: departmentCommunes } = useDepartmentCommunes(
    focusedDepartment,
  );

  const onMetricChange = (nextMetric: RankingMetric) => {
    setMetric(nextMetric);
    setPage(1);
    setSelectedRow(null);
  };

  const onPageSizeChange = (nextPageSize: PageSize) => {
    setPageSize(nextPageSize);
    setPage(1);
  };

  const communeSelected = Boolean(selectedRow);

  return (
    <main className={`${APP_PAGE_SHELL_CLASS} space-y-6 px-4 py-6 sm:px-6 lg:py-8`}>
      <AppViewNav />

      <header className="space-y-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
            {t("ranking.title")}
          </h1>
          <p className="text-sm text-ink-700 dark:text-ink-300">
            {t("ranking.description")}
          </p>
        </div>
        <label className="flex max-w-md items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
            <IconChart />
          </span>
          <select
            className={`${inputClassName} min-w-0 flex-1`}
            value={metric}
            aria-label={t("ranking.rankBySrOnly")}
            onChange={(e) =>
              onMetricChange(e.target.value as RankingMetric)
            }
          >
            {RANKING_METRICS.map((key) => (
              <option key={key} value={key}>
                {t(RANKING_METRIC_OPTION_KEYS[key])}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <DatasetCard
          description={t(RANKING_METRIC_DESCRIPTION_KEYS[metric])}
          infoTitle={t(RANKING_METRIC_TITLE_KEYS[metric])}
          sourceInfo={{
            name: t("ranking.sourceName"),
            about: t("ranking.sourceAbout"),
          }}
          sourceInfoPlacement="description"
          icon={<IconChart />}
          tone="social"
        >
          <div className="col-span-2 space-y-4">
            <CommuneRankingTable
              rows={rows}
              metric={metric}
              loading={loading}
              error={error}
              offset={offset}
              selectedCodeCommune={selectedRow?.code_commune}
              onSelect={setSelectedRow}
            />
            {!error ? (
              <RankingPagination
                page={page}
                pageSize={pageSize}
                total={total}
                totalPages={totalPages}
                loading={loading}
                onPageChange={setPage}
                onPageSizeChange={onPageSizeChange}
              />
            ) : null}
          </div>
        </DatasetCard>

        <div className="space-y-4 lg:sticky lg:top-24">
          <FranceMap
            readOnly
            selectedCommune={selectedRow?.code_commune}
            focusedDepartment={focusedDepartment}
            departmentCommunes={departmentCommunes}
          />

          {communeSelected ? (
            <RankingCommuneStatsCard
              communeName={selectedRow?.nom_commune ?? selectedRow?.code_commune ?? ""}
              social={data.socialSummary}
              irisCount={data.irisSocialSummary.length}
              dvf={dvf.summary}
              opportunity={data.opportunityScore}
              loading={state.loading || dvf.loading}
            />
          ) : (
            <EmptyState icon={<IconMapPin />}>
              {t("ranking.selectCommuneHint")}
            </EmptyState>
          )}
        </div>
      </section>
    </main>
  );
}
