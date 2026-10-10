import { describe, expect, it } from "vitest";
import type { ForecastHistoryPoint, ForecastPoint } from "@/api/types";
import {
  buildForecastChartData,
  forecastChartOption,
  formatQuarterLabel,
  quarterKey,
} from "./forecast-chart";

const history: ForecastHistoryPoint[] = [
  { period_quarter: "2025-10-01", median_price_per_sqm: "3050", sale_count: "120" },
  { period_quarter: "2026-01-01", median_price_per_sqm: "3000", sale_count: "110" },
  { period_quarter: "2026-04-01", median_price_per_sqm: "3020", sale_count: "130" },
];

function fc(
  scenario: ForecastPoint["scenario"],
  period: string,
  horizon: number,
  value: number,
): ForecastPoint {
  return {
    scenario,
    period_quarter: period,
    horizon,
    median_price_per_sqm: String(value),
    lower_80: String(value - 100),
    upper_80: String(value + 100),
  };
}

const forecast: ForecastPoint[] = [
  fc("central", "2026-07-01", 1, 3030),
  fc("central", "2026-10-01", 2, 3040),
  fc("optimiste", "2026-07-01", 1, 3060),
  fc("optimiste", "2026-10-01", 2, 3100),
  fc("pessimiste", "2026-07-01", 1, 3000),
  fc("pessimiste", "2026-10-01", 2, 2980),
];

const baseInput = {
  theme: "light" as const,
  locale: "fr" as const,
  history,
  forecast,
  selectedScenario: "central" as const,
  maxHorizon: 8,
  historyName: "Historique",
  scenarioNames: { central: "Central", optimiste: "Optimiste", pessimiste: "Pessimiste" },
  intervalName: "Intervalle 80 %",
};

describe("quarter helpers", () => {
  it("formats quarter labels per locale", () => {
    expect(formatQuarterLabel("2024-01-01", "fr")).toBe("T1 2024");
    expect(formatQuarterLabel("2024-10-01", "en")).toBe("Q4 2024");
  });

  it("is robust to timestamps shifted by a timezone", () => {
    expect(quarterKey("2023-12-31T23:00:00.000Z")).toBe("2024-Q1");
    expect(quarterKey("2024-04-01T00:00:00.000Z")).toBe("2024-Q2");
  });
});

describe("buildForecastChartData", () => {
  it("puts history and forecast on one sorted quarter axis", () => {
    const data = buildForecastChartData(baseInput);
    expect(data.labels).toEqual(["T4 2025", "T1 2026", "T2 2026", "T3 2026", "T4 2026"]);
    expect(data.history).toEqual([3050, 3000, 3020, null, null]);
  });

  it("starts every scenario at the last historical point", () => {
    const data = buildForecastChartData(baseInput);
    expect(data.scenarios.central).toEqual([null, null, 3020, 3030, 3040]);
    expect(data.scenarios.optimiste[2]).toBe(3020);
    expect(data.scenarios.pessimiste[2]).toBe(3020);
    expect(data.lower[2]).toBe(3020);
    expect(data.upper[2]).toBe(3020);
    expect(data.lower[3]).toBe(2930);
    expect(data.upper[4]).toBe(3140);
  });

  it("drops forecast points beyond the horizon", () => {
    const data = buildForecastChartData({ ...baseInput, maxHorizon: 1 });
    expect(data.labels).toHaveLength(4);
    expect(data.scenarios.central).toEqual([null, null, 3020, 3030]);
  });
});

describe("forecastChartOption", () => {
  it("builds history, band, selected and alternative scenario series", () => {
    const option = forecastChartOption({ ...baseInput, selectedScenario: "optimiste" });
    const ids = option.series.map((s) => s.id);
    expect(ids).toEqual([
      "history",
      "band-lower",
      "band-width",
      "scenario-optimiste",
      "scenario-central",
      "scenario-pessimiste",
    ]);

    const lowerBand = option.series[1];
    const widthBand = option.series[2];
    expect(lowerBand.stack).toBe("interval");
    expect(widthBand.stack).toBe("interval");
    // Width = upper - lower, zero at the connection point.
    expect(widthBand.data).toEqual([null, null, 0, 200, 200]);

    const selected = option.series[3] as unknown as { lineStyle: { type: string; width: number } };
    expect(selected.lineStyle.type).toBe("dashed");
    expect(selected.lineStyle.width).toBe(3);
    const other = option.series[4] as unknown as { lineStyle: { width: number } };
    expect(other.lineStyle.width).toBeLessThan(3);
  });

  it("adds the context history line and formats the tooltip in €/m²", () => {
    const option = forecastChartOption({
      ...baseInput,
      contextHistory: [{ period_quarter: "2026-04-01", median_price_per_sqm: "2500", sale_count: "3" }],
      contextName: "Commune",
    });
    expect(option.series.map((s) => s.id)).toContain("context");
    const html = option.tooltip.formatter([{ dataIndex: 3 }]);
    expect(html).toContain("T3 2026");
    expect(html).toMatch(/3\s?030 €\/m²/);
    expect(html).toContain("Intervalle 80 %");
  });
});
