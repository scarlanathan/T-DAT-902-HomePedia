"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  type MapRef,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre";
import {
  fetchLocation,
  fetchTransactions,
  type LocationRow,
  type MapTransactionPoint,
  type TransactionRow,
} from "@/api";
import {
  DEPARTMENTS_METRO_GEOJSON_URL,
  boundsFromGeometry,
  boundsFromFeatureCollection,
  communeCodeFromFeature,
  departmentCodeFromFeature,
  enrichDepartmentsGeoJson,
  filterCommunesGeoJson,
  findCommuneBounds,
  findDepartmentBounds,
  loadCommunesGeoJson,
  type GeoJSONFeatureCollection,
  type LngLatBounds,
} from "@/lib/map-geo";
import { parseNumeric } from "@/lib/format";
import { useLocale } from "@/lib/locale-context";
import { applyFranceBasemapStyle, mapLayerStyles } from "@/lib/france-map-style";
import { FRANCE_DEFAULT_VIEW, MAP_PANEL_HEIGHT_CLASS } from "@/lib/map-layout";
import { useTheme } from "@/lib/theme-context";

import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE = "https://demotiles.maplibre.org/style.json";

type Props = {
  from?: string;
  to?: string;
  selectedCommune?: string;
  /** Department highlighted after map click or commune selection. */
  focusedDepartment?: string;
  /** Communes (villes) in the focused department from the API. */
  departmentCommunes?: LocationRow[];
  onCommuneSelect?: (loc: LocationRow) => void;
  onDepartmentFocus?: (codeDepartement: string) => void;
  /** Pan/zoom only; disables commune and department picking on the map. */
  readOnly?: boolean;
  panelClassName?: string;
};

type MapFeature = {
  layer?: { id?: string };
  properties?: Record<string, unknown>;
  geometry?: GeoJSON.Geometry;
};

function transactionsToMapPoints(rows: TransactionRow[]): MapTransactionPoint[] {
  return rows.flatMap((row) => {
    if (row.longitude == null || row.latitude == null) return [];
    return [
      {
        transaction_id: row.transaction_id,
        date_mutation: row.date_mutation,
        valeur_fonciere: row.valeur_fonciere,
        price_per_sqm_built: row.price_per_sqm_built,
        type_local: row.type_local,
        longitude: row.longitude,
        latitude: row.latitude,
        code_commune: row.code_commune ?? null,
      },
    ];
  });
}

function pointsToGeoJson(
  points: MapTransactionPoint[],
  selectedCommune?: string,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((p) => {
      const priceM2 = parseNumeric(p.price_per_sqm_built) ?? 0;
      const code = p.code_commune ?? "";
      return {
        type: "Feature",
        properties: {
          transaction_id: p.transaction_id,
          priceM2,
          valeur_fonciere: p.valeur_fonciere,
          type_local: p.type_local,
          code_commune: code,
          hp_selected: code && selectedCommune && code === selectedCommune ? 1 : 0,
        },
        geometry: {
          type: "Point",
          coordinates: [p.longitude, p.latitude],
        },
      };
    }),
  };
}

export function FranceMap({
  from,
  to,
  selectedCommune,
  focusedDepartment,
  departmentCommunes = [],
  onCommuneSelect,
  onDepartmentFocus,
  readOnly = false,
  panelClassName = MAP_PANEL_HEIGHT_CLASS,
}: Props) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const mapRef = useRef<MapRef>(null);
  const [deptGeo, setDeptGeo] = useState<GeoJSONFeatureCollection | null>(null);
  const [communesGeoFull, setCommunesGeoFull] =
    useState<GeoJSONFeatureCollection | null>(null);
  const [communeGeo, setCommuneGeo] = useState<GeoJSONFeatureCollection | null>(
    null,
  );
  const [loadingCommunesGeo, setLoadingCommunesGeo] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [points, setPoints] = useState<MapTransactionPoint[]>([]);
  const [txError, setTxError] = useState<string | null>(null);
  const [loadingTx, setLoadingTx] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const fetchId = useRef(0);
  const prevSelectedCommune = useRef<string | undefined>(undefined);

  const highlightDepartment = focusedDepartment;
  const layerStyles = useMemo(() => mapLayerStyles(theme), [theme]);

  const interactiveLayers = useMemo(() => {
    const layers = ["fr-depts-fill"];
    if (communeGeo?.features.length) layers.unshift("fr-communes-fill");
    if (selectedCommune) layers.push("dvf-points-circle");
    return layers;
  }, [communeGeo, selectedCommune]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(DEPARTMENTS_METRO_GEOJSON_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as GeoJSONFeatureCollection;
        if (!cancelled) setDeptGeo(data);
      } catch (e) {
        if (!cancelled) {
          setGeoError(
            e instanceof Error ? e.message : t("map.errorDepartments"),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (departmentCommunes.length === 0) {
      setCommuneGeo(null);
      return;
    }

    let cancelled = false;
    setLoadingCommunesGeo(true);
    const codes = new Set(departmentCommunes.map((c) => c.code_commune));

    void loadCommunesGeoJson()
      .then((data) => {
        if (cancelled) return;
        setCommunesGeoFull(data);
        setCommuneGeo(filterCommunesGeoJson(data, codes, selectedCommune, theme));
      })
      .catch(() => {
        if (!cancelled) setCommuneGeo(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingCommunesGeo(false);
      });

    return () => {
      cancelled = true;
    };
  }, [departmentCommunes, selectedCommune, theme]);

  const deptData = useMemo(() => {
    if (!deptGeo) return null;
    return enrichDepartmentsGeoJson(deptGeo, highlightDepartment, theme);
  }, [deptGeo, highlightDepartment, theme]);

  useEffect(() => {
    if (!selectedCommune) {
      setPoints([]);
      setTxError(null);
      setLoadingTx(false);
      return;
    }

    let cancelled = false;
    const id = ++fetchId.current;
    setLoadingTx(true);
    setTxError(null);

    void fetchTransactions({
      code_commune: selectedCommune,
      from,
      to,
      limit: 1000,
      include_location: false,
    })
      .then((rows) => {
        if (cancelled || id !== fetchId.current) return;
        setPoints(transactionsToMapPoints(rows));
      })
      .catch((e) => {
        if (cancelled || id !== fetchId.current) return;
        setTxError(e instanceof Error ? e.message : t("map.errorMapPoints"));
        setPoints([]);
      })
      .finally(() => {
        if (!cancelled && id === fetchId.current) setLoadingTx(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCommune, from, to, t]);

  const pointData = useMemo(
    () => pointsToGeoJson(points, selectedCommune),
    [points, selectedCommune],
  );

  const fitToBounds = useCallback((bounds: LngLatBounds, maxZoom: number) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.fitBounds(bounds, {
      padding: 48,
      maxZoom,
      duration: 700,
    });
  }, []);

  const resetToFranceView = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const bounds = deptGeo ? boundsFromFeatureCollection(deptGeo) : null;
    if (bounds) {
      fitToBounds(bounds, 6);
      return;
    }
    map.flyTo({ ...FRANCE_DEFAULT_VIEW, duration: 700 });
  }, [deptGeo, fitToBounds]);

  const fitToDepartment = useCallback(
    (codeDepartement: string, geometry?: GeoJSON.Geometry) => {
      let bounds: LngLatBounds | null = geometry
        ? boundsFromGeometry(geometry)
        : null;
      if (!bounds && deptGeo) {
        bounds = findDepartmentBounds(deptGeo, codeDepartement);
      }
      if (bounds) fitToBounds(bounds, 10);
    },
    [deptGeo, fitToBounds],
  );

  useEffect(() => {
    if (!deptGeo || selectedCommune || focusedDepartment) return;
    const bounds = boundsFromFeatureCollection(deptGeo);
    if (bounds) fitToBounds(bounds, 6);
  }, [deptGeo, selectedCommune, focusedDepartment, fitToBounds]);

  useEffect(() => {
    if (!selectedCommune || !communesGeoFull) return;
    const bounds = findCommuneBounds(communesGeoFull, selectedCommune);
    if (bounds) fitToBounds(bounds, 12);
  }, [selectedCommune, communesGeoFull, fitToBounds]);

  useEffect(() => {
    if (prevSelectedCommune.current && !selectedCommune) {
      resetToFranceView();
    }
    prevSelectedCommune.current = selectedCommune;
  }, [selectedCommune, resetToFranceView]);

  const selectCommune = useCallback(
    async (codeCommune: string) => {
      if (!onCommuneSelect || !codeCommune) return;
      setPickError(null);
      setResolving(true);
      try {
        const loc = await fetchLocation(codeCommune);
        onCommuneSelect(loc);
      } catch (e) {
        setPickError(
          e instanceof Error ? e.message : t("map.errorResolveCommune"),
        );
      } finally {
        setResolving(false);
      }
    },
    [onCommuneSelect, t],
  );

  const focusDepartment = useCallback(
    (codeDepartement: string, geometry?: GeoJSON.Geometry) => {
      fitToDepartment(codeDepartement, geometry);
      onDepartmentFocus?.(codeDepartement);
      setPickError(null);
    },
    [fitToDepartment, onDepartmentFocus],
  );

  const onMapClick = useCallback(
    (e: { features?: MapFeature[] }) => {
      if (!e.features?.length) return;

      const saleHit = e.features.find((f) => f.layer?.id === "dvf-points-circle");
      const codeFromSale = saleHit?.properties?.code_commune;
      if (typeof codeFromSale === "string" && codeFromSale) {
        void selectCommune(codeFromSale);
        return;
      }

      const communeHit = e.features.find((f) => f.layer?.id === "fr-communes-fill");
      if (communeHit?.properties) {
        const code =
          typeof communeHit.properties.hp_code === "string"
            ? communeHit.properties.hp_code
            : communeCodeFromFeature(communeHit.properties);
        if (code) {
          void selectCommune(code);
          return;
        }
      }

      const deptHit = e.features.find((f) => f.layer?.id === "fr-depts-fill");
      if (deptHit?.properties) {
        const code = departmentCodeFromFeature(deptHit.properties);
        if (code) focusDepartment(code, deptHit.geometry);
      }
    },
    [selectCommune, focusDepartment],
  );

  const setCanvasCursor = useCallback((cursor: string) => {
    const canvas = mapRef.current?.getMap().getCanvas();
    if (canvas) canvas.style.cursor = cursor;
  }, []);

  const onMapMouseMove = useCallback(
    (e: { features?: MapFeature[] }) => {
      const over = e.features?.some((f) =>
        interactiveLayers.includes(f.layer?.id ?? ""),
      );
      setCanvasCursor(over ? "pointer" : "");
    },
    [interactiveLayers, setCanvasCursor],
  );

  const onMapMouseLeave = useCallback(() => {
    setCanvasCursor("");
  }, [setCanvasCursor]);

  const onMapError = useCallback((e: { error?: Error }) => {
    setTxError(e.error?.message ?? t("map.errorGeneric"));
  }, [t]);

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) applyFranceBasemapStyle(map, theme);
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map?.loaded()) return;
    applyFranceBasemapStyle(map, theme);
  }, [theme]);

  return (
    <div
      className={`hp-map-shell ${panelClassName}`}
    >
      <div className="relative h-full w-full">
        <Map
          ref={mapRef}
          initialViewState={FRANCE_DEFAULT_VIEW}
          className="absolute inset-0 h-full w-full"
          style={{ width: "100%", height: "100%" }}
          mapStyle={MAP_STYLE}
          onLoad={onMapLoad}
          onError={onMapError}
          attributionControl={true}
          interactiveLayerIds={readOnly ? [] : interactiveLayers}
          onClick={readOnly ? undefined : onMapClick}
          onMouseMove={readOnly ? undefined : onMapMouseMove}
          onMouseLeave={readOnly ? undefined : onMapMouseLeave}
        >
          <NavigationControl position="top-right" showCompass={false} />
          {deptData ? (
            <Source id="fr-depts" type="geojson" data={deptData}>
              <Layer
                id="fr-depts-fill"
                type="fill"
                paint={{
                  "fill-color": ["get", "hp_fill_color"],
                  "fill-opacity": [
                    "case",
                    ["==", ["get", "hp_selected"], 1],
                    1,
                    0.88,
                  ],
                }}
              />
              <Layer
                id="fr-depts-line"
                type="line"
                paint={{
                  "line-color": [
                    "case",
                    ["==", ["get", "hp_selected"], 1],
                    layerStyles.deptLineSelected,
                    layerStyles.deptLineDefault,
                  ],
                  "line-width": [
                    "case",
                    ["==", ["get", "hp_selected"], 1],
                    2,
                    0.7,
                  ],
                  "line-opacity": 0.9,
                }}
              />
              {!communeGeo?.features.length ? (
                <Layer
                  id="fr-depts-label"
                  type="symbol"
                  layout={{
                    "text-field": [
                      "format",
                      ["get", "code"],
                      { "font-scale": 0.95 },
                      "\n",
                      {},
                      ["get", "nom"],
                      { "font-scale": 0.85 },
                    ],
                    "text-size": 11,
                    "text-anchor": "center",
                    "text-max-width": 7,
                    "text-line-height": 1.15,
                  }}
                  paint={{
                    "text-color": layerStyles.deptLabelColor,
                    "text-halo-color": layerStyles.deptLabelHalo,
                    "text-halo-width": layerStyles.deptLabelHaloWidth,
                    "text-halo-blur": 0,
                  }}
                />
              ) : null}
            </Source>
          ) : null}
          {communeGeo && communeGeo.features.length > 0 ? (
            <Source id="fr-communes" type="geojson" data={communeGeo}>
              <Layer
                id="fr-communes-fill"
                type="fill"
                paint={{
                  "fill-color": ["get", "hp_fill_color"],
                  "fill-opacity": [
                    "case",
                    ["==", ["get", "hp_selected"], 1],
                    1,
                    0.85,
                  ],
                }}
              />
              <Layer
                id="fr-communes-line"
                type="line"
                paint={{
                  "line-color": [
                    "case",
                    ["==", ["get", "hp_selected"], 1],
                    layerStyles.deptLineSelected,
                    layerStyles.deptLineDefault,
                  ],
                  "line-width": [
                    "case",
                    ["==", ["get", "hp_selected"], 1],
                    2,
                    0.7,
                  ],
                  "line-opacity": 0.9,
                }}
              />
              <Layer
                id="fr-communes-label"
                type="symbol"
                layout={{
                  "text-field": ["get", "nom"],
                  "text-size": 10,
                  "text-anchor": "center",
                  "text-max-width": 8,
                }}
                paint={{
                  "text-color": layerStyles.communeLabelColor,
                  "text-halo-color": layerStyles.communeLabelHalo,
                  "text-halo-width": layerStyles.communeLabelHaloWidth,
                  "text-halo-blur": 0,
                }}
              />
            </Source>
          ) : null}
          {selectedCommune ? (
            <Source id="dvf-points" type="geojson" data={pointData}>
              <Layer
                id="dvf-points-circle"
                type="circle"
                paint={{
                  "circle-radius": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    5,
                    3,
                    10,
                    6,
                    14,
                    10,
                  ],
                  "circle-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "priceM2"],
                    0,
                    "#e0f2fe",
                    2000,
                    "#7dd3fc",
                    4000,
                    "#3b82f6",
                    8000,
                    "#1d4ed8",
                    12000,
                    "#172554",
                  ],
                  "circle-opacity": 0.9,
                  "circle-stroke-width": 1,
                  "circle-stroke-color": "#fff",
                }}
              />
            </Source>
          ) : null}
        </Map>
        <div className="hp-map-overlay">
          {geoError ? (
            <span className="text-amber-800 dark:text-amber-300">
              {t("map.departmentsUnavailable", { error: geoError })}{" "}
            </span>
          ) : null}
          {selectedCommune
            ? loadingTx
              ? t("map.loadingSales")
              : points.length === 1
                ? t("map.saleOne", { count: points.length })
                : t("map.saleMany", { count: points.length })
            : focusedDepartment && departmentCommunes.length > 0
              ? departmentCommunes.length === 1
                ? t("map.communeOne", { count: departmentCommunes.length })
                : t("map.communeMany", { count: departmentCommunes.length })
              : readOnly
                ? t("ranking.mapHint")
                : t("map.selectCommune")}
          {txError ? (
            <span className="mt-1 block text-amber-800 dark:text-amber-300">{txError}</span>
          ) : null}
          {resolving && !selectedCommune ? (
            <span className="ml-1 text-ink-600 dark:text-ink-300">
              {t("map.resolving")}
            </span>
          ) : null}
          {pickError ? (
            <span className="mt-1 block text-amber-800 dark:text-amber-300">{pickError}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
