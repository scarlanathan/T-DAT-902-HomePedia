import { describe, expect, it } from "vitest";
import tailwindConfig from "./tailwind.config";

describe("tailwind config", () => {
  it("scans lib so shared layout classes from map-layout are emitted", () => {
    const content = tailwindConfig.content as string[];
    expect(content.some((pattern) => pattern.includes("./lib/"))).toBe(true);
  });

  it("safelists map panel height utilities referenced via JS constants", () => {
    const safelist = tailwindConfig.safelist as string[];
    expect(safelist).toEqual(
      expect.arrayContaining([
        "h-[min(56vh,560px)]",
        "min-h-[340px]",
        "h-[min(68vh,720px)]",
        "min-h-[420px]",
        "max-w-[96rem]",
      ]),
    );
  });

  it("uses class-based dark mode", () => {
    expect(tailwindConfig.darkMode).toBe("class");
  });
});
