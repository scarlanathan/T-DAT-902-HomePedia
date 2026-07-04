import { describe, expect, it } from "vitest";
import { formatRankingValue, RANKING_METRICS } from "./ranking";

const fmt = {
  formatEuro: (n: number | null) => (n == null ? "—" : `${n} €`),
  formatScore: (n: number | null) => (n == null ? "—" : String(n)),
};

const scoreOutOf = (score: string) => `${score} / 100`;
const emDash = "—";

describe("formatRankingValue", () => {
  it("formats income and price metrics as euro", () => {
    expect(
      formatRankingValue("median_income_eur", "45000", fmt, scoreOutOf, emDash),
    ).toBe("45000 €");
    expect(
      formatRankingValue("price_median_per_sqm", "12500", fmt, scoreOutOf, emDash),
    ).toBe("12500 €");
  });

  it("formats score metrics out of 100", () => {
    expect(
      formatRankingValue("composite_score", "72.5", fmt, scoreOutOf, emDash),
    ).toBe("72.5 / 100");
    expect(
      formatRankingValue("social_mix_score", "68", fmt, scoreOutOf, emDash),
    ).toBe("68 / 100");
    expect(
      formatRankingValue("quality_of_life_score", "55", fmt, scoreOutOf, emDash),
    ).toBe("55 / 100");
  });

  it("returns em dash for missing values", () => {
    for (const metric of RANKING_METRICS) {
      expect(formatRankingValue(metric, null, fmt, scoreOutOf, emDash)).toBe(emDash);
      expect(formatRankingValue(metric, undefined, fmt, scoreOutOf, emDash)).toBe(
        emDash,
      );
    }
  });
});
