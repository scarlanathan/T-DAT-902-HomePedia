import type { ForecastMapRow } from "@/api/types";
import { parseNumeric } from "@/lib/format";
import {
  departmentCodeFromFeature,
  type GeoJSONFeatureCollection,
} from "@/lib/map-geo";
import type { Theme } from "@/lib/theme-context";

/** Change (%) clamped at both ends of the diverging ramp. */
export const FORECAST_MAP_RANGE = 4;

/** Departments absent from DVF (Alsace-Moselle land register). */
export const DVF_MISSING_DEPARTMENTS = ["57", "67", "68"] as const;

type Rgb = [number, number, number];

const RED: Rgb = [185, 28, 28];
const RED_LIGHT: Rgb = [248, 113, 113];
const GREEN_LIGHT: Rgb = [74, 222, 128];
const GREEN: Rgb = [21, 128, 61];

function neutral(theme: Theme): Rgb {
  return theme === "dark" ? [71, 85, 105] : [241, 245, 249];
}

export function forecastNoDataColor(theme: Theme): string {
  return theme === "dark" ? "#1e293b" : "#cbd5e1";
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Diverging color for a forecast change in %: red (decline) → neutral (0) →
 * green (growth), saturated at ±FORECAST_MAP_RANGE.
 */
export function forecastChangeColor(
  changePct: number | null | undefined,
  theme: Theme = "light",
): string {
  if (changePct == null || !Number.isFinite(changePct)) return forecastNoDataColor(theme);
  const half = FORECAST_MAP_RANGE / 2;
  const v = Math.max(-FORECAST_MAP_RANGE, Math.min(FORECAST_MAP_RANGE, changePct));
  const mid = neutral(theme);
  if (v < 0) {
    const a = -v;
    return toHex(a <= half ? mix(mid, RED_LIGHT, a / half) : mix(RED_LIGHT, RED, (a - half) / half));
  }
  return toHex(v <= half ? mix(mid, GREEN_LIGHT, v / half) : mix(GREEN_LIGHT, GREEN, (v - half) / half));
}

/** Legend stops from -range to +range. */
export function forecastLegendStops(theme: Theme): { value: number; color: string }[] {
  const r = FORECAST_MAP_RANGE;
  return [-r, -r / 2, 0, r / 2, r].map((value) => ({
    value,
    color: forecastChangeColor(value, theme),
  }));
}

/** Adds fill color, change and price properties to department features. */
export function enrichForecastDepartments(
  geo: GeoJSONFeatureCollection,
  rows: ForecastMapRow[],
  theme: Theme,
  selectedDepartment?: string,
): GeoJSONFeatureCollection {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  return {
    ...geo,
    features: geo.features.map((feature) => {
      const code = departmentCodeFromFeature(feature.properties) ?? "";
      const row = byCode.get(code);
      const change = parseNumeric(row?.change_pct);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          hp_dept: code,
          hp_has_data: row && change != null ? 1 : 0,
          hp_change: change,
          hp_forecast_price: parseNumeric(row?.forecast_price),
          hp_fill_color: forecastChangeColor(change, theme),
          hp_selected: code && code === selectedDepartment ? 1 : 0,
        },
      };
    }),
  };
}
