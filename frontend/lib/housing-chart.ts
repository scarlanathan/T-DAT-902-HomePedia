import type { CityHousingSummaryRow } from "@/api";
import { parseNumeric } from "@/lib/format";

export function chartSeriesFromHousingSummary(
  rows: CityHousingSummaryRow[],
): { months: string[]; values: (number | null)[] } {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.period_month).getTime() - new Date(b.period_month).getTime(),
  );
  return {
    months: sorted.map((r) => r.period_month),
    values: sorted.map((r) => parseNumeric(r.median_price_per_sqm_built)),
  };
}
