import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { buildDwellingLineWhere } from '../../lib/dvf-filters';

export type TransactionRow = {
  transaction_id: string;
  location_id: string;
  date_mutation: string | null;
  nature_mutation: string | null;
  valeur_fonciere: string | null;
  surface_reelle_bati: string | null;
  price_per_sqm_built: string | null;
  type_local: string | null;
  code_type_local: string | null;
  id_parcelle: string | null;
  code_postal: string | null;
  longitude: number | null;
  latitude: number | null;
  source_file: string | null;
  ingested_at: string;
  code_commune?: string;
  nom_commune?: string | null;
};

@Injectable()
export class TransactionsService {
  constructor(private readonly db: DbService) {}

  async byId(params: { transactionId: string; includeLocation: boolean }): Promise<TransactionRow | null> {
    const values: any[] = [];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    const selectLocation = params.includeLocation ? `, d.code_commune, d.nom_commune` : '';
    const joinLocation = `JOIN dim_location d ON d.location_id = f.location_id`;

    const res = await this.db.query<TransactionRow>(
      `
      SELECT
        f.transaction_id,
        f.location_id,
        f.date_mutation,
        f.nature_mutation,
        f.valeur_fonciere,
        f.surface_reelle_bati,
        f.price_per_sqm_built,
        f.type_local,
        f.code_type_local,
        f.id_parcelle,
        f.code_postal,
        f.longitude,
        f.latitude,
        f.source_file,
        f.ingested_at
        ${selectLocation}
      FROM fact_transaction f
      ${joinLocation}
      WHERE f.transaction_id = ${add(params.transactionId)}
      LIMIT 1
      `,
      values,
    );
    return res.rows[0] ?? null;
  }

  async list(params: {
    codeCommune?: string;
    natureMutation?: string;
    typeLocal?: string;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
    includeLocation: boolean;
  }): Promise<TransactionRow[]> {
    const { includeLocation } = params;

    const where: string[] = [];
    const values: any[] = [];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    if (params.codeCommune) where.push(`d.code_commune = ${add(params.codeCommune)}`);
    if (params.from) where.push(`f.date_mutation >= ${add(params.from)}::date`);
    if (params.to) where.push(`f.date_mutation <= ${add(params.to)}::date`);
    where.push(
      ...buildDwellingLineWhere('f', {
        natureMutation: params.natureMutation,
        typeLocal: params.typeLocal,
      }, add),
    );

    const selectLocation = includeLocation ? `, d.code_commune, d.nom_commune` : '';
    const joinLocation = `JOIN dim_location d ON d.location_id = f.location_id`;

    const res = await this.db.query<TransactionRow>(
      `
      SELECT
        f.transaction_id,
        f.location_id,
        f.date_mutation,
        f.nature_mutation,
        f.valeur_fonciere,
        f.surface_reelle_bati,
        f.price_per_sqm_built,
        f.type_local,
        f.code_type_local,
        f.id_parcelle,
        f.code_postal,
        f.longitude,
        f.latitude,
        f.source_file,
        f.ingested_at
        ${selectLocation}
      FROM fact_transaction f
      ${joinLocation}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY f.date_mutation DESC NULLS LAST, f.transaction_id
      LIMIT ${add(params.limit)}
      OFFSET ${add(params.offset)}
      `,
      values,
    );
    return res.rows;
  }
}

