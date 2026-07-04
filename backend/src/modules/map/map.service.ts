import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { buildDwellingLineWhere } from '../../lib/dvf-filters';

export type TransactionPointRow = {
  transaction_id: string;
  date_mutation: string | null;
  valeur_fonciere: string | null;
  price_per_sqm_built: string | null;
  type_local: string | null;
  longitude: number;
  latitude: number;
  code_commune: string | null;
};

@Injectable()
export class MapService {
  constructor(private readonly db: DbService) {}

  async transactionPoints(params: {
    bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number };
    from?: string;
    to?: string;
    limit: number;
  }): Promise<TransactionPointRow[]> {
    const where: string[] = [
      'f.longitude IS NOT NULL',
      'f.latitude IS NOT NULL',
      'f.longitude BETWEEN $1 AND $2',
      'f.latitude BETWEEN $3 AND $4',
    ];
    const values: any[] = [params.bbox.minLon, params.bbox.maxLon, params.bbox.minLat, params.bbox.maxLat];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    if (params.from) where.push(`f.date_mutation >= ${add(params.from)}::date`);
    if (params.to) where.push(`f.date_mutation <= ${add(params.to)}::date`);
    where.push(...buildDwellingLineWhere('f', {}, add));

    const res = await this.db.query<TransactionPointRow>(
      `
      SELECT
        f.transaction_id,
        f.date_mutation,
        f.valeur_fonciere,
        f.price_per_sqm_built,
        f.type_local,
        f.longitude,
        f.latitude,
        d.code_commune
      FROM fact_transaction f
      JOIN dim_location d ON d.location_id = f.location_id
      WHERE ${where.join(' AND ')}
      ORDER BY f.date_mutation DESC NULLS LAST
      LIMIT ${add(params.limit)}
      `,
      values,
    );
    return res.rows;
  }
}

