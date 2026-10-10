"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { ForecastHistoryPoint, ForecastPoint, ForecastScenario } from "@/api";
import { forecastChartOption } from "@/lib/forecast-chart";
import { useLocale } from "@/lib/locale-context";
import { useTheme } from "@/lib/theme-context";

type Props = {
  history: ForecastHistoryPoint[];
  forecast: ForecastPoint[];
  scenario: ForecastScenario;
  horizon: number;
  historyName: string;
  contextHistory?: ForecastHistoryPoint[];
  contextName?: string;
};

export function ForecastChart({
  history,
  forecast,
  scenario,
  horizon,
  historyName,
  contextHistory,
  contextName,
}: Props) {
  const { theme } = useTheme();
  const { t, locale } = useLocale();

  const option = useMemo(
    () =>
      forecastChartOption({
        theme,
        locale,
        history,
        forecast,
        selectedScenario: scenario,
        maxHorizon: horizon,
        historyName,
        scenarioNames: {
          central: t("forecast.scenarios.central"),
          optimiste: t("forecast.scenarios.optimiste"),
          pessimiste: t("forecast.scenarios.pessimiste"),
        },
        intervalName: t("forecast.chart.interval"),
        contextHistory,
        contextName,
      }),
    [theme, locale, history, forecast, scenario, horizon, historyName, t, contextHistory, contextName],
  );

  return (
    <div className="h-[380px] w-full" role="img" aria-label={t("forecast.chart.ariaLabel")}>
      <ReactECharts
        option={option}
        notMerge
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
}
