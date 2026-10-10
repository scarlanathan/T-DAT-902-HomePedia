import type {
  ForecastHistoryPoint,
  ForecastPoint,
  ForecastScenario,
} from "@/api/types";
import { parseNumeric } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { INTL_LOCALE } from "@/lib/i18n/types";
import type { Theme } from "@/lib/theme-context";

export const FORECAST_SCENARIOS: ForecastScenario[] = [
  "central",
  "optimiste",
  "pessimiste",
];

/** Line colors per scenario (readable on light and dark backgrounds). */
export const SCENARIO_COLORS: Record<ForecastScenario, string> = {
  central: "#7c3aed",
  optimiste: "#059669",
  pessimiste: "#dc2626",
};

const HISTORY_COLOR = "#2557eb";
const CONTEXT_COLOR_LIGHT = "#94a3b8";
const CONTEXT_COLOR_DARK = "#64748b";

/**
 * Year and quarter (1-4) of a date. Accepts "YYYY-MM-DD" (what the API sends)
 * and full ISO timestamps (shifted by 12h so a midnight in a UTC+/-n zone
 * still lands in the right quarter).
 */
export function quarterParts(iso: string): { year: number; quarter: number } | null {
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (plain) {
    const month = Number(plain[2]);
    return { year: Number(plain[1]), quarter: Math.floor((month - 1) / 3) + 1 };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const shifted = new Date(d.getTime() + 12 * 3600 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    quarter: Math.floor(shifted.getUTCMonth() / 3) + 1,
  };
}

/** Sortable key such as "2024-Q1". */
export function quarterKey(iso: string): string {
  const p = quarterParts(iso);
  return p ? `${p.year}-Q${p.quarter}` : iso;
}

/** "T1 2024" in French, "Q1 2024" in English. */
export function formatQuarterLabel(iso: string, locale: Locale = "en"): string {
  const p = quarterParts(iso);
  if (!p) return iso;
  const prefix = locale === "fr" ? "T" : "Q";
  return `${prefix}${p.quarter} ${p.year}`;
}

function quarterKeyToLabel(key: string, locale: Locale): string {
  const m = /^(\d{4})-Q(\d)$/.exec(key);
  if (!m) return key;
  return `${locale === "fr" ? "T" : "Q"}${m[2]} ${m[1]}`;
}

export type ForecastChartInput = {
  theme: Theme;
  locale: Locale;
  /** Series the forecast continues (ordered or not, parsed internally). */
  history: ForecastHistoryPoint[];
  /** Forecast rows for every scenario. */
  forecast: ForecastPoint[];
  selectedScenario: ForecastScenario;
  /** Only forecast points with horizon <= maxHorizon are drawn. */
  maxHorizon: number;
  historyName: string;
  scenarioNames: Record<ForecastScenario, string>;
  intervalName: string;
  /** Optional extra history (e.g. the commune when the forecast is its département). */
  contextHistory?: ForecastHistoryPoint[];
  contextName?: string;
};

export type ForecastChartSeries = {
  name: string;
  type: "line";
  data: (number | null)[];
  stack?: string;
  [key: string]: unknown;
};

export type ForecastChartData = {
  keys: string[];
  labels: string[];
  history: (number | null)[];
  context: (number | null)[] | null;
  scenarios: Record<ForecastScenario, (number | null)[]>;
  lower: (number | null)[];
  upper: (number | null)[];
};

/** Aligns history, context history and scenario forecasts on one quarter axis. */
export function buildForecastChartData(
  input: Pick<
    ForecastChartInput,
    "history" | "forecast" | "selectedScenario" | "maxHorizon" | "contextHistory" | "locale"
  >,
): ForecastChartData {
  const forecast = input.forecast.filter((p) => p.horizon <= input.maxHorizon);
  const keySet = new Set<string>();
  for (const p of input.history) keySet.add(quarterKey(p.period_quarter));
  for (const p of input.contextHistory ?? []) keySet.add(quarterKey(p.period_quarter));
  for (const p of forecast) keySet.add(quarterKey(p.period_quarter));
  const keys = [...keySet].sort();
  const index = new Map(keys.map((k, i) => [k, i]));
  const empty = () => keys.map(() => null as number | null);

  const history = empty();
  let lastHistoryIdx = -1;
  for (const p of input.history) {
    const i = index.get(quarterKey(p.period_quarter));
    const v = parseNumeric(p.median_price_per_sqm);
    if (i == null || v == null) continue;
    history[i] = v;
    if (i > lastHistoryIdx) lastHistoryIdx = i;
  }
  const lastHistoryValue = lastHistoryIdx >= 0 ? history[lastHistoryIdx] : null;

  let context: (number | null)[] | null = null;
  if (input.contextHistory?.length) {
    context = empty();
    for (const p of input.contextHistory) {
      const i = index.get(quarterKey(p.period_quarter));
      const v = parseNumeric(p.median_price_per_sqm);
      if (i != null && v != null) context[i] = v;
    }
  }

  const scenarios = {
    central: empty(),
    optimiste: empty(),
    pessimiste: empty(),
  } as Record<ForecastScenario, (number | null)[]>;
  const lower = empty();
  const upper = empty();

  for (const p of forecast) {
    const i = index.get(quarterKey(p.period_quarter));
    if (i == null) continue;
    const target = scenarios[p.scenario];
    if (!target) continue;
    target[i] = parseNumeric(p.median_price_per_sqm);
    if (p.scenario === input.selectedScenario) {
      lower[i] = parseNumeric(p.lower_80);
      upper[i] = parseNumeric(p.upper_80);
    }
  }

  // Start every forecast from the last observed point so the lines connect.
  if (lastHistoryIdx >= 0 && lastHistoryValue != null) {
    for (const s of FORECAST_SCENARIOS) {
      const hasForecast = scenarios[s].some((v, i) => i > lastHistoryIdx && v != null);
      if (hasForecast && scenarios[s][lastHistoryIdx] == null) {
        scenarios[s][lastHistoryIdx] = lastHistoryValue;
      }
    }
    if (lower.some((v, i) => i > lastHistoryIdx && v != null)) {
      lower[lastHistoryIdx] = lastHistoryValue;
      upper[lastHistoryIdx] = lastHistoryValue;
    }
  }

  return {
    keys,
    labels: keys.map((k) => quarterKeyToLabel(k, input.locale)),
    history,
    context,
    scenarios,
    lower,
    upper,
  };
}

type TooltipParam = { dataIndex: number };

export function forecastChartOption(input: ForecastChartInput) {
  const { theme, locale, selectedScenario } = input;
  const dark = theme === "dark";
  const messages = getMessages(locale);
  const data = buildForecastChartData(input);
  const nf = new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 0 });
  const euro = (v: number | null | undefined) =>
    v != null && Number.isFinite(v)
      ? `${nf.format(Math.round(v))} ${messages.common.euroPerSqm}`
      : messages.common.emDash;

  const axisColor = dark ? "#9aa8bc" : "#5c6b82";
  const lineColor = dark ? "#3d4f6f" : "#d4dce8";
  const selectedColor = SCENARIO_COLORS[selectedScenario];
  const others = FORECAST_SCENARIOS.filter((s) => s !== selectedScenario);

  const series: ForecastChartSeries[] = [
    {
      id: "history",
      name: input.historyName,
      type: "line",
      smooth: true,
      showSymbol: false,
      connectNulls: true,
      z: 5,
      lineStyle: { width: 3, color: HISTORY_COLOR },
      itemStyle: { color: HISTORY_COLOR },
      data: data.history,
    },
  ];

  if (data.context) {
    const contextColor = dark ? CONTEXT_COLOR_DARK : CONTEXT_COLOR_LIGHT;
    series.push({
      id: "context",
      name: input.contextName ?? "",
      type: "line",
      smooth: true,
      showSymbol: false,
      connectNulls: true,
      z: 4,
      lineStyle: { width: 2, color: contextColor },
      itemStyle: { color: contextColor },
      data: data.context,
    });
  }

  // 80% interval: transparent lower line + stacked (upper - lower) filled area.
  series.push(
    {
      id: "band-lower",
      name: input.intervalName,
      type: "line",
      stack: "interval",
      symbol: "none",
      silent: true,
      connectNulls: false,
      lineStyle: { opacity: 0 },
      itemStyle: { color: selectedColor },
      areaStyle: { opacity: 0 },
      tooltip: { show: false },
      data: data.lower,
    },
    {
      id: "band-width",
      name: input.intervalName,
      type: "line",
      stack: "interval",
      symbol: "none",
      silent: true,
      connectNulls: false,
      lineStyle: { opacity: 0 },
      itemStyle: { color: selectedColor },
      areaStyle: { color: selectedColor, opacity: dark ? 0.22 : 0.16 },
      tooltip: { show: false },
      data: data.upper.map((u, i) => {
        const l = data.lower[i];
        return u != null && l != null ? u - l : null;
      }),
    },
    {
      id: `scenario-${selectedScenario}`,
      name: input.scenarioNames[selectedScenario],
      type: "line",
      smooth: false,
      symbolSize: 6,
      connectNulls: false,
      z: 6,
      lineStyle: { width: 3, type: "dashed", color: selectedColor },
      itemStyle: { color: selectedColor },
      data: data.scenarios[selectedScenario],
    },
    ...others.map<ForecastChartSeries>((s) => ({
      id: `scenario-${s}`,
      name: input.scenarioNames[s],
      type: "line",
      smooth: false,
      showSymbol: false,
      connectNulls: false,
      z: 3,
      lineStyle: { width: 1.5, type: "dashed", color: SCENARIO_COLORS[s], opacity: 0.8 },
      itemStyle: { color: SCENARIO_COLORS[s] },
      data: data.scenarios[s],
    })),
  );

  const legendNames = [
    input.historyName,
    ...(data.context && input.contextName ? [input.contextName] : []),
    input.scenarioNames[selectedScenario],
    ...others.map((s) => input.scenarioNames[s]),
  ];

  const dot = (color: string) =>
    `<span style="display:inline-block;margin-right:6px;width:8px;height:8px;border-radius:50%;background:${color}"></span>`;

  return {
    grid: { left: 64, right: 20, top: 40, bottom: 48 },
    legend: {
      data: legendNames,
      top: 0,
      textStyle: { color: axisColor },
      icon: "roundRect",
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: dark ? "rgba(21, 32, 51, 0.96)" : "rgba(255,255,255,0.96)",
      borderColor: lineColor,
      textStyle: { color: dark ? "#e9eef5" : "#152033" },
      formatter: (params: TooltipParam | TooltipParam[]) => {
        const list = Array.isArray(params) ? params : [params];
        const i = list[0]?.dataIndex;
        if (i == null) return "";
        const rows: string[] = [`<strong>${data.labels[i]}</strong>`];
        if (data.history[i] != null) {
          rows.push(`${dot(HISTORY_COLOR)}${input.historyName}: ${euro(data.history[i])}`);
        }
        if (data.context && data.context[i] != null && input.contextName) {
          rows.push(
            `${dot(dark ? CONTEXT_COLOR_DARK : CONTEXT_COLOR_LIGHT)}${input.contextName}: ${euro(data.context[i])}`,
          );
        }
        const isForecastPoint = data.history[i] == null;
        if (isForecastPoint) {
          for (const s of [selectedScenario, ...others]) {
            const v = data.scenarios[s][i];
            if (v != null) {
              rows.push(`${dot(SCENARIO_COLORS[s])}${input.scenarioNames[s]}: ${euro(v)}`);
            }
          }
          if (data.lower[i] != null && data.upper[i] != null) {
            rows.push(
              `${input.intervalName}: ${euro(data.lower[i])} – ${euro(data.upper[i])}`,
            );
          }
        }
        return rows.join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.labels,
      axisLine: { lineStyle: { color: lineColor } },
      axisLabel: { color: axisColor, rotate: data.labels.length > 12 ? 32 : 0 },
    },
    yAxis: {
      type: "value",
      scale: true,
      name: messages.common.euroPerSqm,
      nameTextStyle: { color: axisColor },
      splitLine: { lineStyle: { color: dark ? "#243044" : "#e9eef5", type: "dashed" } },
      axisLabel: {
        color: axisColor,
        formatter: (v: number) => nf.format(v),
      },
    },
    series,
  };
}
