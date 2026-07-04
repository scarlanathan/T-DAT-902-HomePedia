import { StatsService } from './stats.service';

function mockDb(rows: any[] = []) {
  return {
    query: jest.fn(async () => ({ rows })),
  };
}

describe('StatsService', () => {
  it('builds transaction summary query', async () => {
    const db = mockDb([
      {
        transaction_count: '3',
        min_date_mutation: '2020-01-01',
        max_date_mutation: '2020-12-31',
        median_valeur_fonciere: '100000',
        median_price_per_sqm_built: '5000',
      },
    ]);
    const svc = new StatsService(db as any);

    const out = await svc.transactionSummary({
      codeCommune: '75056',
      codeDepartement: '75',
      natureMutation: 'Vente',
      typeLocal: 'Appartement',
      from: '2020-01-01',
      to: '2020-12-31',
    });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM dvf_mutation_price');
    expect(sql).toContain('JOIN dim_location');
    expect(sql).toContain('EXISTS');
    expect(params).toEqual(['75056', '75', '2020-01-01', '2020-12-31', 'Appartement']);
    expect(out.transaction_count).toBe('3');
  });

  it('returns zeroed transaction summary for non-Vente nature', async () => {
    const db = mockDb([]);
    const svc = new StatsService(db as any);
    const out = await svc.transactionSummary({ natureMutation: 'Echange' });

    expect(db.query).not.toHaveBeenCalled();
    expect(out.transaction_count).toBe('0');
  });

  it('returns zeroed transaction summary when no rows', async () => {
    const db = mockDb([]);
    const svc = new StatsService(db as any);
    const out = await svc.transactionSummary({});

    expect(out).toEqual({
      transaction_count: '0',
      min_date_mutation: null,
      max_date_mutation: null,
      median_valeur_fonciere: null,
      median_price_per_sqm_built: null,
    });
  });

  it('builds filtered city housing summary query', async () => {
    const db = mockDb([{ code_commune: '75056' }]);
    const svc = new StatsService(db as any);

    const out = await svc.cityHousingSummary({
      codeCommune: '75056',
      from: '2020-01-01',
      to: '2020-12-31',
      limit: 10,
      offset: 0,
    });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM app_city_housing_summary');
    expect(sql).toContain('WHERE');
    expect(params).toEqual(['75056', '2020-01-01', '2020-12-31', 10, 0]);
    expect(out[0].code_commune).toBe('75056');
  });

  it('builds unfiltered city housing summary query', async () => {
    const db = mockDb([]);
    const svc = new StatsService(db as any);
    await svc.cityHousingSummary({ limit: 5, offset: 0 });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM app_city_housing_summary');
    expect(sql).not.toContain('WHERE');
    expect(params).toEqual([5, 0]);
  });

  it('builds filtered city equipment summary query', async () => {
    const db = mockDb([{ code_commune: '75056', equipment_total_count: '10' }]);
    const svc = new StatsService(db as any);

    const out = await svc.cityEquipmentSummary({
      codeCommune: '75056',
      limit: 10,
      offset: 0,
    });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM app_city_equipment_summary');
    expect(sql).toContain('equipment_total_count::text');
    expect(params).toEqual(['75056', 10, 0]);
    expect(out[0].equipment_total_count).toBe('10');
  });

  it('builds unfiltered city equipment summary query', async () => {
    const db = mockDb([]);
    const svc = new StatsService(db as any);
    await svc.cityEquipmentSummary({ limit: 20, offset: 5 });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).not.toContain('WHERE');
    expect(params).toEqual([20, 5]);
  });

  it('builds filtered city social summary query', async () => {
    const db = mockDb([{ code_commune: '75056', median_income_eur: '30000' }]);
    const svc = new StatsService(db as any);

    const out = await svc.citySocialSummary({ codeCommune: '75056', limit: 5, offset: 0 });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM app_city_social_summary');
    expect(sql).toContain('housing_aid_share');
    expect(params).toEqual(['75056', 5, 0]);
    expect(out[0].median_income_eur).toBe('30000');
  });

  it('builds unfiltered city social summary query', async () => {
    const db = mockDb([]);
    const svc = new StatsService(db as any);
    await svc.citySocialSummary({ limit: 5, offset: 0 });

    const [sql] = (db.query as any).mock.calls[0];
    expect(sql).not.toContain('WHERE');
  });

  it('sorts city social summary by median income descending', async () => {
    const db = mockDb([]);
    const svc = new StatsService(db as any);
    await svc.citySocialSummary({
      sortBy: 'median_income_eur',
      order: 'desc',
      limit: 100,
      offset: 0,
    });

    const [sql] = (db.query as any).mock.calls[0];
    expect(sql).toContain('median_income_eur IS NOT NULL');
    expect(sql).toContain('ORDER BY median_income_eur DESC NULLS LAST, code_commune');
  });

  it('counts city social summary rows with income filter', async () => {
    const db = mockDb([{ count: 34875 }]);
    const svc = new StatsService(db as any);
    const count = await svc.citySocialSummaryCount({
      sortBy: 'median_income_eur',
    });

    const [sql] = (db.query as any).mock.calls[0];
    expect(sql).toContain('SELECT COUNT(*)::int AS count');
    expect(sql).toContain('median_income_eur IS NOT NULL');
    expect(count).toBe(34875);
  });

  it('builds commune ranking by composite score from latest opportunity rows', async () => {
    const db = mockDb([{ code_commune: '75101', nom_commune: 'Paris', value: '72' }]);
    const svc = new StatsService(db as any);
    const rows = await svc.communeRanking({
      metric: 'composite_score',
      order: 'desc',
      limit: 50,
      offset: 0,
    });

    const [sql] = (db.query as any).mock.calls[0];
    expect(sql).toContain('DISTINCT ON (code_commune)');
    expect(sql).toContain('composite_score::text AS value');
    expect(rows[0].value).toBe('72');
  });

  it('builds commune ranking by median income from social summary', async () => {
    const db = mockDb([{ code_commune: '69123', nom_commune: 'Lyon', value: '28000' }]);
    const svc = new StatsService(db as any);
    const rows = await svc.communeRanking({
      metric: 'median_income_eur',
      order: 'desc',
      limit: 50,
      offset: 100,
    });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM app_city_social_summary');
    expect(sql).toContain('median_income_eur::text AS value');
    expect(params).toEqual([50, 100]);
    expect(rows[0].value).toBe('28000');
  });

  it('builds commune ranking by social mix score', async () => {
    const db = mockDb([{ code_commune: '75056', nom_commune: 'Paris', value: '68' }]);
    const svc = new StatsService(db as any);
    await svc.communeRanking({
      metric: 'social_mix_score',
      order: 'asc',
      limit: 10,
      offset: 0,
    });

    const [sql] = (db.query as any).mock.calls[0];
    expect(sql).toContain('social_mix_score::text AS value');
    expect(sql).toContain('ORDER BY social_mix_score ASC NULLS LAST, code_commune');
  });

  it('counts commune ranking rows for median income', async () => {
    const db = mockDb([{ count: 34875 }]);
    const svc = new StatsService(db as any);
    const count = await svc.communeRankingCount({ metric: 'median_income_eur' });

    const [sql] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM app_city_social_summary');
    expect(sql).toContain('median_income_eur IS NOT NULL');
    expect(count).toBe(34875);
  });

  it('counts commune ranking rows for composite score', async () => {
    const db = mockDb([{ count: 32000 }]);
    const svc = new StatsService(db as any);
    const count = await svc.communeRankingCount({ metric: 'composite_score' });

    const [sql] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM app_opportunity_score');
    expect(sql).toContain('composite_score IS NOT NULL');
    expect(count).toBe(32000);
  });

  it('builds price per sqm ranking from housing summary with outlier filters', async () => {
    const db = mockDb([{ code_commune: '75116', nom_commune: 'Paris 16e', value: '12500' }]);
    const svc = new StatsService(db as any);
    const rows = await svc.communeRanking({
      metric: 'price_median_per_sqm',
      order: 'desc',
      limit: 50,
      offset: 0,
    });

    const [sql] = (db.query as any).mock.calls[0];
    expect(sql).toContain('app_city_housing_summary');
    expect(sql).toContain('median_price_per_sqm_built <= 30000');
    expect(sql).toContain('sale_line_count::int >= 5');
    expect(rows[0].value).toBe('12500');
  });

  it('counts commune ranking rows for price per sqm', async () => {
    const db = mockDb([{ count: 12000 }]);
    const svc = new StatsService(db as any);
    const count = await svc.communeRankingCount({ metric: 'price_median_per_sqm' });

    const [sql] = (db.query as any).mock.calls[0];
    expect(sql).toContain('app_city_housing_summary');
    expect(sql).toContain('median_price_per_sqm_built >= 100');
    expect(count).toBe(12000);
  });

  it('builds iris social summary query with both filters', async () => {
    const db = mockDb([{ code_iris: '751010101' }]);
    const svc = new StatsService(db as any);

    await svc.irisSocialSummary({
      codeCommune: '75056',
      codeIris: '751010101',
      limit: 5,
      offset: 0,
    });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM app_iris_social_summary');
    expect(params).toEqual(['75056', '751010101', 5, 0]);
  });

  it('builds iris social summary query with commune filter only', async () => {
    const db = mockDb([]);
    const svc = new StatsService(db as any);
    await svc.irisSocialSummary({ codeCommune: '75056', limit: 5, offset: 0 });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(params).toEqual(['75056', 5, 0]);
    expect(sql).not.toContain('code_iris = $2');
  });

  it('builds opportunity score query with date range', async () => {
    const db = mockDb([{ code_commune: '75056', composite_score: '72.5' }]);
    const svc = new StatsService(db as any);

    const out = await svc.opportunityScore({
      codeCommune: '75056',
      from: '2020-01-01',
      to: '2025-01-01',
      limit: 10,
      offset: 0,
    });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM app_opportunity_score');
    expect(sql).toContain('composite_score DESC');
    expect(params).toEqual(['75056', '2020-01-01', '2025-01-01', 10, 0]);
    expect(out[0].composite_score).toBe('72.5');
  });

  it('builds unfiltered opportunity score query', async () => {
    const db = mockDb([]);
    const svc = new StatsService(db as any);
    await svc.opportunityScore({ limit: 10, offset: 0 });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).not.toContain('WHERE');
    expect(params).toEqual([10, 0]);
  });
});
