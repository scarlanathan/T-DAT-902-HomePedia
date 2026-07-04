"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { CityHousingSummaryRow } from "@/api";
import { Panel } from "@/components/ui/Panel";
import { priceTrendChartOption } from "@/lib/chart-theme";
import { chartSeriesFromHousingSummary } from "@/lib/housing-chart";
import { useFormat, useLocale } from "@/lib/locale-context";
import { useTheme } from "@/lib/theme-context";

type Props = {
  rows: CityHousingSummaryRow[];
  loading?: boolean;
};

export function PriceTrendChart({ rows, loading }: Props) {
  const { theme } = useTheme();
  const { locale, t } = useLocale();
  const fmt = useFormat();
  const { months, values } = useMemo(
    () => chartSeriesFromHousingSummary(rows),
    [rows],
  );

  const labels = useMemo(
    () => months.map((m) => fmt.formatMonthLabel(m)),
    [months, fmt],
  );

  const option = useMemo(
    () => priceTrendChartOption(theme, labels, values, locale),
    [theme, labels, values, locale],
  );

  if (!loading && rows.length === 0) {
    return (
      <div className="flex h-[340px] items-center justify-center rounded-2xl border border-dashed border-ink-200/90 bg-white/60 px-6 text-center text-sm text-ink-600 shadow-card dark:border-ink-700/80 dark:bg-ink-900/60 dark:text-ink-300">
        {t("chart.empty")}
      </div>
    );
  }

  return (
    <Panel padding="sm" className="h-[340px]">
      {loading ? (
        <div className="flex h-full items-center justify-center text-sm text-ink-600 dark:text-ink-300">
          {t("chart.loading")}
        </div>
      ) : (
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "svg" }}
        />
      )}
    </Panel>
  );
}
