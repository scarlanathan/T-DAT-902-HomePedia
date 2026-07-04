import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n";

describe("translate", () => {
  it("resolves nested keys in English", () => {
    expect(translate("en", "header.login")).toBe("Log in");
  });

  it("resolves nested keys in French", () => {
    expect(translate("fr", "header.login")).toBe("Connexion");
  });

  it("interpolates variables", () => {
    expect(translate("en", "communePicker.title", { dept: "75" })).toBe(
      "Communes · dept. 75",
    );
    expect(translate("fr", "communePicker.title", { dept: "75" })).toBe(
      "Communes · dépt. 75",
    );
  });
});
