import { describe, expect, it } from "vitest";
import type { MessageKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import {
  buildInequalityHint,
  buildInequalityInfo,
  formatInequalityRatio,
} from "./social-metrics";

const fmt = {
  formatFrNumber: (n: number | null, opts?: { maximumFractionDigits?: number }) => {
    if (n == null) return "-";
    return new Intl.NumberFormat("en-US", opts).format(n);
  },
  formatEuro: (n: number | null) => {
    if (n == null) return "-";
    return `${new Intl.NumberFormat("en-US").format(n)} €`;
  },
} as const;

const t = (key: MessageKey, params?: Record<string, string | number>) =>
  translate("en", key, params);

describe("social-metrics", () => {
  it("formats inequality as a multiplier", () => {
    expect(formatInequalityRatio(8, fmt)).toBe("8×");
    expect(formatInequalityRatio(3.1, fmt)).toBe("3.1×");
  });

  it("builds income-based hints without repeating the ratio", () => {
    const hint = buildInequalityHint(3.1, "11000", "62000", t, fmt);
    expect(hint).toBe(
      "Bottom 10%: 11,000 €/yr · Top 10%: 62,000 €/yr. Smaller ratio means incomes are closer together",
    );
  });

  it("builds ratio-only hints when decile incomes are missing", () => {
    const hint = buildInequalityHint(8, null, null, t, fmt);
    expect(hint).toBe("Smaller ratio means incomes are closer together");
  });

  it("builds info with income deciles when available", () => {
    expect(
      buildInequalityInfo(3.1, "11000", "62000", t, fmt),
    ).toContain("11,000 €");
    expect(
      buildInequalityInfo(3.1, "11000", "62000", t, fmt),
    ).toContain("62,000 €");
  });

  it("builds ratio-only info when decile incomes are missing", () => {
    expect(buildInequalityInfo(8, null, null, t, fmt)).toContain("8");
    expect(buildInequalityInfo(8, null, null, t, fmt)).toContain("Lower is better");
  });
});
