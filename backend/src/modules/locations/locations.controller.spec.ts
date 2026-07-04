import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

function makeModule(svc: Record<string, jest.Mock>) {
  return Test.createTestingModule({
    controllers: [LocationsController],
    providers: [{ provide: LocationsService, useValue: svc }],
  }).compile();
}

describe('LocationsController', () => {
  it('validates search query and delegates to service', async () => {
    const moduleRef = await makeModule({
      search: jest.fn(async () => [
        { code_commune: '75101', code_postal: '75001', location_id: 'loc_1' },
      ]),
    });
    const ctrl = moduleRef.get(LocationsController);
    const svc = moduleRef.get(LocationsService) as any;

    const res = await ctrl.search({ q: 'paris', limit: '5' } as any);
    expect(svc.search).toHaveBeenCalledWith({ q: 'paris', limit: 5 });
    expect(res[0].code_commune).toBe('75101');
    expect(res[0].code_postal).toBe('75001');
  });

  it('returns commune or throws 404', async () => {
    const moduleRef = await makeModule({
      byCodeCommune: jest.fn(async (code) =>
        code === '75056'
          ? {
              code_commune: '75056',
              location_id: 'loc_1',
              code_postal: '75001',
            }
          : null,
      ),
    });
    const ctrl = moduleRef.get(LocationsController);

    const res = await ctrl.getByCodeCommune('75056');
    expect(res.code_commune).toBe('75056');
    await expect(ctrl.getByCodeCommune('00000')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists regions with default limit', async () => {
    const moduleRef = await makeModule({
      listRegions: jest.fn(async () => [{ code_region: '11' }]),
    });
    const ctrl = moduleRef.get(LocationsController);
    const svc = moduleRef.get(LocationsService) as any;

    const res = await ctrl.listRegions({});
    expect(svc.listRegions).toHaveBeenCalledWith({ limit: 50 });
    expect(res[0].code_region).toBe('11');
  });

  it('returns region or throws 404', async () => {
    const moduleRef = await makeModule({
      byCodeRegion: jest.fn(async (code) => (code === '11' ? { code_region: '11' } : null)),
    });
    const ctrl = moduleRef.get(LocationsController);

    expect((await ctrl.getRegion('11')).code_region).toBe('11');
    await expect(ctrl.getRegion('99')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists departments with optional region filter', async () => {
    const moduleRef = await makeModule({
      listDepartments: jest.fn(async () => [{ code_departement: '75' }]),
    });
    const ctrl = moduleRef.get(LocationsController);
    const svc = moduleRef.get(LocationsService) as any;

    const res = await ctrl.listDepartments({ code_region: '11', limit: '100' } as any);
    expect(svc.listDepartments).toHaveBeenCalledWith({ codeRegion: '11', limit: 100 });
    expect(res[0].code_departement).toBe('75');
  });

  it('returns department or throws 404', async () => {
    const moduleRef = await makeModule({
      byCodeDepartement: jest.fn(async (code) =>
        code === '75' ? { code_departement: '75' } : null,
      ),
    });
    const ctrl = moduleRef.get(LocationsController);

    expect((await ctrl.getDepartment('75')).code_departement).toBe('75');
    await expect(ctrl.getDepartment('99')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists communes in a department', async () => {
    const moduleRef = await makeModule({
      communesByDepartement: jest.fn(async () => [
        { code_commune: '75056', code_postal: '75001' },
      ]),
    });
    const ctrl = moduleRef.get(LocationsController);
    const svc = moduleRef.get(LocationsService) as any;

    const res = await ctrl.communesByDepartement('75', { limit: '10', offset: '5' } as any);
    expect(svc.communesByDepartement).toHaveBeenCalledWith({
      codeDepartement: '75',
      limit: 10,
      offset: 5,
    });
    expect(res[0].code_commune).toBe('75056');
  });
});
