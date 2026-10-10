"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type {
  ForecastHorizon,
  ForecastLevel,
  ForecastPropertyType,
  ForecastRankingRow,
  ForecastScenario,
  LocationRow,
} from "@/api";
import { AppViewNav } from "@/components/AppViewNav";
import { CommuneSearch } from "@/components/CommuneSearch";
import { ForecastChart } from "@/components/ForecastChart";
import { ForecastConsensusCard } from "@/components/ForecastConsensusCard";
import { ForecastMethodSection } from "@/components/ForecastMethodSection";
import { ForecastRankingTable } from "@/components/ForecastRankingTable";
import { changeToneClass, useSignedPercent } from "@/components/ForecastBits";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { inputClassName, labelClassName } from "@/components/ui/field-styles";
import { IconChart, IconMapPin } from "@/components/ui/icons";
import {
  useForecastLocations,
  useForecastMap,
  useForecastModel,
  useForecastRanking,
  useForecastSeries,
} from "@/hooks/use-forecast";
import { FORECAST_SCENARIOS, formatQuarterLabel } from "@/lib/forecast-chart";
import { parseNumeric } from "@/lib/format";
import { useFormat, useLocale } from "@/lib/locale-context";
import { MAP_PANEL_HEIGHT_CLASS } from "@/lib/map-layout";
import { APP_PAGE_SHELL_CLASS } from "@/lib/page-layout";

const ForecastMap = dynamic(() => import("./ForecastMap").then((m) => m.ForecastMap), {
  ssr: false,
  loading: () => (
    <div
      className={`${MAP_PANEL_HEIGHT_CLASS} animate-pulse rounded-2xl bg-gradient-to-br from-ink-100 to-ink-50 ring-1 ring-ink-200/60 dark:from-ink-800 dark:to-ink-900 dark:ring-ink-700/50`}
    />
  ),
});

const LEVELS: ForecastLevel[] = ["france", "region", "departement", "commune"];
const PROPERTY_TYPES: ForecastPropertyType[] = ["all", "appartement", "maison"];
const HORIZONS: ForecastHorizon[] = [4, 8];

type CommuneSelection = { code: string; nom: string; codeDepartement: string | null };

export function ForecastDashboard() {
  const { t, locale } = useLocale();
  const fmt = useFormat();
  const signed = useSignedPercent();

  const [level, setLevel] = useState<ForecastLevel>("france");
  const [regionCode, setRegionCode] = useState("");
  const [departementCode, setDepartementCode] = useState("");
  const [commune, setCommune] = useState<CommuneSelection | null>(null);
  const [propertyType, setPropertyType] = useState<ForecastPropertyType>("all");
  const [scenario, setScenario] = useState<ForecastScenario>("central");
  const [horizon, setHorizon] = useState<ForecastHorizon>(4);
  const [rankingOrder, setRankingOrder] = useState<"desc" | "asc">("desc");
  const [rankingLevel, setRankingLevel] = useState<"commune" | "departement">("commune");

  const { regions, departments } = useForecastLocations();

  const code =
    level === "region"
      ? regionCode
      : level === "departement"
        ? departementCode
        : level === "commune"
          ? (commune?.code ?? "")
          : "FR";

  const series = useForecastSeries({ level, code: code || null, propertyType });
  const fallbackCode = level === "commune" ? (series.data?.fallback?.code ?? null) : null;
  const fallbackSeries = useForecastSeries({
    level: "departement",
    code: fallbackCode,
    propertyType,
  });
  const usingFallback = Boolean(fallbackCode);
  const main = usingFallback ? fallbackSeries.data : series.data;
  const mainLoading = series.loading || (usingFallback && fallbackSeries.loading);

  const selectedDepartment =
    level === "departement"
      ? departementCode || undefined
      : level === "commune"
        ? (commune?.codeDepartement ?? fallbackCode ?? undefined)
        : undefined;

  const mapState = useForecastMap({ scenario, propertyType, horizon });
  const ranking = useForecastRanking({
    level: rankingLevel,
    scenario,
    propertyType,
    horizon,
    order: rankingOrder,
    limit: 10,
    codeDepartement: selectedDepartment,
  });
  const model = useForecastModel();

  const departmentName = (dep: string | null | undefined) =>
    departments.find((d) => d.code_departement === dep)?.nom_departement ?? dep ?? "";

  const summary = main?.summary.find((s) => s.scenario === scenario) ?? null;
  const areaName =
    level === "france"
      ? t("forecast.levels.france")
      : (series.data?.nom ??
        (level === "commune"
          ? commune?.nom
          : level === "departement"
            ? departmentName(departementCode)
            : regions.find((r) => r.code_region === regionCode)?.nom_region) ??
        code);
  const forecastAreaName = usingFallback ? (main?.nom ?? departmentName(fallbackCode)) : areaName;

  const targetQuarter = useMemo(() => {
    const p = main?.forecast.find((f) => f.scenario === scenario && f.horizon === horizon);
    return p ? formatQuarterLabel(p.period_quarter, locale) : null;
  }, [main, scenario, horizon, locale]);

  const h = horizon === 8 ? "h8" : "h4";
  const lastPrice = parseNumeric(summary?.last_price);
  const lastObserved = parseNumeric(summary?.last_observed_price);
  const forecastPrice = parseNumeric(summary?.[`price_${h}`]);
  const changePct = parseNumeric(summary?.[`change_pct_${h}`]);
  const lower = parseNumeric(summary?.[`lower_80_${h}`]);
  const upper = parseNumeric(summary?.[`upper_80_${h}`]);
  const annualSales = parseNumeric(summary?.annual_sales);
  const lastQuarter = summary?.last_quarter ? formatQuarterLabel(summary.last_quarter, locale) : null;
  const euroSqm = (v: number | null) =>
    v == null ? t("common.emDash") : `${fmt.formatFrNumber(v, { maximumFractionDigits: 0 })} ${t("common.euroPerSqm")}`;
  const horizonLabel = t(horizon === 8 ? "forecast.controls.horizon2y" : "forecast.controls.horizon1y");

  const onLevelChange = (next: ForecastLevel) => {
    setLevel(next);
  };

  const selectDepartment = (dep: string) => {
    setLevel("departement");
    setDepartementCode(dep);
  };

  const onCommuneSelect = (loc: LocationRow) => {
    setCommune({
      code: loc.code_commune,
      nom: loc.nom_commune ?? loc.code_commune,
      codeDepartement: loc.code_departement,
    });
  };

  const onRankingSelect = (row: ForecastRankingRow) => {
    if (row.level === "commune") {
      setLevel("commune");
      setCommune({ code: row.code, nom: row.nom ?? row.code, codeDepartement: row.code_departement });
    } else {
      selectDepartment(row.code);
    }
  };

  const needsPick = level !== "france" && !code;
  const pickHintKey =
    level === "region"
      ? "forecast.pick.region"
      : level === "departement"
        ? "forecast.pick.departement"
        : "forecast.pick.commune";

  const levelControl = (
    <label className="flex flex-col gap-1.5">
      <span className={labelClassName}>{t("forecast.controls.level")}</span>
      <select
        className={inputClassName}
        value={level}
        aria-label={t("forecast.controls.level")}
        onChange={(e) => onLevelChange(e.target.value as ForecastLevel)}
      >
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {t(`forecast.levels.${l}`)}
          </option>
        ))}
      </select>
    </label>
  );

  let picker: React.ReactNode = null;
  if (level === "region") {
    picker = (
      <label className="flex flex-col gap-1.5">
        <span className={labelClassName}>{t("forecast.controls.region")}</span>
        <select
          className={inputClassName}
          value={regionCode}
          aria-label={t("forecast.controls.region")}
          onChange={(e) => setRegionCode(e.target.value)}
        >
          <option value="">{t("forecast.controls.choose")}</option>
          {regions.map((r) => (
            <option key={r.code_region} value={r.code_region}>
              {r.nom_region ?? r.code_region}
            </option>
          ))}
        </select>
      </label>
    );
  } else if (level === "departement") {
    picker = (
      <label className="flex flex-col gap-1.5">
        <span className={labelClassName}>{t("forecast.controls.departement")}</span>
        <select
          className={inputClassName}
          value={departementCode}
          aria-label={t("forecast.controls.departement")}
          onChange={(e) => setDepartementCode(e.target.value)}
        >
          <option value="">{t("forecast.controls.choose")}</option>
          {departments.map((d) => (
            <option key={d.code_departement} value={d.code_departement}>
              {d.code_departement} · {d.nom_departement ?? ""}
            </option>
          ))}
        </select>
      </label>
    );
  } else if (level === "commune") {
    picker = (
      <div className="flex flex-col gap-1.5">
        <span className={labelClassName}>{t("forecast.controls.commune")}</span>
        <CommuneSearch
          codeCommune={commune?.code ?? ""}
          nomCommune={commune?.nom ?? ""}
          onSelect={onCommuneSelect}
          onClear={() => setCommune(null)}
        />
      </div>
    );
  }

  const simpleSelect = <T extends string | number>(
    label: string,
    value: T,
    options: { value: T; label: string }[],
    onChange: (v: T) => void,
  ) => (
    <label className="flex flex-col gap-1.5">
      <span className={labelClassName}>{label}</span>
      <select
        className={inputClassName}
        value={String(value)}
        aria-label={label}
        onChange={(e) => {
          const found = options.find((o) => String(o.value) === e.target.value);
          if (found) onChange(found.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  const kpiLoading = mainLoading;

  return (
    <main className={`${APP_PAGE_SHELL_CLASS} space-y-6 px-4 py-6 sm:px-6 lg:py-8`}>
      <AppViewNav />

      <header className="space-y-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
            {t("forecast.title")}
          </h1>
          <p className="text-sm text-ink-700 dark:text-ink-300">{t("forecast.description")}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {levelControl}
          {picker ? <div className="xl:col-span-1">{picker}</div> : null}
          {simpleSelect(
            t("forecast.controls.propertyType"),
            propertyType,
            PROPERTY_TYPES.map((p) => ({ value: p, label: t(`forecast.propertyTypes.${p}`) })),
            setPropertyType,
          )}
          {simpleSelect(
            t("forecast.controls.scenario"),
            scenario,
            FORECAST_SCENARIOS.map((s) => ({ value: s, label: t(`forecast.scenarios.${s}`) })),
            setScenario,
          )}
          {simpleSelect(
            t("forecast.controls.horizon"),
            horizon,
            HORIZONS.map((hz) => ({
              value: hz,
              label: t(hz === 8 ? "forecast.controls.horizon2y" : "forecast.controls.horizon1y"),
            })),
            setHorizon,
          )}
        </div>
      </header>

      {needsPick ? (
        <EmptyState icon={<IconMapPin />}>{t(pickHintKey)}</EmptyState>
      ) : series.error || (usingFallback && fallbackSeries.error) ? (
        <Panel>
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {t(series.error ?? fallbackSeries.error ?? "forecast.errors.series")}
          </p>
        </Panel>
      ) : series.notFound ? (
        <EmptyState icon={<IconChart />}>{t("forecast.notFound", { name: areaName })}</EmptyState>
      ) : (
        <>
          {usingFallback ? (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            >
              <p>
                {t("forecast.fallback.notice", {
                  commune: areaName,
                  departement: forecastAreaName,
                })}
              </p>
              <button
                type="button"
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700"
                onClick={() => fallbackCode && selectDepartment(fallbackCode)}
              >
                {t("forecast.fallback.view", { departement: forecastAreaName })}
              </button>
            </div>
          ) : null}

          <section aria-label={t("forecast.kpi.sectionLabel")} className="space-y-3">
            <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-50">
              {forecastAreaName}
              <span className="ml-2 text-sm font-normal text-ink-600 dark:text-ink-300">
                {t(`forecast.propertyTypes.${propertyType}`)} · {t(`forecast.scenarios.${scenario}`)} · {horizonLabel}
              </span>
            </h2>
            {!kpiLoading && !summary ? (
              <EmptyState icon={<IconChart />}>{t("forecast.kpi.noSummary")}</EmptyState>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard
                  label={t("forecast.kpi.current")}
                  value={kpiLoading ? t("common.loading") : euroSqm(lastPrice)}
                  hint={t("forecast.kpi.currentHint", {
                    quarter: lastQuarter ?? t("common.emDash"),
                    observed: euroSqm(lastObserved),
                  })}
                  loading={kpiLoading}
                  icon={<IconChart />}
                />
                <MetricCard
                  label={t("forecast.kpi.forecast")}
                  value={kpiLoading ? t("common.loading") : euroSqm(forecastPrice)}
                  hint={t("forecast.kpi.forecastHint", {
                    quarter: targetQuarter ?? t("common.emDash"),
                    scenario: t(`forecast.scenarios.${scenario}`),
                  })}
                  loading={kpiLoading}
                  tone="opportunity"
                />
                <MetricCard
                  label={t("forecast.kpi.change")}
                  value={kpiLoading ? t("common.loading") : signed(changePct)}
                  valueClassName={kpiLoading ? "" : changeToneClass(changePct)}
                  hint={t("forecast.kpi.changeHint", { horizon: horizonLabel })}
                  loading={kpiLoading}
                  tone="opportunity"
                />
                <MetricCard
                  label={t("forecast.kpi.interval")}
                  value={
                    kpiLoading
                      ? t("common.loading")
                      : lower != null && upper != null
                        ? `${fmt.formatFrNumber(lower, { maximumFractionDigits: 0 })} – ${fmt.formatFrNumber(upper, { maximumFractionDigits: 0 })}`
                        : t("common.emDash")
                  }
                  hint={t("forecast.kpi.intervalHint")}
                  loading={kpiLoading}
                  tone="cog"
                />
                <MetricCard
                  label={t("forecast.kpi.reliability")}
                  value={
                    kpiLoading
                      ? t("common.loading")
                      : summary?.reliability
                        ? t(`forecast.reliability.${summary.reliability}`)
                        : t("common.emDash")
                  }
                  valueClassName={
                    summary?.reliability === "elevee"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : summary?.reliability === "moyenne"
                        ? "text-amber-700 dark:text-amber-400"
                        : summary?.reliability === "faible"
                          ? "text-red-700 dark:text-red-400"
                          : ""
                  }
                  hint={t("forecast.kpi.reliabilityHint")}
                  loading={kpiLoading}
                  tone="cog"
                />
                <MetricCard
                  label={t("forecast.kpi.sales")}
                  value={kpiLoading ? t("common.loading") : fmt.formatFrNumber(annualSales)}
                  hint={t("forecast.kpi.salesHint")}
                  loading={kpiLoading}
                  tone="social"
                />
              </div>
            )}
          </section>

          <Panel className="space-y-4">
            <SectionHeader
              title={t("forecast.chart.title")}
              description={t("forecast.chart.description")}
              icon={<IconChart />}
            />
            {mainLoading ? (
              <div className="flex h-[380px] items-center justify-center text-sm text-ink-600 dark:text-ink-300">
                {t("common.loading")}
              </div>
            ) : main && (main.history.length > 0 || main.forecast.length > 0) ? (
              <ForecastChart
                history={main.history}
                forecast={main.forecast}
                scenario={scenario}
                horizon={horizon}
                historyName={t("forecast.chart.history", { name: forecastAreaName })}
                contextHistory={usingFallback ? series.data?.history : undefined}
                contextName={usingFallback ? t("forecast.chart.history", { name: areaName }) : undefined}
              />
            ) : (
              <EmptyState icon={<IconChart />}>{t("forecast.chart.empty")}</EmptyState>
            )}
          </Panel>
        </>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <Panel padding="sm" className="space-y-3">
          <SectionHeader
            title={t("forecast.map.title")}
            description={t("forecast.map.description", { horizon: horizonLabel })}
            icon={<IconMapPin />}
          />
          {mapState.error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {t(mapState.error)}
            </p>
          ) : null}
          <ForecastMap
            rows={mapState.data}
            loading={mapState.loading}
            selectedDepartment={selectedDepartment}
            onSelectDepartment={(dep) => selectDepartment(dep)}
          />
          <p className="text-xs text-ink-500 dark:text-ink-400">{t("forecast.map.footnote")}</p>
        </Panel>

        <Panel padding="sm" className="space-y-3">
          <SectionHeader
            title={t(rankingOrder === "desc" ? "forecast.ranking.titleUp" : "forecast.ranking.titleDown")}
            description={
              rankingLevel === "commune" && selectedDepartment
                ? t("forecast.ranking.filteredBy", {
                    departement: `${departmentName(selectedDepartment)} (${selectedDepartment})`,
                  })
                : t("forecast.ranking.descriptionAll")
            }
            icon={<IconChart />}
          />
          <div className="flex flex-wrap gap-2">
            <div role="group" aria-label={t("forecast.ranking.orderLabel")} className="inline-flex rounded-lg bg-ink-100 p-1 dark:bg-ink-800">
              {(["desc", "asc"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={rankingOrder === o}
                  onClick={() => setRankingOrder(o)}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    rankingOrder === o
                      ? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-50"
                      : "text-ink-600 dark:text-ink-300"
                  }`}
                >
                  {t(o === "desc" ? "forecast.ranking.up" : "forecast.ranking.down")}
                </button>
              ))}
            </div>
            <div role="group" aria-label={t("forecast.ranking.levelLabel")} className="inline-flex rounded-lg bg-ink-100 p-1 dark:bg-ink-800">
              {(["commune", "departement"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={rankingLevel === l}
                  onClick={() => setRankingLevel(l)}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    rankingLevel === l
                      ? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-50"
                      : "text-ink-600 dark:text-ink-300"
                  }`}
                >
                  {t(l === "commune" ? "forecast.ranking.communes" : "forecast.ranking.departements")}
                </button>
              ))}
            </div>
          </div>
          <ForecastRankingTable
            rows={ranking.data}
            loading={ranking.loading}
            error={ranking.error}
            selectedCode={level === "commune" ? commune?.code : departementCode || undefined}
            onSelect={onRankingSelect}
          />
        </Panel>
      </section>

      <ForecastMethodSection data={model.data} loading={model.loading} error={model.error} />

      <ForecastConsensusCard />
    </main>
  );
}
