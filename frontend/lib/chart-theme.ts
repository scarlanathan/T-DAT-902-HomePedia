import type { Theme } from "@/lib/theme-context";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { INTL_LOCALE } from "@/lib/i18n/types";

export function priceTrendChartOption(
  theme: Theme,
  labels: string[],
  values: (number | null)[],
  locale: Locale = "en",
) {
  const dark = theme === "dark";
  const messages = getMessages(locale);

  return {
    grid: { left: 52, right: 20, top: 28, bottom: 44 },
    tooltip: {
      trigger: "axis",
      backgroundColor: dark ? "rgba(21, 32, 51, 0.96)" : "rgba(255,255,255,0.96)",
      borderColor: dark ? "#3d4f6f" : "#d4dce8",
      textStyle: { color: dark ? "#e9eef5" : "#152033" },
      valueFormatter: (v: number) =>
        v != null && Number.isFinite(v)
          ? `${Math.round(v).toLocaleString(INTL_LOCALE[locale])} ${messages.common.euroPerSqm}`
          : messages.common.emDash,
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: dark ? "#3d4f6f" : "#d4dce8" } },
      axisLabel: {
        color: dark ? "#9aa8bc" : "#5c6b82",
        rotate: labels.length > 8 ? 32 : 0,
      },
    },
    yAxis: {
      type: "value",
      name: messages.common.euroPerSqm,
      nameTextStyle: { color: dark ? "#9aa8bc" : "#5c6b82" },
      splitLine: {
        lineStyle: {
          color: dark ? "#243044" : "#e9eef5",
          type: "dashed",
        },
      },
      axisLabel: { color: dark ? "#9aa8bc" : "#5c6b82" },
    },
    series: [
      {
        name: messages.chart.medianSeries,
        type: "line",
        smooth: true,
        symbolSize: 7,
        connectNulls: false,
        lineStyle: { width: 3, color: "#2557eb" },
        itemStyle: {
          color: "#2557eb",
          borderColor: dark ? "#152033" : "#fff",
          borderWidth: 2,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(37, 87, 235, 0.22)" },
              { offset: 1, color: "rgba(37, 87, 235, 0.02)" },
            ],
          },
        },
        data: values,
      },
    ],
  };
}
