import type { Map as MapLibreMap } from "maplibre-gl";
import type { Theme } from "@/lib/theme-context";

export const MAP_DARK_BG = "#0a0f18";
export const MAP_NEIGHBOR_COLOR = "#1a2332";
export const MAP_LIGHT_BG = "#eef2f8";
export const MAP_LIGHT_NEIGHBOR = "#d4dce8";

const HIDDEN_BASE_LAYERS = [
  "countries-label",
  "geolines-label",
  "geolines",
  "coastline",
  "countries-boundary",
] as const;

export type MapLayerStyles = {
  deptLineDefault: string;
  deptLineSelected: string;
  deptLabelColor: string;
  deptLabelHalo: string;
  deptLabelHaloWidth: number;
  communeLabelColor: string;
  communeLabelHalo: string;
  communeLabelHaloWidth: number;
};

export function mapLayerStyles(theme: Theme): MapLayerStyles {
  if (theme === "dark") {
    return {
      deptLineDefault: "#0f172a",
      deptLineSelected: "#7dd3fc",
      deptLabelColor: "#ffffff",
      deptLabelHalo: "rgba(0,0,0,0)",
      deptLabelHaloWidth: 0,
      communeLabelColor: "#ffffff",
      communeLabelHalo: "rgba(0,0,0,0)",
      communeLabelHaloWidth: 0,
    };
  }

  return {
    deptLineDefault: "#94a3b8",
    deptLineSelected: "#1d4ed8",
    deptLabelColor: "#000000",
    deptLabelHalo: "rgba(0,0,0,0)",
    deptLabelHaloWidth: 0,
    communeLabelColor: "#000000",
    communeLabelHalo: "rgba(0,0,0,0)",
    communeLabelHaloWidth: 0,
  };
}

function hideLayer(map: MapLibreMap, layerId: string): void {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", "none");
  }
}

/** Theme-aware basemap: light surroundings in light mode, dark in dark mode. */
export function applyFranceBasemapStyle(
  map: MapLibreMap,
  theme: Theme = "dark",
): void {
  const isDark = theme === "dark";
  const ocean = isDark ? MAP_DARK_BG : MAP_LIGHT_BG;
  const neighbor = isDark ? MAP_NEIGHBOR_COLOR : MAP_LIGHT_NEIGHBOR;

  if (map.getLayer("background")) {
    map.setPaintProperty("background", "background-color", ocean);
  }

  if (map.getLayer("countries-fill")) {
    map.setPaintProperty("countries-fill", "fill-color", [
      "case",
      ["==", ["get", "ADM0_A3"], "FRA"],
      ocean,
      neighbor,
    ]);
  }

  if (map.getLayer("crimea-fill")) {
    map.setPaintProperty("crimea-fill", "fill-color", neighbor);
  }

  for (const layerId of HIDDEN_BASE_LAYERS) {
    hideLayer(map, layerId);
  }
}
