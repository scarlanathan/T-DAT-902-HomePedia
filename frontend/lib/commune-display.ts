import type { LocationRow } from "@/api";

type CommuneCodeFields = Pick<LocationRow, "code_postal" | "code_commune">;
type CommuneLabelFields = Pick<
  LocationRow,
  "nom_commune" | "code_postal" | "code_commune"
>;

/** Postal code for UI; falls back to INSEE when DVF has no postal yet. */
export function communePostalCode(loc: CommuneCodeFields): string {
  const postal = loc.code_postal?.trim();
  return postal || loc.code_commune;
}

export function formatCommuneLabel(loc: CommuneLabelFields): string {
  const name = loc.nom_commune?.trim();
  const code = communePostalCode(loc);
  return name ? `${name} (${code})` : code;
}
