import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DbService } from '../db/db.service';

export type ForecastLevel = 'france' | 'region' | 'departement' | 'commune';
export type ForecastMapLevel = 'departement' | 'region';
export type ForecastRankingLevel = 'commune' | 'departement';
export type ForecastPropertyType = 'all' | 'appartement' | 'maison';
export type ForecastScenario = 'central' | 'optimiste' | 'pessimiste';
export type ForecastHorizon = 4 | 8;

export type ForecastModelRow = {
  trained_at: string; // timestamptz serialized by pg
  history_start: string | null; // YYYY-MM-DD
  history_end: string | null; // YYYY-MM-DD
  horizon_quarters: number | null;
  method: string | null;
  rate_elasticity: string | null;
  damping_phi: string | null;
  mean_reversion_kappa: string | null;
  last_rate_pct: string | null;
  last_rate_month: string | null; // YYYY-MM-DD
  n_series: Record<string, number> | null; // jsonb
};

export type ForecastScenarioRow = {
  scenario: string;
  label: string | null;
  description: string | null;
  period_quarter: string; // YYYY-MM-DD
  horizon: number;
  rate_pct: string | null;
  national_change_pct_year: string | null;
};

export type ForecastBacktestRow = {
  level: string;
  horizon: number;
  n_series: number | null;
  mape_model: string | null;
  mape_naive: string | null;
  coverage_80: string | null;
};

export type ForecastModelResponse = {
  model: ForecastModelRow | null;
  scenarios: ForecastScenarioRow[];
  backtest: ForecastBacktestRow[];
};

export type ForecastHistoryPoint = {
  period_quarter: string; // YYYY-MM-DD
  median_price_per_sqm: string | null;
  sale_count: string | null;
};

export type ForecastPoint = {
  scenario: string;
  period_quarter: string; // YYYY-MM-DD
  horizon: number;
  median_price_per_sqm: string | null;
  lower_80: string | null;
  upper_80: string | null;
};

export type ForecastSummaryRow = {
  level: string;
  code: string;
  nom: string | null;
  code_departement: string | null;
  property_type: string;
  scenario: string;
  last_quarter: string | null; // YYYY-MM-DD
  last_price: string | null;
  last_observed_price: string | null;
  annual_sales: string | null;
  trend_pct_year: string | null;
  price_h4: string | null;
  change_pct_h4: string | null;
  lower_80_h4: string | null;
  upper_80_h4: string | null;
  price_h8: string | null;
  change_pct_h8: string | null;
  lower_80_h8: string | null;
  upper_80_h8: string | null;
  reliability: string | null;
  trained_at: string | null;
};

export type ForecastSeriesResponse = {
  level: ForecastLevel;
  code: string;
  nom: string | null;
  property_type: ForecastPropertyType;
  history: ForecastHistoryPoint[];
  forecast: ForecastPoint[];
  summary: ForecastSummaryRow[];
  fallback: { level: 'departement'; code: string } | null;
};

export type ForecastMapRow = {
  code: string;
  nom: string | null;
  last_price: string | null;
  forecast_price: string | null;
  change_pct: string | null;
  lower_80: string | null;
  upper_80: string | null;
  annual_sales: string | null;
  reliability: string | null;
};

export type ForecastRankingRow = {
  level: string;
  code: string;
  nom: string | null;
  code_departement: string | null;
  last_price: string | null;
  forecast_price: string | null;
  change_pct: string | null;
  lower_80: string | null;
  upper_80: string | null;
  annual_sales: string | null;
  reliability: string | null;
};

/** Fixed whitelist: horizon never reaches the SQL text other than through these literals. */
const HORIZON_COLUMNS: Record<ForecastHorizon, { price: string; change: string; lower: string; upper: string }> = {
  4: { price: 'price_h4', change: 'change_pct_h4', lower: 'lower_80_h4', upper: 'upper_80_h4' },
  8: { price: 'price_h8', change: 'change_pct_h8', lower: 'lower_80_h8', upper: 'upper_80_h8' },
};

function horizonColumns(horizon: ForecastHorizon) {
  const cols = HORIZON_COLUMNS[horizon];
  if (!cols) throw new Error(`Unsupported forecast horizon: ${horizon}`);
  return cols;
}

/** Postgres "undefined_table": the forecast job has not written its tables yet. */
function isUndefinedTable(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '42P01';
}

/** Département code of a commune INSEE code (DOM: 3 chars, otherwise 2, incl. 2A/2B). */
export function departementFromCommune(codeCommune: string): string {
  return codeCommune.startsWith('97') ? codeCommune.slice(0, 3) : codeCommune.slice(0, 2);
}

type HistoryQueryRow = ForecastHistoryPoint & { nom: string | null; code_departement: string | null };
type ForecastQueryRow = ForecastPoint & { nom: string | null };

@Injectable()
export class ForecastService {
  constructor(private readonly db: DbService) {}

  /** Runs a query, returning [] when the target table does not exist yet (42P01). */
  private async rowsOrEmpty<T extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<T[]> {
    try {
      const res = await this.db.query<T>(sql, values);
      return res.rows;
    } catch (err) {
      if (isUndefinedTable(err)) return [];
      throw err;
    }
  }

  async model(): Promise<ForecastModelResponse> {
    const [models, scenarios, backtest] = await Promise.all([
      this.rowsOrEmpty<ForecastModelRow>(
        `
        SELECT
          trained_at,
          history_start::text AS history_start,
          history_end::text AS history_end,
          horizon_quarters,
          method,
          rate_elasticity,
          damping_phi,
          mean_reversion_kappa,
          last_rate_pct,
          last_rate_month::text AS last_rate_month,
          n_series
        FROM app_price_forecast_model
        ORDER BY trained_at DESC
        LIMIT 1
        `,
      ),
      this.rowsOrEmpty<ForecastScenarioRow>(
        `
        SELECT
          scenario,
          label,
          description,
          period_quarter::text AS period_quarter,
          horizon,
          rate_pct,
          national_change_pct_year
        FROM app_price_forecast_scenario
        ORDER BY scenario, horizon
        `,
      ),
      this.rowsOrEmpty<ForecastBacktestRow>(
        `
        SELECT
          level,
          horizon,
          n_series,
          mape_model,
          mape_naive,
          coverage_80
        FROM app_price_forecast_backtest
        ORDER BY level, horizon
        `,
      ),
    ]);

    return { model: models[0] ?? null, scenarios, backtest };
  }

  async series(params: {
    level: ForecastLevel;
    code?: string;
    propertyType: ForecastPropertyType;
  }): Promise<ForecastSeriesResponse> {
    const { level, propertyType } = params;
    const code = params.code ?? (level === 'france' ? 'FR' : undefined);
    if (!code) throw new NotFoundException('Forecast series not found');

    const values: unknown[] = [];
    const add = (val: unknown) => {
      values.push(val);
      return `$${values.length}`;
    };
    const where = `level = ${add(level)} AND code = ${add(code)} AND property_type = ${add(propertyType)}`;

    const [historyRes, forecastRows, summary] = await Promise.all([
      this.db.query<HistoryQueryRow>(
        `
        SELECT
          nom,
          code_departement,
          period_quarter::text AS period_quarter,
          median_price_per_sqm,
          sale_count
        FROM app_price_history
        WHERE ${where}
        ORDER BY period_quarter ASC
        `,
        values,
      ),
      this.rowsOrEmpty<ForecastQueryRow>(
        `
        SELECT
          nom,
          scenario,
          period_quarter::text AS period_quarter,
          horizon,
          median_price_per_sqm,
          lower_80,
          upper_80
        FROM app_price_forecast
        WHERE ${where}
        ORDER BY scenario, period_quarter ASC
        `,
        values,
      ),
      this.rowsOrEmpty<ForecastSummaryRow>(
        `
        SELECT
          level,
          code,
          nom,
          code_departement,
          property_type,
          scenario,
          last_quarter::text AS last_quarter,
          last_price,
          last_observed_price,
          annual_sales,
          trend_pct_year,
          price_h4,
          change_pct_h4,
          lower_80_h4,
          upper_80_h4,
          price_h8,
          change_pct_h8,
          lower_80_h8,
          upper_80_h8,
          reliability,
          trained_at
        FROM app_price_forecast_summary
        WHERE ${where}
        ORDER BY scenario
        `,
        values,
      ),
    ]);
    const historyRows = historyRes.rows;

    if (historyRows.length === 0 && forecastRows.length === 0) {
      throw new NotFoundException('Forecast series not found');
    }

    const nom =
      historyRows.find((r) => r.nom)?.nom
      ?? forecastRows.find((r) => r.nom)?.nom
      ?? summary.find((r) => r.nom)?.nom
      ?? null;

    let fallback: ForecastSeriesResponse['fallback'] = null;
    if (level === 'commune' && forecastRows.length === 0) {
      const dep = historyRows.find((r) => r.code_departement)?.code_departement ?? departementFromCommune(code);
      fallback = { level: 'departement', code: dep };
    }

    return {
      level,
      code,
      nom,
      property_type: propertyType,
      history: historyRows.map((r) => ({
        period_quarter: r.period_quarter,
        median_price_per_sqm: r.median_price_per_sqm,
        sale_count: r.sale_count,
      })),
      forecast: forecastRows.map((r) => ({
        scenario: r.scenario,
        period_quarter: r.period_quarter,
        horizon: r.horizon,
        median_price_per_sqm: r.median_price_per_sqm,
        lower_80: r.lower_80,
        upper_80: r.upper_80,
      })),
      summary,
      fallback,
    };
  }

  async map(params: {
    level: ForecastMapLevel;
    scenario: ForecastScenario;
    propertyType: ForecastPropertyType;
    horizon: ForecastHorizon;
  }): Promise<ForecastMapRow[]> {
    const cols = horizonColumns(params.horizon);
    const values: unknown[] = [];
    const add = (val: unknown) => {
      values.push(val);
      return `$${values.length}`;
    };

    return this.rowsOrEmpty<ForecastMapRow>(
      `
      SELECT
        code,
        nom,
        last_price,
        ${cols.price} AS forecast_price,
        ${cols.change} AS change_pct,
        ${cols.lower} AS lower_80,
        ${cols.upper} AS upper_80,
        annual_sales,
        reliability
      FROM app_price_forecast_summary
      WHERE level = ${add(params.level)}
        AND scenario = ${add(params.scenario)}
        AND property_type = ${add(params.propertyType)}
      ORDER BY code
      `,
      values,
    );
  }

  async ranking(params: {
    level: ForecastRankingLevel;
    scenario: ForecastScenario;
    propertyType: ForecastPropertyType;
    horizon: ForecastHorizon;
    order: 'asc' | 'desc';
    codeDepartement?: string;
    minAnnualSales: number;
    limit: number;
    offset: number;
  }): Promise<ForecastRankingRow[]> {
    const cols = horizonColumns(params.horizon);
    const dir = params.order === 'asc' ? 'ASC' : 'DESC';
    const values: unknown[] = [];
    const add = (val: unknown) => {
      values.push(val);
      return `$${values.length}`;
    };

    const where = [
      `level = ${add(params.level)}`,
      `scenario = ${add(params.scenario)}`,
      `property_type = ${add(params.propertyType)}`,
    ];
    if (params.codeDepartement) where.push(`code_departement = ${add(params.codeDepartement)}`);
    if (params.minAnnualSales > 0) where.push(`annual_sales >= ${add(params.minAnnualSales)}`);

    return this.rowsOrEmpty<ForecastRankingRow>(
      `
      SELECT
        level,
        code,
        nom,
        code_departement,
        last_price,
        ${cols.price} AS forecast_price,
        ${cols.change} AS change_pct,
        ${cols.lower} AS lower_80,
        ${cols.upper} AS upper_80,
        annual_sales,
        reliability
      FROM app_price_forecast_summary
      WHERE ${where.join(' AND ')}
      ORDER BY ${cols.change} ${dir} NULLS LAST, annual_sales DESC NULLS LAST, code
      LIMIT ${add(params.limit)}
      OFFSET ${add(params.offset)}
      `,
      values,
    );
  }
}
