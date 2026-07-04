import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

export type EquipmentRow = {
  equipment_id: string;
  location_id: string;
  code_commune: string;
  code_iris: string | null;
  millesime: number | null;
  typequ: string | null;
  equipment_category: string | null;
  lambert_x: string | null;
  lambert_y: string | null;
  qualite_xy: string | null;
  source_file: string | null;
  ingested_at: string;
  nom_commune?: string | null;
};

@Injectable()
export class EquipmentService {
  constructor(private readonly db: DbService) {}

  async list(params: {
    codeCommune?: string;
    codeDepartement?: string;
    equipmentCategory?: string;
    limit: number;
    offset: number;
    includeLocation: boolean;
  }): Promise<EquipmentRow[]> {
    const where: string[] = [];
    const values: any[] = [];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    if (params.codeCommune) where.push(`f.code_commune = ${add(params.codeCommune)}`);
    if (params.codeDepartement) where.push(`d.code_departement = ${add(params.codeDepartement)}`);
    if (params.equipmentCategory) where.push(`f.equipment_category = ${add(params.equipmentCategory)}`);

    const selectLocation = params.includeLocation ? `, d.nom_commune` : '';

    const res = await this.db.query<EquipmentRow>(
      `
      SELECT
        f.equipment_id,
        f.location_id,
        f.code_commune,
        f.code_iris,
        f.millesime,
        f.typequ,
        f.equipment_category,
        f.lambert_x,
        f.lambert_y,
        f.qualite_xy,
        f.source_file,
        f.ingested_at
        ${selectLocation}
      FROM fact_equipment f
      JOIN dim_location d ON d.location_id = f.location_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY f.code_commune, f.equipment_id
      LIMIT ${add(params.limit)}
      OFFSET ${add(params.offset)}
      `,
      values,
    );
    return res.rows;
  }
}
