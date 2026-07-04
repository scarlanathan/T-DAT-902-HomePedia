/** Shared height for the sales map and commune picker sidebar. */
export const MAP_PANEL_HEIGHT_CLASS = "h-[min(56vh,560px)] min-h-[340px]";

/** Taller map panel on the metrics dashboard. */
export const METRICS_MAP_PANEL_HEIGHT_CLASS = "h-[min(68vh,720px)] min-h-[420px]";

/** Default map view for metropolitan France before GeoJSON bounds are applied. */
export const FRANCE_DEFAULT_VIEW = {
  longitude: 2.35,
  latitude: 46.9,
  zoom: 5.85,
} as const;
