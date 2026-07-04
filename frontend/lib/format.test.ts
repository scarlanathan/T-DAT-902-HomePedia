import { describe, expect, it } from "vitest";
import {
  formatEuro,
  formatFrNumber,
  formatMonthLabel,
  formatPercent,
  formatPropertyType,
  formatScore,
  parseNumeric,
} from "./format";

describe("parseNumeric", () => {
  it("parses numeric strings and numbers", () => {
    expect(parseNumeric("450000")).toBe(450000);
    expect(parseNumeric(12.5)).toBe(12.5);
  });

  it("returns null for empty, null, undefined, and non-numeric", () => {
    expect(parseNumeric(null)).toBeNull();
    expect(parseNumeric(undefined)).toBeNull();
    expect(parseNumeric("")).toBeNull();
    expect(parseNumeric("n/a")).toBeNull();
    expect(parseNumeric(Number.NaN)).toBeNull();
  });
});

describe("formatFrNumber", () => {
  it("formats with en-US grouping", () => {
    expect(formatFrNumber(120000)).toBe("120,000");
  });

  it("returns em dash for invalid values", () => {
    expect(formatFrNumber(null)).toBe("-");
    expect(formatFrNumber(Number.NaN)).toBe("-");
  });
});

describe("formatEuro", () => {
  it("rounds and appends euro sign", () => {
    expect(formatEuro(450000.4)).toBe("450,000 €");
  });

  it("returns em dash when value is missing", () => {
    expect(formatEuro(null)).toBe("-");
  });
});

describe("formatPercent", () => {
  it("formats percentage with en-US decimals", () => {
    expect(formatPercent(14.2)).toBe("14.2 %");
  });

  it("returns em dash when value is missing", () => {
    expect(formatPercent(null)).toBe("-");
  });
});

describe("formatScore", () => {
  it("formats score with one decimal max", () => {
    expect(formatScore(58.5)).toBe("58.5");
  });
});

describe("formatPropertyType", () => {
  it("maps DVF French types to English labels", () => {
    expect(formatPropertyType("Appartement", "en")).toBe("Apartment");
    expect(formatPropertyType("Maison", "en")).toBe("House");
  });

  it("keeps French labels in fr locale", () => {
    expect(formatPropertyType("Appartement", "fr")).toBe("Appartement");
    expect(formatPropertyType("Maison", "fr")).toBe("Maison");
  });

  it("returns em dash for empty values", () => {
    expect(formatPropertyType(null)).toBe("-");
  });

  it("passes through unknown types unchanged", () => {
    expect(formatPropertyType("Local industriel")).toBe("Local industriel");
  });
});

describe("formatMonthLabel", () => {
  it("formats valid ISO dates in English locale", () => {
    const label = formatMonthLabel("2020-03-01T00:00:00.000Z", "en");
    expect(label).toMatch(/Mar/i);
    expect(label).toContain("2020");
  });

  it("formats valid ISO dates in French locale", () => {
    const label = formatMonthLabel("2020-03-01T00:00:00.000Z", "fr");
    expect(label).toMatch(/mars/i);
  });

  it("falls back to YYYY-MM prefix for invalid dates", () => {
    expect(formatMonthLabel("not-a-date")).toBe("not-a-d");
  });
});
