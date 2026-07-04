import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { buildDwellingLineWhere, buildMutationPriceWhere, DVF_MAX_PRICE_PER_SQM, DVF_MIN_PRICE_PER_SQM } from '../../lib/dvf-filters';

export type CityHousingSummaryRow = {
  code_commune: string;
  nom_commune: string | null;
  period_month: string; // date serialized by pg
  sale_line_count: string; // bigint-like from pg aggregates
  median_valeur_fonciere: string | null;
  median_price_per_sqm_built: string | null;
};

export type CityEquipmentSummaryRow = {
  code_commune: string;
  nom_commune: string | null;
  bpe_millesime: number | null;
  equipment_total_count: string;
  education_count: string;
  health_count: string;
  commerce_count: string;
  sport_count: string;
  other_count: string;
};

function buildCitySocialSummaryWhere(
  params: { codeCommune?: string; sortBy?: 'median_income_eur' },
  add: (val: unknown) => string,
): string[] {
  const where: string[] = [];
  if (params.codeCommune) where.push(`code_commune = ${add(params.codeCommune)}`);
  if (params.sortBy === 'median_income_eur') {
    where.push('median_income_eur IS NOT NULL');
  }
  return where;
}

export type RankingMetric =
  | 'median_income_eur'
  | 'composite_score'
  | 'social_mix_score'
  | 'quality_of_life_score'
  | 'price_median_per_sqm'
  | 'personalized';

export type CommuneRankingRow = {
  code_commune: string;
  nom_commune: string | null;
  value: string | null;
};

const OPPORTUNITY_RANKING_METRICS = new Set<RankingMetric>([
  'composite_score',
  'social_mix_score',
  'quality_of_life_score',
]);

/** Same band as data_platform/spark/jobs/clean_dvf.py (outliers and bad DVF lines). */
const MIN_SALES_FOR_PRICE_RANKING = 5;

function rankingOrderClause(metric: RankingMetric, order: 'asc' | 'desc'): string {
  const dir = order === 'asc' ? 'ASC' : 'DESC';
  if (metric === 'median_income_eur') {
    return `median_income_eur ${dir} NULLS LAST, code_commune`;
  }
  if (metric === 'price_median_per_sqm') {
    return `median_price_per_sqm_built ${dir} NULLS LAST, code_commune`;
  }
  return `${metric} ${dir} NULLS LAST, code_commune`;
}

export type CitySocialSummaryRow = {
  code_commune: string;
  nom_commune: string | null;
  filosofi_millesime: number | null;
  median_income_eur: string | null;
  poverty_rate: string | null;
  inequality_ratio: string | null;
  caf_beneficiary_share: string | null;
  housing_aid_share: string | null;
  income_d1_eur: string | null;
  income_d9_eur: string | null;
};

export type IrisSocialSummaryRow = {
  code_iris: string;
  code_commune: string;
  nom_commune: string | null;
  nom_iris: string | null;
  filosofi_millesime: number | null;
  median_income_eur: string | null;
  poverty_rate: string | null;
  inequality_ratio: string | null;
  caf_beneficiary_share: string | null;
};

export type OpportunityScoreRow = {
  code_commune: string;
  nom_commune: string | null;
  period_month: string;
  sale_line_count: string;
  median_valeur_fonciere: string | null;
  price_median_per_sqm: string | null;
  median_income_eur: string | null;
  poverty_rate: string | null;
  csp_diversity_index: string | null;
  qpv_share: string | null;
  equipment_density: string | null;
  transit_accessibility: string | null;
  safety_index: string | null;
  property_tax_rate_pct: string | null;
  assumed_interest_rate: string | null;
  assumed_term_months: number | null;
  assumed_max_dti: string | null;
  borrowing_capacity_eur: string | null;
  price_to_capacity_ratio: string | null;
  price_score: string | null;
  social_mix_score: string | null;
  quality_of_life_score: string | null;
  composite_score: string | null;
};

@Injectable()
export class StatsService {
  constructor(private readonly db: DbService) {}

  async transactionSummary(params: {
    codeCommune?: string;
    codeDepartement?: string;
    natureMutation?: string;
    typeLocal?: string;
    from?: string;
    to?: string;
  }): Promise<{
    transaction_count: string;
    min_date_mutation: string | null;
    max_date_mutation: string | null;
    median_valeur_fonciere: string | null;
    median_price_per_sqm_built: string | null;
  }> {
    if (params.natureMutation && params.natureMutation !== 'Vente') {
      return {
        transaction_count: '0',
        min_date_mutation: null,
        max_date_mutation: null,
        median_valeur_fonciere: null,
        median_price_per_sqm_built: null,
      };
    }

    const where: string[] = [];
    const values: any[] = [];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    where.push(...buildMutationPriceWhere('m', params, add));

    const res = await this.db.query<{
      transaction_count: string;
      min_date_mutation: string | null;
      max_date_mutation: string | null;
      median_valeur_fonciere: string | null;
      median_price_per_sqm_built: string | null;
    }>(
      `
      SELECT
        COUNT(*)::text AS transaction_count,
        MIN(m.date_mutation)::timestamptz AS min_date_mutation,
        MAX(m.date_mutation)::timestamptz AS max_date_mutation,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY m.valeur_fonciere)
          FILTER (WHERE m.valeur_fonciere IS NOT NULL) AS median_valeur_fonciere,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY m.price_per_sqm_built)
          FILTER (WHERE m.price_per_sqm_built IS NOT NULL) AS median_price_per_sqm_built
      FROM dvf_mutation_price m
      JOIN dim_location d ON d.code_commune = m.code_commune
      WHERE ${where.join(' AND ')}
      `,
      values,
    );

    return (
      res.rows[0] ?? {
        transaction_count: '0',
        min_date_mutation: null,
        max_date_mutation: null,
        median_valeur_fonciere: null,
        median_price_per_sqm_built: null,
      }
    );
  }

  async cityHousingSummary(params: {
    codeCommune?: string;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  }): Promise<CityHousingSummaryRow[]> {
    const { codeCommune, from, to, limit, offset } = params;

    const where: string[] = [];
    const values: any[] = [];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    if (codeCommune) where.push(`code_commune = ${add(codeCommune)}`);
    if (from) where.push(`period_month >= ${add(from)}::date`);
    if (to) where.push(`period_month <= ${add(to)}::date`);

    const res = await this.db.query<CityHousingSummaryRow>(
      `
      SELECT
        code_commune,
        nom_commune,
        period_month,
        sale_line_count,
        median_valeur_fonciere,
        median_price_per_sqm_built
      FROM app_city_housing_summary
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY period_month DESC, code_commune
      LIMIT ${add(limit)}
      OFFSET ${add(offset)}
      `,
      values,
    );
    return res.rows;
  }

  async cityEquipmentSummary(params: {
    codeCommune?: string;
    limit: number;
    offset: number;
  }): Promise<CityEquipmentSummaryRow[]> {
    const where: string[] = [];
    const values: any[] = [];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    if (params.codeCommune) where.push(`code_commune = ${add(params.codeCommune)}`);

    const res = await this.db.query<CityEquipmentSummaryRow>(
      `
      SELECT
        code_commune,
        nom_commune,
        bpe_millesime,
        equipment_total_count::text,
        education_count::text,
        health_count::text,
        commerce_count::text,
        sport_count::text,
        other_count::text
      FROM app_city_equipment_summary
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY code_commune
      LIMIT ${add(params.limit)}
      OFFSET ${add(params.offset)}
      `,
      values,
    );
    return res.rows;
  }

  async citySocialSummary(params: {
    codeCommune?: string;
    sortBy?: 'median_income_eur';
    order?: 'asc' | 'desc';
    limit: number;
    offset: number;
  }): Promise<CitySocialSummaryRow[]> {
    const values: any[] = [];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    const where = buildCitySocialSummaryWhere(params, add);

    const orderBy =
      params.sortBy === 'median_income_eur'
        ? `median_income_eur ${params.order === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, code_commune`
        : 'code_commune';

    const res = await this.db.query<CitySocialSummaryRow>(
      `
      SELECT
        code_commune,
        nom_commune,
        filosofi_millesime,
        median_income_eur,
        poverty_rate,
        inequality_ratio,
        caf_beneficiary_share,
        housing_aid_share,
        income_d1_eur,
        income_d9_eur
      FROM app_city_social_summary
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${orderBy}
      LIMIT ${add(params.limit)}
      OFFSET ${add(params.offset)}
      `,
      values,
    );
    return res.rows;
  }

  async citySocialSummaryCount(params: {
    codeCommune?: string;
    sortBy?: 'median_income_eur';
  }): Promise<number> {
    const values: any[] = [];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    const where = buildCitySocialSummaryWhere(params, add);

    const res = await this.db.query<{ count: number }>(
      `
      SELECT COUNT(*)::int AS count
      FROM app_city_social_summary
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      `,
      values,
    );
    return res.rows[0]?.count ?? 0;
  }

  async irisSocialSummary(params: {
    codeCommune?: string;
    codeIris?: string;
    limit: number;
    offset: number;
  }): Promise<IrisSocialSummaryRow[]> {
    const where: string[] = [];
    const values: any[] = [];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    if (params.codeCommune) where.push(`code_commune = ${add(params.codeCommune)}`);
    if (params.codeIris) where.push(`code_iris = ${add(params.codeIris)}`);

    const res = await this.db.query<IrisSocialSummaryRow>(
      `
      SELECT
        code_iris,
        code_commune,
        nom_commune,
        nom_iris,
        filosofi_millesime,
        median_income_eur,
        poverty_rate,
        inequality_ratio,
        caf_beneficiary_share
      FROM app_iris_social_summary
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY code_commune, code_iris
      LIMIT ${add(params.limit)}
      OFFSET ${add(params.offset)}
      `,
      values,
    );
    return res.rows;
  }

  async opportunityScore(params: {
    codeCommune?: string;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  }): Promise<OpportunityScoreRow[]> {
    const where: string[] = [];
    const values: any[] = [];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    if (params.codeCommune) where.push(`code_commune = ${add(params.codeCommune)}`);
    if (params.from) where.push(`period_month >= ${add(params.from)}::date`);
    if (params.to) where.push(`period_month <= ${add(params.to)}::date`);

    const res = await this.db.query<OpportunityScoreRow>(
      `
      SELECT
        code_commune,
        nom_commune,
        period_month,
        sale_line_count,
        median_valeur_fonciere,
        price_median_per_sqm,
        median_income_eur,
        poverty_rate,
        csp_diversity_index,
        qpv_share,
        equipment_density,
        transit_accessibility,
        safety_index,
        property_tax_rate_pct,
        assumed_interest_rate,
        assumed_term_months,
        assumed_max_dti,
        borrowing_capacity_eur,
        price_to_capacity_ratio,
        price_score,
        social_mix_score,
        quality_of_life_score,
        composite_score
      FROM app_opportunity_score
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY period_month DESC, composite_score DESC NULLS LAST, code_commune
      LIMIT ${add(params.limit)}
      OFFSET ${add(params.offset)}
      `,
      values,
    );
    return res.rows;
  }

  async communeRanking(params: {
    metric: RankingMetric;
    order: 'asc' | 'desc';
    limit: number;
    offset: number;
    weights?: { price: number; social: number; quality: number };
  }): Promise<CommuneRankingRow[]> {
    const values: any[] = [];
    const add = (val: any) => {
      values.push(val);
      return `$${values.length}`;
    };

    // Personalized composite: weight the three sub-scores with the user's own
    // weights and rank by the resulting 0-100 score (null dimensions excluded
    // from the denominator, mirroring app_opportunity_score.composite_score).
    if (params.metric === 'personalized') {
      const w = params.weights ?? { price: 0.5, social: 0.25, quality: 0.25 };
      const wp = add(w.price);
      const ws = add(w.social);
      const wq = add(w.quality);
      const dir = params.order === 'asc' ? 'ASC' : 'DESC';
      const res = await this.db.query<CommuneRankingRow>(
        `
        WITH latest AS (
          SELECT DISTINCT ON (code_commune)
            code_commune, nom_commune,
            price_score, social_mix_score, quality_of_life_score
          FROM app_opportunity_score
          ORDER BY code_commune, period_month DESC
        ),
        weighted AS (
          SELECT
            code_commune,
            nom_commune,
            (
              COALESCE(price_score           * ${wp}, 0)
            + COALESCE(social_mix_score      * ${ws}, 0)
            + COALESCE(quality_of_life_score * ${wq}, 0)
            ) / NULLIF(
              CASE WHEN price_score           IS NOT NULL THEN ${wp} ELSE 0 END
            + CASE WHEN social_mix_score      IS NOT NULL THEN ${ws} ELSE 0 END
            + CASE WHEN quality_of_life_score IS NOT NULL THEN ${wq} ELSE 0 END
            , 0) AS score
          FROM latest
        )
        SELECT code_commune, nom_commune, score::text AS value
        FROM weighted
        WHERE score IS NOT NULL
        ORDER BY score ${dir} NULLS LAST, code_commune
        LIMIT ${add(params.limit)}
        OFFSET ${add(params.offset)}
        `,
        values,
      );
      return res.rows;
    }

    if (params.metric === 'median_income_eur') {
      const res = await this.db.query<CommuneRankingRow>(
        `
        SELECT
          code_commune,
          nom_commune,
          median_income_eur::text AS value
        FROM app_city_social_summary
        WHERE median_income_eur IS NOT NULL
        ORDER BY ${rankingOrderClause(params.metric, params.order)}
        LIMIT ${add(params.limit)}
        OFFSET ${add(params.offset)}
        `,
        values,
      );
      return res.rows;
    }

    if (params.metric === 'price_median_per_sqm') {
      const res = await this.db.query<CommuneRankingRow>(
        `
        WITH latest AS (
          SELECT DISTINCT ON (code_commune)
            code_commune,
            nom_commune,
            median_price_per_sqm_built
          FROM app_city_housing_summary
          WHERE median_price_per_sqm_built IS NOT NULL
            AND median_price_per_sqm_built >= ${DVF_MIN_PRICE_PER_SQM}
            AND median_price_per_sqm_built <= ${DVF_MAX_PRICE_PER_SQM}
            AND sale_line_count::int >= ${MIN_SALES_FOR_PRICE_RANKING}
          ORDER BY code_commune, period_month DESC
        )
        SELECT
          code_commune,
          nom_commune,
          median_price_per_sqm_built::text AS value
        FROM latest
        ORDER BY ${rankingOrderClause(params.metric, params.order)}
        LIMIT ${add(params.limit)}
        OFFSET ${add(params.offset)}
        `,
        values,
      );
      return res.rows;
    }

    if (!OPPORTUNITY_RANKING_METRICS.has(params.metric)) {
      return [];
    }

    const column = params.metric;
    const res = await this.db.query<CommuneRankingRow>(
      `
      WITH latest AS (
        SELECT DISTINCT ON (code_commune)
          code_commune,
          nom_commune,
          composite_score,
          social_mix_score,
          quality_of_life_score,
          price_median_per_sqm
        FROM app_opportunity_score
        ORDER BY code_commune, period_month DESC
      )
      SELECT
        code_commune,
        nom_commune,
        ${column}::text AS value
      FROM latest
      WHERE ${column} IS NOT NULL
      ORDER BY ${rankingOrderClause(params.metric, params.order)}
      LIMIT ${add(params.limit)}
      OFFSET ${add(params.offset)}
      `,
      values,
    );
    return res.rows;
  }

  async communeRankingCount(params: { metric: RankingMetric }): Promise<number> {
    if (params.metric === 'median_income_eur') {
      const res = await this.db.query<{ count: number }>(
        `
        SELECT COUNT(*)::int AS count
        FROM app_city_social_summary
        WHERE median_income_eur IS NOT NULL
        `,
      );
      return res.rows[0]?.count ?? 0;
    }

    if (params.metric === 'personalized') {
      const res = await this.db.query<{ count: number }>(
        `
        WITH latest AS (
          SELECT DISTINCT ON (code_commune)
            code_commune, price_score, social_mix_score, quality_of_life_score
          FROM app_opportunity_score
          ORDER BY code_commune, period_month DESC
        )
        SELECT COUNT(*)::int AS count
        FROM latest
        WHERE price_score IS NOT NULL
           OR social_mix_score IS NOT NULL
           OR quality_of_life_score IS NOT NULL
        `,
      );
      return res.rows[0]?.count ?? 0;
    }

    if (params.metric === 'price_median_per_sqm') {
      const res = await this.db.query<{ count: number }>(
        `
        WITH latest AS (
          SELECT DISTINCT ON (code_commune)
            code_commune,
            median_price_per_sqm_built
          FROM app_city_housing_summary
          WHERE median_price_per_sqm_built IS NOT NULL
            AND median_price_per_sqm_built >= ${DVF_MIN_PRICE_PER_SQM}
            AND median_price_per_sqm_built <= ${DVF_MAX_PRICE_PER_SQM}
            AND sale_line_count::int >= ${MIN_SALES_FOR_PRICE_RANKING}
          ORDER BY code_commune, period_month DESC
        )
        SELECT COUNT(*)::int AS count
        FROM latest
        `,
      );
      return res.rows[0]?.count ?? 0;
    }

    if (!OPPORTUNITY_RANKING_METRICS.has(params.metric)) {
      return 0;
    }

    const column = params.metric;
    const res = await this.db.query<{ count: number }>(
      `
      WITH latest AS (
        SELECT DISTINCT ON (code_commune)
          code_commune,
          ${column}
        FROM app_opportunity_score
        ORDER BY code_commune, period_month DESC
      )
      SELECT COUNT(*)::int AS count
      FROM latest
      WHERE ${column} IS NOT NULL
      `,
    );
    return res.rows[0]?.count ?? 0;
  }
}

