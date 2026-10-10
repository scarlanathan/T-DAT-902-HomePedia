import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';

function makeModule(svc: Record<string, jest.Mock>) {
  return Test.createTestingModule({
    controllers: [ForecastController],
    providers: [{ provide: ForecastService, useValue: svc }],
  }).compile();
}

describe('ForecastController', () => {
  it('returns model payload from service', async () => {
    const payload = { model: null, scenarios: [], backtest: [] };
    const moduleRef = await makeModule({ model: jest.fn(async () => payload) });
    const ctrl = moduleRef.get(ForecastController);

    await expect(ctrl.model()).resolves.toEqual(payload);
  });

  it('parses series query params with defaults', async () => {
    const moduleRef = await makeModule({ series: jest.fn(async () => ({ code: '69123' })) });
    const ctrl = moduleRef.get(ForecastController);
    const svc = moduleRef.get(ForecastService) as any;

    const res = await ctrl.series({ level: 'commune', code: ' 69123 ' } as any);

    expect(svc.series).toHaveBeenCalledWith({ level: 'commune', code: '69123', propertyType: 'all' });
    expect(res.code).toBe('69123');
  });

  it('allows series without code for level=france', async () => {
    const moduleRef = await makeModule({ series: jest.fn(async () => ({ code: 'FR' })) });
    const ctrl = moduleRef.get(ForecastController);
    const svc = moduleRef.get(ForecastService) as any;

    await ctrl.series({ level: 'france', property_type: 'maison' } as any);

    expect(svc.series).toHaveBeenCalledWith({ level: 'france', code: undefined, propertyType: 'maison' });
  });

  it('rejects series without code for non-france levels', async () => {
    const moduleRef = await makeModule({ series: jest.fn() });
    const ctrl = moduleRef.get(ForecastController);
    const svc = moduleRef.get(ForecastService) as any;

    await expect(ctrl.series({ level: 'commune' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(svc.series).not.toHaveBeenCalled();
  });

  it('rejects unknown series level and property type', async () => {
    const moduleRef = await makeModule({ series: jest.fn() });
    const ctrl = moduleRef.get(ForecastController);

    await expect(ctrl.series({ level: 'iris', code: 'x' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      ctrl.series({ level: 'commune', code: '69123', property_type: 'terrain' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('parses map query params and coerces horizon', async () => {
    const moduleRef = await makeModule({ map: jest.fn(async () => [{ code: '69' }]) });
    const ctrl = moduleRef.get(ForecastController);
    const svc = moduleRef.get(ForecastService) as any;

    const res = await ctrl.map({ level: 'departement', scenario: 'optimiste', horizon: '8' } as any);

    expect(svc.map).toHaveBeenCalledWith({
      level: 'departement',
      scenario: 'optimiste',
      propertyType: 'all',
      horizon: 8,
    });
    expect(res[0].code).toBe('69');
  });

  it('defaults map scenario and horizon', async () => {
    const moduleRef = await makeModule({ map: jest.fn(async () => []) });
    const ctrl = moduleRef.get(ForecastController);
    const svc = moduleRef.get(ForecastService) as any;

    await ctrl.map({ level: 'region' } as any);

    expect(svc.map).toHaveBeenCalledWith({
      level: 'region',
      scenario: 'central',
      propertyType: 'all',
      horizon: 4,
    });
  });

  it('rejects invalid map horizon, level and scenario', async () => {
    const moduleRef = await makeModule({ map: jest.fn() });
    const ctrl = moduleRef.get(ForecastController);

    await expect(ctrl.map({ level: 'departement', horizon: '6' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.map({ level: 'commune' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.map({ level: 'region', scenario: 'krach' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('parses ranking query params', async () => {
    const moduleRef = await makeModule({ ranking: jest.fn(async () => [{ code: '69123' }]) });
    const ctrl = moduleRef.get(ForecastController);
    const svc = moduleRef.get(ForecastService) as any;

    await ctrl.ranking({
      level: 'commune',
      scenario: 'pessimiste',
      property_type: 'appartement',
      horizon: '8',
      order: 'asc',
      code_departement: '69',
      min_annual_sales: '50',
      limit: '10',
      offset: '20',
    } as any);

    expect(svc.ranking).toHaveBeenCalledWith({
      level: 'commune',
      scenario: 'pessimiste',
      propertyType: 'appartement',
      horizon: 8,
      order: 'asc',
      codeDepartement: '69',
      minAnnualSales: 50,
      limit: 10,
      offset: 20,
    });
  });

  it('applies ranking defaults', async () => {
    const moduleRef = await makeModule({ ranking: jest.fn(async () => []) });
    const ctrl = moduleRef.get(ForecastController);
    const svc = moduleRef.get(ForecastService) as any;

    await ctrl.ranking({ level: 'departement' } as any);

    expect(svc.ranking).toHaveBeenCalledWith({
      level: 'departement',
      scenario: 'central',
      propertyType: 'all',
      horizon: 4,
      order: 'desc',
      codeDepartement: undefined,
      minAnnualSales: 0,
      limit: 20,
      offset: 0,
    });
  });

  it('rejects out-of-range ranking limit and bad order', async () => {
    const moduleRef = await makeModule({ ranking: jest.fn() });
    const ctrl = moduleRef.get(ForecastController);

    await expect(ctrl.ranking({ level: 'commune', limit: '201' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.ranking({ level: 'commune', limit: '0' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.ranking({ level: 'commune', order: 'up' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.ranking({ level: 'region' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      ctrl.ranking({ level: 'commune', min_annual_sales: '-1' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
