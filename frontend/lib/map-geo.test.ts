import { describe, expect, it } from "vitest";
import {
  boundsFromGeometry,
  boundsFromFeatureCollection,
  communeCodeFromFeature,
  departmentCodeFromFeature,
  departmentBlueColor,
  enrichDepartmentsGeoJson,
  filterCommunesGeoJson,
  findCommuneBounds,
  findDepartmentBounds,
} from "./map-geo";

describe("boundsFromGeometry", () => {
  it("computes bounds for a polygon", () => {
    const bounds = boundsFromGeometry({
      type: "Polygon",
      coordinates: [
        [
          [1, 46],
          [3, 46],
          [3, 48],
          [1, 48],
          [1, 46],
        ],
      ],
    });
    expect(bounds).toEqual([
      [1, 46],
      [3, 48],
    ]);
  });
});

describe("boundsFromFeatureCollection", () => {
  it("unions bounds across features", () => {
    const bounds = boundsFromFeatureCollection({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { code: "75" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [2, 48],
                [3, 48],
                [3, 49],
                [2, 49],
                [2, 48],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { code: "971" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-62, 15],
                [-61, 15],
                [-61, 16],
                [-62, 16],
                [-62, 15],
              ],
            ],
          },
        },
      ],
    });
    expect(bounds).toEqual([
      [-62, 15],
      [3, 49],
    ]);
  });
});

describe("findDepartmentBounds", () => {
  it("finds bounds by department code", () => {
    const bounds = findDepartmentBounds(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { code: "75" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [2, 48],
                  [2.5, 48],
                  [2.5, 48.5],
                  [2, 48.5],
                  [2, 48],
                ],
              ],
            },
          },
        ],
      },
      "75",
    );
    expect(bounds?.[0]).toEqual([2, 48]);
  });
});

describe("filterCommunesGeoJson", () => {
  it("keeps only communes present in the API set", () => {
    const filtered = filterCommunesGeoJson(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { code: "75101", nom: "Paris" },
            geometry: {},
          },
          {
            type: "Feature",
            properties: { code: "99999", nom: "Other" },
            geometry: {},
          },
        ],
      },
      new Set(["75101"]),
      "75101",
    );
    expect(filtered.features).toHaveLength(1);
    expect(filtered.features[0].properties.hp_selected).toBe(1);
    expect(filtered.features[0].properties.hp_fill_color).toBe(
      departmentBlueColor("75101"),
    );
  });
});

describe("communeCodeFromFeature", () => {
  it("reads commune code from feature properties", () => {
    expect(communeCodeFromFeature({ code: "75101", nom: "Paris" })).toBe(
      "75101",
    );
    expect(communeCodeFromFeature({ code_commune: "01094" })).toBe("01094");
    expect(communeCodeFromFeature({ code: "2A004" })).toBe("2A004");
    expect(communeCodeFromFeature({ code: "97105" })).toBe("97105");
  });
});

describe("findCommuneBounds", () => {
  it("finds bounds by commune code", () => {
    const bounds = findCommuneBounds(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { code: "75101" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [2.3, 48.8],
                  [2.4, 48.8],
                  [2.4, 48.9],
                  [2.3, 48.9],
                  [2.3, 48.8],
                ],
              ],
            },
          },
        ],
      },
      "75101",
    );
    expect(bounds?.[0]).toEqual([2.3, 48.8]);
  });
});

describe("departmentCodeFromFeature", () => {
  it("reads code from feature properties", () => {
    expect(departmentCodeFromFeature({ code: "75", nom: "Paris" })).toBe("75");
    expect(departmentCodeFromFeature({ code_departement: "01" })).toBe("01");
    expect(departmentCodeFromFeature({ code: "2A" })).toBe("2A");
    expect(departmentCodeFromFeature({ code: "971" })).toBe("971");
    expect(departmentCodeFromFeature({ code: 971 })).toBe("971");
  });
});

describe("departmentBlueColor", () => {
  it("returns stable blue hex colors per department code", () => {
    const paris = departmentBlueColor("75");
    const ain = departmentBlueColor("01");
    expect(paris).toMatch(/^#[0-9a-f]{6}$/i);
    expect(ain).toMatch(/^#[0-9a-f]{6}$/i);
    expect(paris).toBe(departmentBlueColor("75"));
    expect(paris).not.toBe(ain);
  });

  it("uses lighter blues in light map theme", () => {
    const dark = departmentBlueColor("75", "dark");
    const light = departmentBlueColor("75", "light");
    expect(dark).not.toBe(light);
  });
});

describe("enrichDepartmentsGeoJson", () => {
  it("marks selected department", () => {
    const enriched = enrichDepartmentsGeoJson(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { code: "75" },
            geometry: {},
          },
          {
            type: "Feature",
            properties: { code: "01" },
            geometry: {},
          },
        ],
      },
      "75",
    );
    expect(enriched.features[0].properties.hp_selected).toBe(1);
    expect(enriched.features[1].properties.hp_selected).toBe(0);
    expect(enriched.features[0].properties.hp_fill_color).toBe(
      departmentBlueColor("75"),
    );
    expect(enriched.features[1].properties.hp_fill_color).toBe(
      departmentBlueColor("01"),
    );
  });
});
