import { describe, expect, it } from "vitest";
import {
  communeQueryKey,
  EMPTY_FILTERS,
  filtersQueryKey,
  hasCommuneSelected,
} from "./filters";

describe("EMPTY_FILTERS", () => {
  it("starts with no commune or dates until user selects", () => {
    expect(EMPTY_FILTERS.codeCommune).toBe("");
    expect(EMPTY_FILTERS.nomCommune).toBe("");
    expect(EMPTY_FILTERS.codePostal).toBe("");
    expect(EMPTY_FILTERS.from).toBe("");
    expect(EMPTY_FILTERS.to).toBe("");
    expect(EMPTY_FILTERS.typeLocal).toBe("");
  });
});

describe("hasCommuneSelected", () => {
  it("is false for empty commune code", () => {
    expect(hasCommuneSelected(EMPTY_FILTERS)).toBe(false);
  });

  it("is true when codeCommune is set", () => {
    expect(
      hasCommuneSelected({ ...EMPTY_FILTERS, codeCommune: "75101" }),
    ).toBe(true);
  });
});

describe("communeQueryKey", () => {
  it("joins commune and dates only", () => {
    expect(communeQueryKey(EMPTY_FILTERS)).toBe("||");
  });

  it("ignores typeLocal", () => {
    expect(
      communeQueryKey({ ...EMPTY_FILTERS, typeLocal: "Maison" }),
    ).toBe(communeQueryKey(EMPTY_FILTERS));
  });
});

describe("filtersQueryKey", () => {
  it("joins commune, dates, and type", () => {
    expect(filtersQueryKey(EMPTY_FILTERS)).toBe("|||");
  });

  it("changes when commune or type changes", () => {
    const base = filtersQueryKey(EMPTY_FILTERS);
    expect(
      filtersQueryKey({ ...EMPTY_FILTERS, codeCommune: "01367" }),
    ).not.toBe(base);
    expect(
      filtersQueryKey({ ...EMPTY_FILTERS, typeLocal: "Maison" }),
    ).not.toBe(base);
  });
});
