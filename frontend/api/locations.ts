import { apiGet } from "./client";
import type { DepartmentRow, LocationRow, RegionRow } from "./types";

export function listLocations(limit = 20): Promise<LocationRow[]> {
  return apiGet<LocationRow[]>("/locations", { limit });
}

export function searchLocations(q: string, limit = 20): Promise<LocationRow[]> {
  return apiGet<LocationRow[]>("/locations", { q, limit });
}

export function fetchLocation(codeCommune: string): Promise<LocationRow> {
  return apiGet<LocationRow>(`/locations/${encodeURIComponent(codeCommune)}`);
}

export function listDepartments(params?: {
  code_region?: string;
  limit?: number;
}): Promise<DepartmentRow[]> {
  return apiGet<DepartmentRow[]>("/locations/departments", params);
}

export function fetchDepartment(codeDepartement: string): Promise<DepartmentRow> {
  return apiGet<DepartmentRow>(
    `/locations/departments/${encodeURIComponent(codeDepartement)}`,
  );
}

export function listRegions(limit = 50): Promise<RegionRow[]> {
  return apiGet<RegionRow[]>("/locations/regions", { limit });
}

export function listLocationsByDepartment(
  codeDepartement: string,
  limit = 500,
  offset = 0,
): Promise<LocationRow[]> {
  return apiGet<LocationRow[]>(
    `/locations/departments/${encodeURIComponent(codeDepartement)}/communes`,
    { limit, offset },
  );
}

const DEPARTMENT_COMMUNES_PAGE_SIZE = 500;

/** Load every commune in a department (paginated). */
export async function listAllLocationsByDepartment(
  codeDepartement: string,
): Promise<LocationRow[]> {
  const rows: LocationRow[] = [];
  let offset = 0;

  for (;;) {
    const page = await listLocationsByDepartment(
      codeDepartement,
      DEPARTMENT_COMMUNES_PAGE_SIZE,
      offset,
    );
    rows.push(...page);
    if (page.length < DEPARTMENT_COMMUNES_PAGE_SIZE) break;
    offset += DEPARTMENT_COMMUNES_PAGE_SIZE;
  }

  return rows;
}

export async function resolveLocationForDepartment(
  codeDepartement: string,
): Promise<LocationRow | null> {
  const rows = await listAllLocationsByDepartment(codeDepartement);
  return rows[0] ?? null;
}
