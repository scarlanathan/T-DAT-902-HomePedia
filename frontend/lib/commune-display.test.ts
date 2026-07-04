import { describe, expect, it } from "vitest";
import { communePostalCode, formatCommuneLabel } from "./commune-display";

describe("communePostalCode", () => {
  it("prefers postal code when present", () => {
    expect(
      communePostalCode({ code_postal: "75001", code_commune: "75101" }),
    ).toBe("75001");
  });

  it("falls back to INSEE code when postal is missing", () => {
    expect(communePostalCode({ code_postal: null, code_commune: "75101" })).toBe(
      "75101",
    );
  });

  it("falls back to INSEE when postal is empty or whitespace", () => {
    expect(communePostalCode({ code_postal: "", code_commune: "75101" })).toBe(
      "75101",
    );
    expect(communePostalCode({ code_postal: "   ", code_commune: "75101" })).toBe(
      "75101",
    );
  });

  it("trims postal code whitespace", () => {
    expect(
      communePostalCode({ code_postal: " 75001 ", code_commune: "75101" }),
    ).toBe("75001");
  });
});

describe("formatCommuneLabel", () => {
  it("formats name with postal code", () => {
    expect(
      formatCommuneLabel({
        nom_commune: "Paris",
        code_postal: "75001",
        code_commune: "75101",
      }),
    ).toBe("Paris (75001)");
  });

  it("returns postal-only label when name is missing", () => {
    expect(
      formatCommuneLabel({
        nom_commune: null,
        code_postal: "75001",
        code_commune: "75101",
      }),
    ).toBe("75001");
  });

  it("falls back to INSEE in label when postal is absent", () => {
    expect(
      formatCommuneLabel({
        nom_commune: "Paris",
        code_postal: null,
        code_commune: "75101",
      }),
    ).toBe("Paris (75101)");
  });
});
