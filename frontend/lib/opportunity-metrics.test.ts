import { describe, expect, it } from "vitest";
import type { MessageKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import {
  buildAmenitiesHint,
  buildAmenitiesInfo,
  buildPriceHint,
  buildPriceInfo,
  buildSocialMixHint,
  buildSocialMixInfo,
  formatEuroPerSqm,
} from "./opportunity-metrics";

const fmt = {
  formatFrNumber: (n: number | null, opts?: { maximumFractionDigits?: number }) => {
    if (n == null) return "-";
    return new Intl.NumberFormat("en-US", opts).format(n);
  },
  formatEuro: (n: number | null) => {
    if (n == null) return "-";
    return `${new Intl.NumberFormat("en-US").format(n)} €`;
  },
  formatPercent: (n: number | null) => {
    if (n == null) return "-";
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n)} %`;
  },
} as const;

const t = (key: MessageKey, params?: Record<string, string | number>) =>
  translate("en", key, params);

describe("opportunity-metrics", () => {
  it("formats euro per square metre", () => {
    expect(formatEuroPerSqm(10000, fmt)).toBe("10,000 €/m²");
  });

  it("builds price hint", () => {
    expect(buildPriceHint(t)).toBe("Higher score means more affordable housing");
  });

  it("builds detailed price info with median", () => {
    expect(buildPriceInfo(10000, t, fmt)).toContain("10,000 €/m²");
    expect(buildPriceInfo(10000, t, fmt)).toContain(
      "Higher score means more affordable housing",
    );
    expect(buildPriceInfo(10000, t, fmt)).not.toMatch(/÷|=/);
  });

  it("builds social mix hint", () => {
    expect(buildSocialMixHint(t)).toBe(
      "Higher score means higher income and lower poverty",
    );
  });

  it("builds social mix info with income and poverty", () => {
    expect(buildSocialMixInfo(32000, 14.2, t, fmt)).toContain("32,000 €");
    expect(buildSocialMixInfo(32000, 14.2, t, fmt)).toContain("14.2 %");
    expect(buildSocialMixInfo(32000, 14.2, t, fmt)).toContain("0 to 100");
  });

  it("builds amenities hint", () => {
    expect(buildAmenitiesHint(t)).toBe(
      "Higher score means more nearby amenities",
    );
  });

  it("builds amenities info with facility count", () => {
    expect(buildAmenitiesInfo(42, t, fmt)).toContain("42");
    expect(buildAmenitiesInfo(42, t, fmt)).toContain("0 to 100");
  });
});
