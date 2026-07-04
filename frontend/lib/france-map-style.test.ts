import { describe, expect, it, vi } from "vitest";
import {
  applyFranceBasemapStyle,
  MAP_DARK_BG,
  MAP_LIGHT_BG,
  MAP_LIGHT_NEIGHBOR,
  MAP_NEIGHBOR_COLOR,
  mapLayerStyles,
} from "./france-map-style";

describe("mapLayerStyles", () => {
  it("uses white labels without halo in dark mode", () => {
    const styles = mapLayerStyles("dark");
    expect(styles.deptLabelColor).toBe("#ffffff");
    expect(styles.communeLabelColor).toBe("#ffffff");
    expect(styles.deptLabelHaloWidth).toBe(0);
    expect(styles.communeLabelHaloWidth).toBe(0);
  });

  it("uses black labels without halo in light mode", () => {
    const styles = mapLayerStyles("light");
    expect(styles.deptLabelColor).toBe("#000000");
    expect(styles.communeLabelColor).toBe("#000000");
    expect(styles.deptLabelHaloWidth).toBe(0);
  });
});

describe("applyFranceBasemapStyle", () => {
  function mockMap(layers: string[]) {
    const paint: Record<string, Record<string, unknown>> = {};
    const layout: Record<string, Record<string, unknown>> = {};
    return {
      getLayer: vi.fn((id: string) => (layers.includes(id) ? { id } : undefined)),
      setPaintProperty: vi.fn((layerId: string, prop: string, value: unknown) => {
        paint[layerId] ??= {};
        paint[layerId][prop] = value;
      }),
      setLayoutProperty: vi.fn((layerId: string, prop: string, value: unknown) => {
        layout[layerId] ??= {};
        layout[layerId][prop] = value;
      }),
      paint,
      layout,
    };
  }

  it("applies dark ocean and neighbor colors", () => {
    const map = mockMap(["background", "countries-fill", "countries-label"]);
    applyFranceBasemapStyle(map as never, "dark");

    expect(map.paint.background["background-color"]).toBe(MAP_DARK_BG);
    expect(map.paint["countries-fill"]["fill-color"]).toEqual([
      "case",
      ["==", ["get", "ADM0_A3"], "FRA"],
      MAP_DARK_BG,
      MAP_NEIGHBOR_COLOR,
    ]);
    expect(map.layout["countries-label"].visibility).toBe("none");
  });

  it("applies light ocean and neighbor colors", () => {
    const map = mockMap(["background", "countries-fill"]);
    applyFranceBasemapStyle(map as never, "light");

    expect(map.paint.background["background-color"]).toBe(MAP_LIGHT_BG);
    expect(map.paint["countries-fill"]["fill-color"]).toEqual([
      "case",
      ["==", ["get", "ADM0_A3"], "FRA"],
      MAP_LIGHT_BG,
      MAP_LIGHT_NEIGHBOR,
    ]);
  });
});
