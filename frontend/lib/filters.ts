/** Dashboard filters aligned with backend query params. */

export type DashboardFilters = {
  codeCommune: string;
  nomCommune: string;
  /** Representative postal code for display (API filter still uses INSEE code_commune). */
  codePostal: string;
  from: string;
  to: string;
  /** DVF `type_local`; empty = no filter. */
  typeLocal: "" | "Appartement" | "Maison";
};

/** No commune selected until the user picks one from the API. */
export const EMPTY_FILTERS: DashboardFilters = {
  codeCommune: "",
  nomCommune: "",
  codePostal: "",
  from: "",
  to: "",
  typeLocal: "",
};

export function hasCommuneSelected(f: DashboardFilters): boolean {
  return f.codeCommune.trim().length > 0;
}

/** Commune + date filters shared by most dashboard datasets (excludes DVF property type). */
export function communeQueryKey(f: DashboardFilters): string {
  return [f.codeCommune, f.from, f.to].join("|");
}

export function filtersQueryKey(f: DashboardFilters): string {
  return [communeQueryKey(f), f.typeLocal].join("|");
}
