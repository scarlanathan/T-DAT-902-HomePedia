import { EquipmentService } from './equipment.service';

function mockDb(rows: any[] = []) {
  return {
    query: jest.fn(async () => ({ rows })),
  };
}

describe('EquipmentService', () => {
  it('lists equipment with all filters and location', async () => {
    const db = mockDb([{ equipment_id: 'eq_1', code_commune: '75056' }]);
    const svc = new EquipmentService(db as any);

    const out = await svc.list({
      codeCommune: '75056',
      codeDepartement: '75',
      equipmentCategory: 'education',
      limit: 50,
      offset: 0,
      includeLocation: true,
    });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM fact_equipment');
    expect(sql).toContain('JOIN dim_location');
    expect(sql).toContain('d.nom_commune');
    expect(params).toEqual(['75056', '75', 'education', 50, 0]);
    expect(out[0].equipment_id).toBe('eq_1');
  });

  it('omits nom_commune when includeLocation is false', async () => {
    const db = mockDb([]);
    const svc = new EquipmentService(db as any);
    await svc.list({
      limit: 10,
      offset: 0,
      includeLocation: false,
    });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).not.toContain('d.nom_commune');
    expect(sql).not.toContain('WHERE');
    expect(params).toEqual([10, 0]);
  });

  it('filters by commune only', async () => {
    const db = mockDb([]);
    const svc = new EquipmentService(db as any);
    await svc.list({
      codeCommune: '75056',
      limit: 10,
      offset: 0,
      includeLocation: true,
    });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('f.code_commune = $1');
    expect(params).toEqual(['75056', 10, 0]);
  });
});
