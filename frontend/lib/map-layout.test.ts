import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRANCE_DEFAULT_VIEW, MAP_PANEL_HEIGHT_CLASS, METRICS_MAP_PANEL_HEIGHT_CLASS } from "./map-layout";

describe("map-layout", () => {
  it("exports shared map panel height classes", () => {
    expect(MAP_PANEL_HEIGHT_CLASS).toContain("min(56vh,560px)");
    expect(MAP_PANEL_HEIGHT_CLASS).toContain("min-h-[340px]");
  });

  it("exports taller metrics map panel height", () => {
    expect(METRICS_MAP_PANEL_HEIGHT_CLASS).toContain("min(68vh,720px)");
    expect(METRICS_MAP_PANEL_HEIGHT_CLASS).toContain("min-h-[420px]");
  });

  it("emits map panel height utilities in the built Tailwind CSS", () => {
    const outDir = mkdtempSync(join(tmpdir(), "homepedia-tailwind-"));
    const outFile = join(outDir, "out.css");
    const frontendRoot = join(import.meta.dirname, "..");

    try {
      execSync(
        `npx tailwindcss -i "${join(frontendRoot, "app/globals.css")}" -o "${outFile}"`,
        { cwd: frontendRoot, stdio: "pipe" },
      );
      const css = readFileSync(outFile, "utf8");
      expect(css).toContain("56vh");
      expect(css).toMatch(/min-height:\s*340px/);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("exports France default map view", () => {
    expect(FRANCE_DEFAULT_VIEW).toEqual({
      longitude: 2.35,
      latitude: 46.9,
      zoom: 5.85,
    });
  });
});
