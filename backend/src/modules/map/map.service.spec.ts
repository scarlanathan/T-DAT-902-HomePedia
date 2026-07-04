import { MapService } from './map.service';

function mockDb(rows: any[] = []) {
  return {
    query: jest.fn(async () => ({ rows })),
  };
}

describe('MapService', () => {
  it('builds bbox query with correct params', async () => {
    const db = mockDb([{ transaction_id: '1' }]);
    const svc = new MapService(db as any);

    const out = await svc.transactionPoints({
      bbox: { minLon: 1, minLat: 2, maxLon: 3, maxLat: 4 },
      from: '2020-01-01',
      to: '2020-12-31',
      limit: 10,
    });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM fact_transaction');
    expect(sql).toContain('longitude BETWEEN $1 AND $2');
    expect(sql).toContain("f.type_local IN ('Maison', 'Appartement')");
    expect(sql).toContain(`f.surface_reelle_bati >= 10`);
    expect(params).toEqual([1, 3, 2, 4, '2020-01-01', '2020-12-31', 'Vente', 10]);
    expect(out[0].transaction_id).toBe('1');
  });
});

