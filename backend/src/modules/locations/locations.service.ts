import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

const LOCATION_COLUMNS = `
  location_id,
  code_commune,
  nom_commune,
  code_departement,
  code_region,
  type_commune,
  code_commune_parent,
  cog_millesime,
  code_postal
`;

export type LocationRow = {
  location_id: string;
  code_commune: string;
  nom_commune: string | null;
  code_departement: string | null;
  code_region: string | null;
  type_commune: string | null;
  code_commune_parent: string | null;
  cog_millesime: number | null;
  code_postal: string | null;
};

export type DepartmentRow = {
  departement_id: string;
  code_departement: string;
  nom_departement: string | null;
  code_region: string | null;
  code_commune_cheflieu: string | null;
  cog_millesime: number | null;
};

export type RegionRow = {
  region_id: string;
  code_region: string;
  nom_region: string | null;
  code_commune_cheflieu: string | null;
  cog_millesime: number | null;
};

@Injectable()
export class LocationsService {
  constructor(private readonly db: DbService) {}

  async search(params: { q?: string; limit: number }): Promise<LocationRow[]> {
    const { q, limit } = params;

    if (!q) {
      const res = await this.db.query<LocationRow>(
        `
        SELECT ${LOCATION_COLUMNS}
        FROM dim_location
        ORDER BY code_commune
        LIMIT $1
        `,
        [limit],
      );
      return res.rows;
    }

    const qLike = `%${q}%`;
    const res = await this.db.query<LocationRow>(
      `
      SELECT ${LOCATION_COLUMNS}
      FROM dim_location
      WHERE code_commune ILIKE $1
         OR nom_commune ILIKE $1
         OR code_postal ILIKE $1
      ORDER BY
        CASE
          WHEN code_postal ILIKE $2 THEN 0
          WHEN code_commune ILIKE $2 THEN 1
          ELSE 2
        END,
        code_commune
      LIMIT $3
      `,
      [qLike, `${q}%`, limit],
    );
    return res.rows;
  }

  async byCodeCommune(codeCommune: string): Promise<LocationRow | null> {
    const res = await this.db.query<LocationRow>(
      `
      SELECT ${LOCATION_COLUMNS}
      FROM dim_location
      WHERE code_commune = $1
      LIMIT 1
      `,
      [codeCommune],
    );
    return res.rows[0] ?? null;
  }

  async listDepartments(params: {
    codeRegion?: string;
    limit: number;
  }): Promise<DepartmentRow[]> {
    const where: string[] = [];
    const values: any[] = [];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    if (params.codeRegion) where.push(`code_region = ${add(params.codeRegion)}`);

    const res = await this.db.query<DepartmentRow>(
      `
      SELECT
        departement_id,
        code_departement,
        nom_departement,
        code_region,
        code_commune_cheflieu,
        cog_millesime
      FROM dim_departement
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY code_departement
      LIMIT ${add(params.limit)}
      `,
      values,
    );
    return res.rows;
  }

  async byCodeDepartement(codeDepartement: string): Promise<DepartmentRow | null> {
    const res = await this.db.query<DepartmentRow>(
      `
      SELECT
        departement_id,
        code_departement,
        nom_departement,
        code_region,
        code_commune_cheflieu,
        cog_millesime
      FROM dim_departement
      WHERE code_departement = $1
      LIMIT 1
      `,
      [codeDepartement],
    );
    return res.rows[0] ?? null;
  }

  async communesByDepartement(params: {
    codeDepartement: string;
    limit: number;
    offset: number;
  }): Promise<LocationRow[]> {
    const res = await this.db.query<LocationRow>(
      `
      SELECT ${LOCATION_COLUMNS}
      FROM dim_location
      WHERE code_departement = $1
      ORDER BY code_commune
      LIMIT $2
      OFFSET $3
      `,
      [params.codeDepartement, params.limit, params.offset],
    );
    return res.rows;
  }

  async listRegions(params: { limit: number }): Promise<RegionRow[]> {
    const res = await this.db.query<RegionRow>(
      `
      SELECT
        region_id,
        code_region,
        nom_region,
        code_commune_cheflieu,
        cog_millesime
      FROM dim_region
      ORDER BY code_region
      LIMIT $1
      `,
      [params.limit],
    );
    return res.rows;
  }

  async byCodeRegion(codeRegion: string): Promise<RegionRow | null> {
    const res = await this.db.query<RegionRow>(
      `
      SELECT
        region_id,
        code_region,
        nom_region,
        code_commune_cheflieu,
        cog_millesime
      FROM dim_region
      WHERE code_region = $1
      LIMIT 1
      `,
      [codeRegion],
    );
    return res.rows[0] ?? null;
  }
}
