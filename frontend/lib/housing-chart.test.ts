import { describe, expect, it } from "vitest";
import { chartSeriesFromHousingSummary } from "./housing-chart";

describe("chartSeriesFromHousingSummary", () => {
  it("sorts rows by period_month ascending", () => {
    const { months, values } = chartSeriesFromHousingSummary([
      {
        code_commune: "75101",
        nom_commune: "Paris",
        period_month: "2021-06-01T00:00:00.000Z",
        sale_line_count: "2",
        median_valeur_fonciere: null,
        median_price_per_sqm_built: "9000",
      },
      {
        code_commune: "75101",
        nom_commune: "Paris",
        period_month: "2020-03-01T00:00:00.000Z",
        sale_line_count: "1",
        median_valeur_fonciere: null,
        median_price_per_sqm_built: "8000",
      },
    ]);
    expect(months[0]).toContain("2020");
    expect(values[0]).toBe(8000);
    expect(values[1]).toBe(9000);
  });

  it("returns null for non-numeric median price", () => {
    const { values } = chartSeriesFromHousingSummary([
      {
        code_commune: "75101",
        nom_commune: "Paris",
        period_month: "2020-03-01T00:00:00.000Z",
        sale_line_count: "1",
        median_valeur_fonciere: null,
        median_price_per_sqm_built: null,
      },
    ]);
    expect(values[0]).toBeNull();
  });

  it("returns empty series for no rows", () => {
    const { months, values } = chartSeriesFromHousingSummary([]);
    expect(months).toEqual([]);
    expect(values).toEqual([]);
  });
});
