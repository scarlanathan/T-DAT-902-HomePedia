import { LocationsService } from './locations.service';

function mockDb(rows: any[] = []) {
  return {
    query: jest.fn(async () => ({ rows })),
  };
}

describe('LocationsService', () => {
  it('lists locations when q missing', async () => {
    const db = mockDb([{ code_commune: '75056' }]);
    const svc = new LocationsService(db as any);
    const out = await svc.search({ limit: 10 });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM dim_location');
    expect(sql).not.toContain('ILIKE');
    expect(params).toEqual([10]);
    expect(out).toEqual([{ code_commune: '75056' }]);
  });

  it('searches with ILIKE when q provided', async () => {
    const db = mockDb([{ code_commune: '75101', nom_commune: 'Paris' }]);
    const svc = new LocationsService(db as any);
    const out = await svc.search({ q: 'par', limit: 10 });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('code_postal ILIKE');
    expect(params).toEqual(['%par%', 'par%', 10]);
    expect(out[0].code_commune).toBe('75101');
  });

  it('selects code_postal in all location queries', async () => {
    const db = mockDb([]);
    const svc = new LocationsService(db as any);

    await svc.byCodeCommune('75056');
    expect((db.query as jest.Mock).mock.calls[0][0]).toContain('code_postal');

    await svc.communesByDepartement({
      codeDepartement: '75',
      limit: 10,
      offset: 0,
    });
    expect((db.query as jest.Mock).mock.calls[1][0]).toContain('code_postal');
  });

  it('returns code_postal from byCodeCommune', async () => {
    const row = {
      location_id: 'loc_1',
      code_commune: '75101',
      nom_commune: 'Paris 1er Arrondissement',
      code_departement: '75',
      code_region: '11',
      type_commune: 'COM',
      code_commune_parent: null,
      cog_millesime: 2024,
      code_postal: '75001',
    };
    const db = mockDb([row]);
    const svc = new LocationsService(db as any);
    const out = await svc.byCodeCommune('75101');
    expect(out?.code_postal).toBe('75001');
  });

  it('prioritizes postal code prefix in search ordering', async () => {
    const db = mockDb([]);
    const svc = new LocationsService(db as any);
    await svc.search({ q: '750', limit: 5 });

    const sql = (db.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('WHEN code_postal ILIKE $2 THEN 0');
    expect(sql).toContain('WHEN code_commune ILIKE $2 THEN 1');
  });

  it('returns commune with COG fields when found', async () => {
    const row = {
      location_id: 'loc_1',
      code_commune: '75056',
      nom_commune: 'Paris',
      code_departement: '75',
      code_region: '11',
      type_commune: 'COM',
      code_commune_parent: null,
      cog_millesime: 2024,
      code_postal: '75001',
    };
    const db = mockDb([row]);
    const svc = new LocationsService(db as any);
    const out = await svc.byCodeCommune('75056');

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('code_region');
    expect(sql).toContain('type_commune');
    expect(params).toEqual(['75056']);
    expect(out).toEqual(row);
  });

  it('returns null when byCodeCommune not found', async () => {
    const db = mockDb([]);
    const svc = new LocationsService(db as any);
    const out = await svc.byCodeCommune('00000');
    expect(out).toBeNull();
  });

  it('lists regions from dim_region', async () => {
    const db = mockDb([{ code_region: '11', nom_region: 'Île-de-France' }]);
    const svc = new LocationsService(db as any);
    const out = await svc.listRegions({ limit: 50 });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM dim_region');
    expect(params).toEqual([50]);
    expect(out[0].code_region).toBe('11');
  });

  it('returns region by code', async () => {
    const db = mockDb([{ code_region: '11' }]);
    const svc = new LocationsService(db as any);
    const out = await svc.byCodeRegion('11');

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('WHERE code_region = $1');
    expect(params).toEqual(['11']);
    expect(out?.code_region).toBe('11');
  });

  it('returns null when region not found', async () => {
    const db = mockDb([]);
    const svc = new LocationsService(db as any);
    expect(await svc.byCodeRegion('99')).toBeNull();
  });

  it('lists departments from dim_departement', async () => {
    const db = mockDb([{ code_departement: '75' }]);
    const svc = new LocationsService(db as any);
    const out = await svc.listDepartments({ limit: 200 });

    const [sql] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM dim_departement');
    expect(out[0].code_departement).toBe('75');
  });

  it('filters departments by region', async () => {
    const db = mockDb([]);
    const svc = new LocationsService(db as any);
    await svc.listDepartments({ codeRegion: '11', limit: 50 });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('code_region = $1');
    expect(params[0]).toBe('11');
  });

  it('returns department by code', async () => {
    const db = mockDb([{ code_departement: '75', nom_departement: 'Paris' }]);
    const svc = new LocationsService(db as any);
    const out = await svc.byCodeDepartement('75');

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('WHERE code_departement = $1');
    expect(params).toEqual(['75']);
    expect(out?.nom_departement).toBe('Paris');
  });

  it('returns null when department not found', async () => {
    const db = mockDb([]);
    const svc = new LocationsService(db as any);
    expect(await svc.byCodeDepartement('99')).toBeNull();
  });

  it('lists communes by department', async () => {
    const db = mockDb([{ code_commune: '75056' }]);
    const svc = new LocationsService(db as any);
    const out = await svc.communesByDepartement({
      codeDepartement: '75',
      limit: 100,
      offset: 10,
    });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('code_departement = $1');
    expect(params).toEqual(['75', 100, 10]);
    expect(out[0].code_commune).toBe('75056');
  });
});
