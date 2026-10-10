"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, type MapRef, Source } from "react-map-gl/maplibre";
import type { ForecastMapRow } from "@/api";
import {
  DEPARTMENTS_METRO_GEOJSON_URL,
  boundsFromFeatureCollection,
  departmentCodeFromFeature,
  type GeoJSONFeatureCollection,
} from "@/lib/map-geo";
import {
  DVF_MISSING_DEPARTMENTS,
  FORECAST_MAP_RANGE,
  enrichForecastDepartments,
  forecastLegendStops,
  forecastNoDataColor,
} from "@/lib/forecast-map";
import { applyFranceBasemapStyle, mapLayerStyles } from "@/lib/france-map-style";
import { FRANCE_DEFAULT_VIEW, MAP_PANEL_HEIGHT_CLASS } from "@/lib/map-layout";
import { useFormat, useLocale } from "@/lib/locale-context";
import { useTheme } from "@/lib/theme-context";

import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE = "https://demotiles.maplibre.org/style.json";
const FILL_LAYER = "fc-depts-fill";

type Props = {
  rows: ForecastMapRow[];
  loading?: boolean;
  selectedDepartment?: string;
  onSelectDepartment?: (code: string, nom: string | null) => void;
};

type MapFeature = {
  layer?: { id?: string };
  properties?: Record<string, unknown>;
};

type Hover = {
  x: number;
  y: number;
  code: string;
  nom: string;
  change: number | null;
  price: number | null;
};

function numberProp(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v !== "" && v !== "null") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function ForecastMap({
  rows,
  loading,
  selectedDepartment,
  onSelectDepartment,
}: Props) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const fmt = useFormat();
  const mapRef = useRef<MapRef>(null);
  const [geo, setGeo] = useState<GeoJSONFeatureCollection | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const layerStyles = useMemo(() => mapLayerStyles(theme), [theme]);

  useEffect(() => {
    let cancelled = false;
    void fetch(DEPARTMENTS_METRO_GEOJSON_URL)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as GeoJSONFeatureCollection;
        if (!cancelled) setGeo(data);
      })
      .catch(() => {
        if (!cancelled) setGeoError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(
    () => (geo ? enrichForecastDepartments(geo, rows, theme, selectedDepartment) : null),
    [geo, rows, theme, selectedDepartment],
  );

  useEffect(() => {
    if (!geo) return;
    const bounds = boundsFromFeatureCollection(geo);
    const map = mapRef.current?.getMap();
    if (bounds && map) map.fitBounds(bounds, { padding: 24, maxZoom: 6, duration: 0 });
  }, [geo]);

  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    applyFranceBasemapStyle(map, theme);
    if (geo) {
      const bounds = boundsFromFeatureCollection(geo);
      if (bounds) map.fitBounds(bounds, { padding: 24, maxZoom: 6, duration: 0 });
    }
  }, [theme, geo]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map?.loaded()) applyFranceBasemapStyle(map, theme);
  }, [theme]);

  const onMouseMove = useCallback(
    (e: { features?: MapFeature[]; point: { x: number; y: number } }) => {
      const f = e.features?.find((x) => x.layer?.id === FILL_LAYER);
      const canvas = mapRef.current?.getMap().getCanvas();
      if (!f?.properties) {
        setHover(null);
        if (canvas) canvas.style.cursor = "";
        return;
      }
      if (canvas) canvas.style.cursor = onSelectDepartment ? "pointer" : "";
      const p = f.properties;
      setHover({
        x: e.point.x,
        y: e.point.y,
        code: departmentCodeFromFeature(p) ?? "",
        nom: typeof p.nom === "string" ? p.nom : "",
        change: numberProp(p.hp_change),
        price: numberProp(p.hp_forecast_price),
      });
    },
    [onSelectDepartment],
  );

  const onClick = useCallback(
    (e: { features?: MapFeature[] }) => {
      const f = e.features?.find((x) => x.layer?.id === FILL_LAYER);
      if (!f?.properties || !onSelectDepartment) return;
      const code = departmentCodeFromFeature(f.properties);
      if (code) {
        onSelectDepartment(code, typeof f.properties.nom === "string" ? f.properties.nom : null);
      }
    },
    [onSelectDepartment],
  );

  const stops = forecastLegendStops(theme);
  const gradient = `linear-gradient(to right, ${stops.map((s) => s.color).join(", ")})`;

  return (
    <div className={`hp-map-shell ${MAP_PANEL_HEIGHT_CLASS}`} data-testid="forecast-map">
      <div className="relative h-full w-full">
        <Map
          ref={mapRef}
          initialViewState={FRANCE_DEFAULT_VIEW}
          style={{ width: "100%", height: "100%" }}
          mapStyle={MAP_STYLE}
          onLoad={onLoad}
          attributionControl={false}
          interactiveLayerIds={[FILL_LAYER]}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHover(null)}
          onClick={onClick}
        >
          {data ? (
            <Source id="fc-depts" type="geojson" data={data}>
              <Layer
                id={FILL_LAYER}
                type="fill"
                paint={{
                  "fill-color": ["get", "hp_fill_color"],
                  "fill-opacity": ["case", ["==", ["get", "hp_selected"], 1], 1, 0.9],
                }}
              />
              <Layer
                id="fc-depts-line"
                type="line"
                paint={{
                  "line-color": [
                    "case",
                    ["==", ["get", "hp_selected"], 1],
                    layerStyles.deptLineSelected,
                    layerStyles.deptLineDefault,
                  ],
                  "line-width": ["case", ["==", ["get", "hp_selected"], 1], 2.5, 0.6],
                }}
              />
            </Source>
          ) : null}
        </Map>

        {hover ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 min-w-[11rem] rounded-lg border border-ink-200/80 bg-white/95 px-3 py-2 text-xs shadow-elevated dark:border-ink-700/80 dark:bg-ink-900/95"
            style={{ left: hover.x + 12, top: hover.y + 12 }}
          >
            <p className="font-semibold text-ink-900 dark:text-ink-50">
              {hover.nom} ({hover.code})
            </p>
            {hover.change != null ? (
              <>
                <p className="text-ink-700 dark:text-ink-300">
                  {t("forecast.map.tooltipChange")}:{" "}
                  <span className="font-semibold tabular-nums">
                    {hover.change > 0 ? "+" : ""}
                    {fmt.formatPercent(hover.change)}
                  </span>
                </p>
                <p className="text-ink-700 dark:text-ink-300">
                  {t("forecast.map.tooltipPrice")}:{" "}
                  <span className="tabular-nums">
                    {fmt.formatFrNumber(hover.price, { maximumFractionDigits: 0 })}{" "}
                    {t("common.euroPerSqm")}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-ink-500 dark:text-ink-400">{t("forecast.map.noData")}</p>
            )}
          </div>
        ) : null}

        <div className="hp-map-overlay space-y-1.5">
          <p className="font-semibold text-ink-800 dark:text-ink-100">
            {t("forecast.map.legendTitle")}
          </p>
          <div className="h-2.5 w-48 rounded-full" style={{ background: gradient }} aria-hidden />
          <div className="flex w-48 justify-between tabular-nums">
            <span>−{FORECAST_MAP_RANGE} %</span>
            <span>0</span>
            <span>+{FORECAST_MAP_RANGE} %</span>
          </div>
          <p className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-ink-300 dark:ring-ink-600"
              style={{ background: forecastNoDataColor(theme) }}
              aria-hidden
            />
            {t("forecast.map.noDataLegend", { codes: DVF_MISSING_DEPARTMENTS.join(", ") })}
          </p>
          {loading ? <p>{t("common.loading")}</p> : null}
          {geoError ? (
            <p className="text-amber-800 dark:text-amber-300">{t("forecast.map.geoError")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
