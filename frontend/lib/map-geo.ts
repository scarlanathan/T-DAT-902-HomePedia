import type { Theme } from "@/lib/theme-context";

export type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: unknown;
  }>;
};

/** Metropolitan France only (legacy). Prefer *_WITH_OVERSEAS URLs below. */
export const DEPARTMENTS_METRO_GEOJSON_URL =
  "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson";

export const COMMUNES_METRO_GEOJSON_URL =
  "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/communes-version-simplifiee.geojson";

/** Includes Corsica (2A/2B) and DROM-COM (971-976). */
export const DEPARTMENTS_GEOJSON_URL =
  "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-avec-outre-mer.geojson";

export const COMMUNES_GEOJSON_URL =
  "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/communes-avec-outre-mer.geojson";

let communesGeoCache: GeoJSONFeatureCollection | null = null;
let communesGeoPromise: Promise<GeoJSONFeatureCollection> | null = null;

export function loadCommunesGeoJson(): Promise<GeoJSONFeatureCollection> {
  if (communesGeoCache) return Promise.resolve(communesGeoCache);
  if (!communesGeoPromise) {
    communesGeoPromise = fetch(COMMUNES_GEOJSON_URL).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GeoJSONFeatureCollection;
      communesGeoCache = data;
      return data;
    });
  }
  return communesGeoPromise;
}

export function communeCodeFromFeature(
  props: Record<string, unknown>,
): string | null {
  const code = props.code ?? props.code_commune;
  if (typeof code === "string" && code.trim()) return code.trim();
  if (typeof code === "number") return String(code).padStart(5, "0");
  return null;
}

export function filterCommunesGeoJson(
  data: GeoJSONFeatureCollection,
  codes: Set<string>,
  selectedCommune?: string,
  mapTheme: Theme = "dark",
): GeoJSONFeatureCollection {
  return {
    type: "FeatureCollection",
    features: data.features
      .filter((feature) => {
        const code = communeCodeFromFeature(feature.properties);
        return code != null && codes.has(code);
      })
      .map((feature) => {
        const code = communeCodeFromFeature(feature.properties) ?? "";
        return {
          ...feature,
          properties: {
            ...feature.properties,
            hp_code: code,
            hp_fill_color: code
              ? departmentBlueColor(code, mapTheme)
              : "#3b82f6",
            hp_selected:
              code && selectedCommune && code === selectedCommune ? 1 : 0,
          },
        };
      }),
  };
}

export function findCommuneBounds(
  data: GeoJSONFeatureCollection,
  codeCommune: string,
): LngLatBounds | null {
  const feature = data.features.find(
    (f) => communeCodeFromFeature(f.properties) === codeCommune,
  );
  return feature ? boundsFromGeometry(feature.geometry) : null;
}

export type LngLatBounds = [[number, number], [number, number]];

export function boundsFromGeometry(geometry: unknown): LngLatBounds | null {
  if (!geometry || typeof geometry !== "object") return null;
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g.type !== "Polygon" && g.type !== "MultiPolygon") return null;

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lon, lat] = coords;
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      return;
    }
    for (const c of coords) visit(c);
  };

  visit(g.coordinates);
  if (!Number.isFinite(minLon)) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

export function findDepartmentBounds(
  data: GeoJSONFeatureCollection,
  codeDepartement: string,
): LngLatBounds | null {
  const feature = data.features.find(
    (f) => departmentCodeFromFeature(f.properties) === codeDepartement,
  );
  return feature ? boundsFromGeometry(feature.geometry) : null;
}

/** Union bounding box of all features (e.g. France métropolitaine + DROM-COM). */
export function boundsFromFeatureCollection(
  data: GeoJSONFeatureCollection,
): LngLatBounds | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const feature of data.features) {
    const bounds = boundsFromGeometry(feature.geometry);
    if (!bounds) continue;
    minLon = Math.min(minLon, bounds[0][0]);
    minLat = Math.min(minLat, bounds[0][1]);
    maxLon = Math.max(maxLon, bounds[1][0]);
    maxLat = Math.max(maxLat, bounds[1][1]);
  }

  if (!Number.isFinite(minLon)) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

export function departmentCodeFromFeature(
  props: Record<string, unknown>,
): string | null {
  const code = props.code ?? props.code_departement;
  if (typeof code === "string" && code.trim()) return code.trim();
  if (typeof code === "number") {
    const s = String(code);
    return s.length >= 3 ? s : s.padStart(2, "0");
  }
  return null;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h / 360 + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h / 360) * 255);
  const b = Math.round(hue2rgb(p, q, h / 360 - 1 / 3) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Deterministic blue shade for a department or commune code. */
export function departmentBlueColor(
  code: string,
  mapTheme: Theme = "dark",
): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) | 0;
  }
  const hue = 195 + (Math.abs(hash) % 55);
  const sat =
    mapTheme === "light"
      ? 50 + (Math.abs(hash >> 4) % 35)
      : 55 + (Math.abs(hash >> 4) % 35);
  const light =
    mapTheme === "light"
      ? 52 + (Math.abs(hash >> 8) % 16)
      : 36 + (Math.abs(hash >> 8) % 30);
  return hslToHex(hue, sat, light);
}

export function enrichDepartmentsGeoJson(
  data: GeoJSONFeatureCollection,
  selectedDepartment?: string,
  mapTheme: Theme = "dark",
): GeoJSONFeatureCollection {
  return {
    ...data,
    features: data.features.map((feature) => {
      const code = departmentCodeFromFeature(feature.properties);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          hp_dept: code ?? "",
          hp_fill_color: code
            ? departmentBlueColor(code, mapTheme)
            : "#93c5fd",
          hp_selected: code && selectedDepartment && code === selectedDepartment ? 1 : 0,
        },
      };
    }),
  };
}
