import { describe, expect, it } from "vitest";
import {
  enrichForecastDepartments,
  forecastChangeColor,
  forecastNoDataColor,
} from "./forecast-map";

describe("forecastChangeColor", () => {
  it("uses grey for missing values", () => {
    expect(forecastChangeColor(null, "light")).toBe(forecastNoDataColor("light"));
  });

  it("is red for declines, green for growth and clamps at the ends", () => {
    const down = forecastChangeColor(-4, "light");
    const up = forecastChangeColor(4, "light");
    expect(down).toBe("#b91c1c");
    expect(up).toBe("#15803d");
    expect(forecastChangeColor(-10, "light")).toBe(down);
    expect(forecastChangeColor(0, "light")).toBe("#f1f5f9");
  });
});

describe("enrichForecastDepartments", () => {
  it("attaches change and color, flags departments without data", () => {
    const geo = {
      type: "FeatureCollection" as const,
      features: [
        { type: "Feature" as const, properties: { code: "69", nom: "Rhône" }, geometry: null },
        { type: "Feature" as const, properties: { code: "67", nom: "Bas-Rhin" }, geometry: null },
      ],
    };
    const out = enrichForecastDepartments(
      geo,
      [
        {
          code: "69",
          nom: "Rhône",
          last_price: "4000",
          forecast_price: "4080",
          change_pct: "2",
          lower_80: null,
          upper_80: null,
          annual_sales: "1000",
          reliability: "elevee",
        },
      ],
      "light",
      "69",
    );
    expect(out.features[0].properties).toMatchObject({
      hp_has_data: 1,
      hp_change: 2,
      hp_forecast_price: 4080,
      hp_selected: 1,
    });
    expect(out.features[1].properties).toMatchObject({ hp_has_data: 0, hp_selected: 0 });
    expect(out.features[1].properties.hp_fill_color).toBe(forecastNoDataColor("light"));
  });
});
