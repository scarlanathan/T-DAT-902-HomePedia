"use client";

import { useMemo } from "react";
import type { ForecastBacktestRow, ForecastModelResponse, ForecastScenario } from "@/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { IconSparkles } from "@/components/ui/icons";
import { FORECAST_SCENARIOS, SCENARIO_COLORS, formatQuarterLabel } from "@/lib/forecast-chart";
import { parseNumeric } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { INTL_LOCALE } from "@/lib/i18n/types";
import { useFormat, useLocale } from "@/lib/locale-context";
import { changeToneClass, useSignedPercent } from "@/components/ForecastBits";

type Props = {
  data: ForecastModelResponse | null;
  loading?: boolean;
  error?: MessageKey | null;
};

const LEVEL_ORDER = ["france", "region", "departement", "commune"] as const;

const thClass = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide";
const tdClass = "px-3 py-2 tabular-nums";

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-700">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  );
}

const theadClass =
  "border-b border-ink-200 bg-ink-50 text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300";
const rowClass = "border-b border-ink-100 last:border-0 dark:border-ink-800";

export function ForecastMethodSection({ data, loading, error }: Props) {
  const { t, locale } = useLocale();
  const fmt = useFormat();
  const signed = useSignedPercent();

  const scenarioRows = useMemo(() => {
    const rows = data?.scenarios ?? [];
    const quarters = [...new Set(rows.map((r) => r.period_quarter))].sort();
    const byScenario = new Map<
      ForecastScenario,
      { label: string | null; description: string | null; rates: Map<string, number | null> }
    >();
    for (const r of rows) {
      const entry = byScenario.get(r.scenario) ?? {
        label: r.label,
        description: r.description,
        rates: new Map<string, number | null>(),
      };
      entry.rates.set(r.period_quarter, parseNumeric(r.rate_pct));
      byScenario.set(r.scenario, entry);
    }
    return { quarters, byScenario };
  }, [data]);

  const backtest = useMemo(() => {
    const rows = [...(data?.backtest ?? [])];
    rows.sort(
      (a, b) =>
        LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || a.horizon - b.horizon,
    );
    return rows;
  }, [data]);

  const header = (
    <SectionHeader
      title={t("forecast.method.title")}
      description={t("forecast.method.description")}
      icon={<IconSparkles />}
    />
  );

  if (loading) {
    return (
      <Panel className="space-y-4">
        {header}
        <p className="text-sm text-ink-600 dark:text-ink-300">{t("common.loading")}</p>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel className="space-y-4">
        {header}
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {t(error)}
        </p>
      </Panel>
    );
  }

  const model = data?.model ?? null;
  if (!model) {
    return (
      <Panel className="space-y-4">
        {header}
        <EmptyState icon={<IconSparkles />}>{t("forecast.method.notTrained")}</EmptyState>
      </Panel>
    );
  }

  const elasticity = parseNumeric(model.rate_elasticity);
  const dateFmt = (iso: string | null) => {
    if (!iso) return t("common.emDash");
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "long", year: "numeric" });
  };
  const num = (v: string | null, digits = 2) =>
    fmt.formatFrNumber(parseNumeric(v), { maximumFractionDigits: digits });

  const backtestLevelLabel = (level: ForecastBacktestRow["level"]) =>
    t(`forecast.levels.${level}`);

  return (
    <Panel className="space-y-6">
      {header}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-semibold text-ink-900 dark:text-ink-50">
            {t("forecast.method.modelCard")}
          </h3>
          {model.method ? (
            <p className="text-sm leading-relaxed text-ink-700 dark:text-ink-300">{model.method}</p>
          ) : null}
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-500 dark:text-ink-400">{t("forecast.method.history")}</dt>
              <dd className="font-medium text-ink-900 dark:text-ink-50">
                {model.history_start ? formatQuarterLabel(model.history_start, locale) : t("common.emDash")}
                {" – "}
                {model.history_end ? formatQuarterLabel(model.history_end, locale) : t("common.emDash")}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500 dark:text-ink-400">{t("forecast.method.trainedAt")}</dt>
              <dd className="font-medium text-ink-900 dark:text-ink-50">{dateFmt(model.trained_at)}</dd>
            </div>
            <div>
              <dt className="text-ink-500 dark:text-ink-400">{t("forecast.method.elasticity")}</dt>
              <dd className="font-medium text-ink-900 dark:text-ink-50">
                {elasticity != null
                  ? t("forecast.method.elasticityValue", { value: signed(elasticity * 100) })
                  : t("common.emDash")}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500 dark:text-ink-400">{t("forecast.method.damping")}</dt>
              <dd className="font-medium text-ink-900 dark:text-ink-50">{num(model.damping_phi)}</dd>
            </div>
            <div>
              <dt className="text-ink-500 dark:text-ink-400">{t("forecast.method.meanReversion")}</dt>
              <dd className="font-medium text-ink-900 dark:text-ink-50">
                {num(model.mean_reversion_kappa, 3)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500 dark:text-ink-400">{t("forecast.method.lastRate")}</dt>
              <dd className="font-medium text-ink-900 dark:text-ink-50">
                {fmt.formatPercent(parseNumeric(model.last_rate_pct), 2)}
                {model.last_rate_month ? ` (${fmt.formatMonthLabel(model.last_rate_month)})` : ""}
              </dd>
            </div>
            {model.n_series ? (
              <div className="sm:col-span-2">
                <dt className="text-ink-500 dark:text-ink-400">{t("forecast.method.series")}</dt>
                <dd className="font-medium text-ink-900 dark:text-ink-50">
                  {LEVEL_ORDER.filter((l) => model.n_series?.[l] != null)
                    .map((l) => `${t(`forecast.levels.${l}`)} : ${fmt.formatFrNumber(model.n_series?.[l])}`)
                    .join(" · ")}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-ink-900 dark:text-ink-50">
            {t("forecast.method.scenariosTitle")}
          </h3>
          <p className="text-sm text-ink-600 dark:text-ink-300">{t("forecast.method.scenariosHint")}</p>
          {scenarioRows.quarters.length === 0 ? (
            <EmptyState>{t("forecast.method.noScenarios")}</EmptyState>
          ) : (
            <TableShell>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>{t("forecast.controls.scenario")}</th>
                  {scenarioRows.quarters.map((q) => (
                    <th key={q} className={`${thClass} text-right`}>
                      {formatQuarterLabel(q, locale)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FORECAST_SCENARIOS.filter((s) => scenarioRows.byScenario.has(s)).map((s) => {
                  const entry = scenarioRows.byScenario.get(s)!;
                  return (
                    <tr key={s} className={rowClass}>
                      <th scope="row" className="px-3 py-2 text-left font-medium text-ink-900 dark:text-ink-50">
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                          style={{ background: SCENARIO_COLORS[s] }}
                          aria-hidden
                        />
                        {entry.label ?? t(`forecast.scenarios.${s}`)}
                      </th>
                      {scenarioRows.quarters.map((q) => (
                        <td key={q} className={`${tdClass} text-right`}>
                          {fmt.formatPercent(entry.rates.get(q) ?? null, 2)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          )}
          <ul className="space-y-1 text-sm text-ink-600 dark:text-ink-300">
            {FORECAST_SCENARIOS.map((s) => {
              const desc = scenarioRows.byScenario.get(s)?.description;
              return desc ? (
                <li key={s}>
                  <span className="font-medium text-ink-800 dark:text-ink-100">
                    {t(`forecast.scenarios.${s}`)} :
                  </span>{" "}
                  {desc}
                </li>
              ) : null;
            })}
          </ul>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-ink-900 dark:text-ink-50">{t("forecast.method.backtestTitle")}</h3>
        <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          {t("forecast.method.backtestExplain")}
        </p>
        {backtest.length === 0 ? (
          <EmptyState>{t("forecast.method.noBacktest")}</EmptyState>
        ) : (
          <TableShell>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>{t("forecast.method.colLevel")}</th>
                <th className={`${thClass} text-right`}>{t("forecast.method.colHorizon")}</th>
                <th className={`${thClass} text-right`}>{t("forecast.method.colSeries")}</th>
                <th className={`${thClass} text-right`}>{t("forecast.method.colMapeModel")}</th>
                <th className={`${thClass} text-right`}>{t("forecast.method.colMapeNaive")}</th>
                <th className={`${thClass} text-right`}>{t("forecast.method.colGain")}</th>
                <th className={`${thClass} text-right`}>{t("forecast.method.colCoverage")}</th>
              </tr>
            </thead>
            <tbody>
              {backtest.map((row) => {
                const model = parseNumeric(row.mape_model);
                const naive = parseNumeric(row.mape_naive);
                const gain = model != null && naive != null ? naive - model : null;
                return (
                  <tr key={`${row.level}-${row.horizon}`} className={rowClass}>
                    <td className="px-3 py-2 font-medium text-ink-900 dark:text-ink-50">
                      {backtestLevelLabel(row.level)}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {t("forecast.method.horizonQuarters", { count: row.horizon })}
                    </td>
                    <td className={`${tdClass} text-right`}>{fmt.formatFrNumber(row.n_series)}</td>
                    <td className={`${tdClass} text-right`}>{fmt.formatPercent(model, 2)}</td>
                    <td className={`${tdClass} text-right`}>{fmt.formatPercent(naive, 2)}</td>
                    <td className={`${tdClass} text-right font-semibold ${changeToneClass(gain)}`}>
                      {gain != null ? `${gain > 0 ? "+" : ""}${fmt.formatFrNumber(gain, { maximumFractionDigits: 2 })} pt` : t("common.emDash")}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {fmt.formatPercent(parseNumeric(row.coverage_80), 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
        <p className="text-xs text-ink-500 dark:text-ink-400">{t("forecast.method.backtestFootnote")}</p>
      </div>
    </Panel>
  );
}
