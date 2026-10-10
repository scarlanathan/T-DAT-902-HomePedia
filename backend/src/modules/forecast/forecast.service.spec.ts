import { NotFoundException } from '@nestjs/common';
import { departementFromCommune, ForecastService } from './forecast.service';

function mockDb(rows: any[] = []) {
  return {
    query: jest.fn(async () => ({ rows })),
  };
}

/** Routes queries by table name; a table mapped to an Error rejects with it. */
function routedDb(routes: Record<string, any[] | Error>) {
  return {
    query: jest.fn(async (sql: string) => {
      for (const [table, result] of Object.entries(routes)) {
        if (new RegExp(`FROM ${table}\\b`).test(sql)) {
          if (result instanceof Error) throw result;
          return { rows: result };
        }
      }
      return { rows: [] };
    }),
  };
}

function undefinedTable(): Error {
  return Object.assign(new Error('relation does not exist'), { code: '42P01' });
}

function callFor(db: { query: jest.Mock }, table: string): [string, unknown[] | undefined] {
  const call = db.query.mock.calls.find(([sql]: [string]) => new RegExp(`FROM ${table}\\b`).test(sql));
  if (!call) throw new Error(`no query on ${table}`);
  return call as [string, unknown[] | undefined];
}

describe('ForecastService', () => {
  describe('model', () => {
    it('queries model, scenarios and backtest tables', async () => {
      const db = routedDb({
        app_price_forecast_model: [{ trained_at: '2026-10-01T00:00:00Z', method: 'damped-trend' }],
        app_price_forecast_scenario: [{ scenario: 'central', horizon: 1 }],
        app_price_forecast_backtest: [{ level: 'commune', horizon: 4 }],
      });
      const svc = new ForecastService(db as any);

      const out = await svc.model();

      const [modelSql] = callFor(db, 'app_price_forecast_model');
      expect(modelSql).toContain('LIMIT 1');
      const [scenarioSql] = callFor(db, 'app_price_forecast_scenario');
      expect(scenarioSql).toContain('ORDER BY scenario, horizon');
      const [backtestSql] = callFor(db, 'app_price_forecast_backtest');
      expect(backtestSql).toContain('ORDER BY level, horizon');
      expect(out.model?.method).toBe('damped-trend');
      expect(out.scenarios).toHaveLength(1);
      expect(out.backtest).toHaveLength(1);
    });

    it('returns null model when table is empty', async () => {
      const svc = new ForecastService(mockDb([]) as any);
      await expect(svc.model()).resolves.toEqual({ model: null, scenarios: [], backtest: [] });
    });

    it('tolerates missing tables (42P01)', async () => {
      const db = { query: jest.fn(async () => Promise.reject(undefinedTable())) };
      const svc = new ForecastService(db as any);

      await expect(svc.model()).resolves.toEqual({ model: null, scenarios: [], backtest: [] });
    });

    it('rethrows other database errors', async () => {
      const db = { query: jest.fn(async () => Promise.reject(Object.assign(new Error('boom'), { code: '57P01' }))) };
      const svc = new ForecastService(db as any);

      await expect(svc.model()).rejects.toThrow('boom');
    });
  });

  describe('series', () => {
    it('queries history, forecast and summary with the same params', async () => {
      const db = routedDb({
        app_price_history: [
          { nom: 'Lyon', code_departement: '69', period_quarter: '2025-01-01', median_price_per_sqm: '4800', sale_count: '900' },
        ],
        app_price_forecast: [
          {
            nom: 'Lyon',
            scenario: 'central',
            period_quarter: '2026-10-01',
            horizon: 1,
            median_price_per_sqm: '4750',
            lower_80: '4600',
            upper_80: '4900',
          },
        ],
        app_price_forecast_summary: [{ scenario: 'central', code: '69123', nom: 'Lyon' }],
      });
      const svc = new ForecastService(db as any);

      const out = await svc.series({ level: 'commune', code: '69123', propertyType: 'all' });

      for (const table of ['app_price_history', 'app_price_forecast', 'app_price_forecast_summary']) {
        const [sql, params] = callFor(db, table);
        expect(sql).toContain('level = $1 AND code = $2 AND property_type = $3');
        expect(params).toEqual(['commune', '69123', 'all']);
      }
      expect(callFor(db, 'app_price_history')[0]).toContain('ORDER BY period_quarter ASC');
      expect(callFor(db, 'app_price_forecast')[0]).toContain('ORDER BY scenario, period_quarter ASC');

      expect(out).toEqual({
        level: 'commune',
        code: '69123',
        nom: 'Lyon',
        property_type: 'all',
        history: [{ period_quarter: '2025-01-01', median_price_per_sqm: '4800', sale_count: '900' }],
        forecast: [
          {
            scenario: 'central',
            period_quarter: '2026-10-01',
            horizon: 1,
            median_price_per_sqm: '4750',
            lower_80: '4600',
            upper_80: '4900',
          },
        ],
        summary: [{ scenario: 'central', code: '69123', nom: 'Lyon' }],
        fallback: null,
      });
    });

    it("defaults code to 'FR' for level=france", async () => {
      const db = routedDb({
        app_price_history: [{ nom: 'France', code_departement: null, period_quarter: '2025-01-01' }],
      });
      const svc = new ForecastService(db as any);

      const out = await svc.series({ level: 'france', propertyType: 'maison' });

      expect(callFor(db, 'app_price_history')[1]).toEqual(['france', 'FR', 'maison']);
      expect(out.code).toBe('FR');
      expect(out.fallback).toBeNull();
    });

    it('throws NotFoundException when history and forecast are empty', async () => {
      const svc = new ForecastService(mockDb([]) as any);
      await expect(
        svc.series({ level: 'commune', code: '00000', propertyType: 'all' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sets departement fallback from history when a commune has no forecast', async () => {
      const db = routedDb({
        app_price_history: [{ nom: 'Saint-Pierre', code_departement: '974', period_quarter: '2025-01-01' }],
      });
      const svc = new ForecastService(db as any);

      const out = await svc.series({ level: 'commune', code: '97416', propertyType: 'all' });

      expect(out.forecast).toEqual([]);
      expect(out.fallback).toEqual({ level: 'departement', code: '974' });
      expect(out.nom).toBe('Saint-Pierre');
    });

    it('derives departement fallback from the commune code when history has none', async () => {
      const db = routedDb({
        app_price_history: [{ nom: 'X', code_departement: null, period_quarter: '2025-01-01' }],
      });
      const svc = new ForecastService(db as any);

      const dom = await svc.series({ level: 'commune', code: '97105', propertyType: 'all' });
      expect(dom.fallback).toEqual({ level: 'departement', code: '971' });

      const metro = await svc.series({ level: 'commune', code: '2A004', propertyType: 'all' });
      expect(metro.fallback).toEqual({ level: 'departement', code: '2A' });
    });

    it('does not set a fallback for non-commune levels', async () => {
      const db = routedDb({
        app_price_history: [{ nom: 'Rhône', code_departement: null, period_quarter: '2025-01-01' }],
      });
      const svc = new ForecastService(db as any);

      const out = await svc.series({ level: 'departement', code: '69', propertyType: 'all' });
      expect(out.fallback).toBeNull();
    });

    it('treats missing forecast tables (42P01) as empty', async () => {
      const db = routedDb({
        app_price_history: [{ nom: 'Lyon', code_departement: '69', period_quarter: '2025-01-01' }],
        app_price_forecast_summary: undefinedTable(),
        app_price_forecast: undefinedTable(),
      });
      const svc = new ForecastService(db as any);

      const out = await svc.series({ level: 'commune', code: '69123', propertyType: 'all' });

      expect(out.forecast).toEqual([]);
      expect(out.summary).toEqual([]);
      expect(out.fallback).toEqual({ level: 'departement', code: '69' });
    });

    it('takes nom from forecast rows when history is empty', async () => {
      const db = routedDb({
        app_price_forecast: [{ nom: 'Lyon', scenario: 'central', period_quarter: '2026-10-01', horizon: 1 }],
      });
      const svc = new ForecastService(db as any);

      const out = await svc.series({ level: 'commune', code: '69123', propertyType: 'all' });
      expect(out.nom).toBe('Lyon');
      expect(out.fallback).toBeNull();
    });
  });

  describe('map', () => {
    it('selects horizon 4 columns from the summary table', async () => {
      const db = mockDb([{ code: '69' }]);
      const svc = new ForecastService(db as any);

      const out = await svc.map({ level: 'departement', scenario: 'central', propertyType: 'all', horizon: 4 });

      const [sql, params] = (db.query as any).mock.calls[0];
      expect(sql).toContain('FROM app_price_forecast_summary');
      expect(sql).toContain('price_h4 AS forecast_price');
      expect(sql).toContain('change_pct_h4 AS change_pct');
      expect(sql).toContain('lower_80_h4 AS lower_80');
      expect(sql).toContain('upper_80_h4 AS upper_80');
      expect(sql).not.toContain('_h8');
      expect(params).toEqual(['departement', 'central', 'all']);
      expect(out[0].code).toBe('69');
    });

    it('selects horizon 8 columns', async () => {
      const db = mockDb([]);
      const svc = new ForecastService(db as any);

      await svc.map({ level: 'region', scenario: 'optimiste', propertyType: 'maison', horizon: 8 });

      const [sql, params] = (db.query as any).mock.calls[0];
      expect(sql).toContain('price_h8 AS forecast_price');
      expect(sql).not.toContain('_h4');
      expect(params).toEqual(['region', 'optimiste', 'maison']);
    });

    it('rejects horizons outside the whitelist', async () => {
      const db = mockDb([]);
      const svc = new ForecastService(db as any);

      await expect(
        svc.map({ level: 'region', scenario: 'central', propertyType: 'all', horizon: 6 as any }),
      ).rejects.toThrow('Unsupported forecast horizon');
      expect(db.query).not.toHaveBeenCalled();
    });

    it('returns [] when the summary table is missing (42P01)', async () => {
      const db = { query: jest.fn(async () => Promise.reject(undefinedTable())) };
      const svc = new ForecastService(db as any);

      await expect(
        svc.map({ level: 'departement', scenario: 'central', propertyType: 'all', horizon: 4 }),
      ).resolves.toEqual([]);
    });
  });

  describe('ranking', () => {
    it('builds filtered ranking query', async () => {
      const db = mockDb([{ code: '69123' }]);
      const svc = new ForecastService(db as any);

      const out = await svc.ranking({
        level: 'commune',
        scenario: 'central',
        propertyType: 'all',
        horizon: 8,
        order: 'asc',
        codeDepartement: '69',
        minAnnualSales: 50,
        limit: 10,
        offset: 20,
      });

      const [sql, params] = (db.query as any).mock.calls[0];
      expect(sql).toContain('FROM app_price_forecast_summary');
      expect(sql).toContain('code_departement = $4');
      expect(sql).toContain('annual_sales >= $5');
      expect(sql).toContain('ORDER BY change_pct_h8 ASC NULLS LAST, annual_sales DESC NULLS LAST');
      expect(sql).toContain('LIMIT $6');
      expect(sql).toContain('OFFSET $7');
      expect(params).toEqual(['commune', 'central', 'all', '69', 50, 10, 20]);
      expect(out[0].code).toBe('69123');
    });

    it('omits optional filters', async () => {
      const db = mockDb([]);
      const svc = new ForecastService(db as any);

      await svc.ranking({
        level: 'departement',
        scenario: 'pessimiste',
        propertyType: 'maison',
        horizon: 4,
        order: 'desc',
        minAnnualSales: 0,
        limit: 20,
        offset: 0,
      });

      const [sql, params] = (db.query as any).mock.calls[0];
      expect(sql).not.toContain('code_departement =');
      expect(sql).not.toContain('annual_sales >=');
      expect(sql).toContain('ORDER BY change_pct_h4 DESC NULLS LAST');
      expect(params).toEqual(['departement', 'pessimiste', 'maison', 20, 0]);
    });

    it('returns [] when the summary table is missing (42P01)', async () => {
      const db = { query: jest.fn(async () => Promise.reject(undefinedTable())) };
      const svc = new ForecastService(db as any);

      await expect(
        svc.ranking({
          level: 'commune',
          scenario: 'central',
          propertyType: 'all',
          horizon: 4,
          order: 'desc',
          minAnnualSales: 0,
          limit: 20,
          offset: 0,
        }),
      ).resolves.toEqual([]);
    });
  });

  describe('departementFromCommune', () => {
    it('handles metropole, Corsica and DOM codes', () => {
      expect(departementFromCommune('69123')).toBe('69');
      expect(departementFromCommune('2B033')).toBe('2B');
      expect(departementFromCommune('97411')).toBe('974');
    });
  });
});
