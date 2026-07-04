import { apiGet } from "./client";
import type { EquipmentRow } from "./types";

export function fetchEquipment(params: {
  code_commune?: string;
  code_departement?: string;
  equipment_category?: string;
  limit?: number;
  include_location?: boolean;
}): Promise<EquipmentRow[]> {
  return apiGet<EquipmentRow[]>("/equipment", params);
}
