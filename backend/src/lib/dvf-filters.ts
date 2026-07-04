/** Aligned with data_platform/spark/jobs/clean_dvf.py and dvf_mutation_price.sql */

export const DVF_MIN_SURFACE_SQM = 10;
export const DVF_MIN_PRICE_PER_SQM = 100;
export const DVF_MAX_PRICE_PER_SQM = 30000;

export function buildMutationPriceWhere(
  alias: string,
  params: {
    codeCommune?: string;
    codeDepartement?: string;
    typeLocal?: string;
    from?: string;
    to?: string;
  },
  add: (val: unknown) => string,
  locationAlias = 'd',
): string[] {
  const where: string[] = [
    `${alias}.price_per_sqm_built IS NOT NULL`,
    `${alias}.price_per_sqm_built BETWEEN ${DVF_MIN_PRICE_PER_SQM} AND ${DVF_MAX_PRICE_PER_SQM}`,
  ];

  if (params.codeCommune) where.push(`${locationAlias}.code_commune = ${add(params.codeCommune)}`);
  if (params.codeDepartement) {
    where.push(`${locationAlias}.code_departement = ${add(params.codeDepartement)}`);
  }
  if (params.from) where.push(`${alias}.date_mutation >= ${add(params.from)}::date`);
  if (params.to) where.push(`${alias}.date_mutation <= ${add(params.to)}::date`);

  if (params.typeLocal) {
    where.push(`EXISTS (
      SELECT 1
      FROM normalized_dvf_transaction n
      WHERE n.id_mutation = ${alias}.id_mutation
        AND n.code_commune = ${alias}.code_commune
        AND n.type_local = ${add(params.typeLocal)}
        AND n.type_local IN ('Maison', 'Appartement')
    )`);
  }

  return where;
}

export function buildDwellingLineWhere(
  alias: string,
  params: { natureMutation?: string; typeLocal?: string },
  add: (val: unknown) => string,
): string[] {
  const where: string[] = [
    `${alias}.nature_mutation = ${add(params.natureMutation ?? 'Vente')}`,
    `${alias}.surface_reelle_bati >= ${DVF_MIN_SURFACE_SQM}`,
    `${alias}.price_per_sqm_built IS NOT NULL`,
  ];

  if (params.typeLocal) {
    where.push(`${alias}.type_local = ${add(params.typeLocal)}`);
  } else {
    where.push(`${alias}.type_local IN ('Maison', 'Appartement')`);
  }

  return where;
}
