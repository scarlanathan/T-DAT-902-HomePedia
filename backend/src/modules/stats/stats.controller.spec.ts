import { Test } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

function makeModule(svc: Record<string, jest.Mock>) {
  return Test.createTestingModule({
    controllers: [StatsController],
    providers: [{ provide: StatsService, useValue: svc }],
  }).compile();
}

describe('StatsController', () => {
  it('parses city housing summary query params', async () => {
    const moduleRef = await makeModule({
      cityHousingSummary: jest.fn(async () => [{ code_commune: '75056' }]),
    });
    const ctrl = moduleRef.get(StatsController);
    const svc = moduleRef.get(StatsService) as any;

    const res = await ctrl.cityHousingSummary({
      code_commune: '75056',
      from: '2020-01-01',
      to: '2020-12-31',
      limit: '10',
      offset: '0',
    } as any);

    expect(svc.cityHousingSummary).toHaveBeenCalledWith({
      codeCommune: '75056',
      from: '2020-01-01',
      to: '2020-12-31',
      limit: 10,
      offset: 0,
    });
    expect(res[0].code_commune).toBe('75056');
  });

  it('parses transaction summary query params', async () => {
    const moduleRef = await makeModule({
      transactionSummary: jest.fn(async () => ({ transaction_count: '2' })),
    });
    const ctrl = moduleRef.get(StatsController);
    const svc = moduleRef.get(StatsService) as any;

    const res = await ctrl.transactionSummary({
      code_commune: '75056',
      code_departement: '75',
      from: '2020-01-01',
      to: '2020-12-31',
    } as any);

    expect(svc.transactionSummary).toHaveBeenCalledWith({
      codeCommune: '75056',
      codeDepartement: '75',
      natureMutation: undefined,
      typeLocal: undefined,
      from: '2020-01-01',
      to: '2020-12-31',
    });
    expect(res.transaction_count).toBe('2');
  });

  it('parses city equipment summary query params', async () => {
    const moduleRef = await makeModule({
      cityEquipmentSummary: jest.fn(async () => [{ equipment_total_count: '5' }]),
    });
    const ctrl = moduleRef.get(StatsController);
    const svc = moduleRef.get(StatsService) as any;

    const res = await ctrl.cityEquipmentSummary({
      code_commune: '75056',
      limit: '20',
      offset: '0',
    } as any);

    expect(svc.cityEquipmentSummary).toHaveBeenCalledWith({
      codeCommune: '75056',
      limit: 20,
      offset: 0,
    });
    expect(res[0].equipment_total_count).toBe('5');
  });

  it('parses city social summary query params', async () => {
    const moduleRef = await makeModule({
      citySocialSummary: jest.fn(async () => [{ median_income_eur: '35000' }]),
    });
    const ctrl = moduleRef.get(StatsController);
    const svc = moduleRef.get(StatsService) as any;

    const res = await ctrl.citySocialSummary({ code_commune: '75056' } as any);

    expect(svc.citySocialSummary).toHaveBeenCalledWith({
      codeCommune: '75056',
      sortBy: undefined,
      order: undefined,
      limit: 500,
      offset: 0,
    });
    expect(res[0].median_income_eur).toBe('35000');
  });

  it('parses iris social summary query params', async () => {
    const moduleRef = await makeModule({
      irisSocialSummary: jest.fn(async () => [{ code_iris: '751010101' }]),
    });
    const ctrl = moduleRef.get(StatsController);
    const svc = moduleRef.get(StatsService) as any;

    const res = await ctrl.irisSocialSummary({
      code_commune: '75056',
      code_iris: '751010101',
      limit: '10',
    } as any);

    expect(svc.irisSocialSummary).toHaveBeenCalledWith({
      codeCommune: '75056',
      codeIris: '751010101',
      limit: 10,
      offset: 0,
    });
    expect(res[0].code_iris).toBe('751010101');
  });

  it('parses opportunity score query params', async () => {
    const moduleRef = await makeModule({
      opportunityScore: jest.fn(async () => [{ composite_score: '55' }]),
    });
    const ctrl = moduleRef.get(StatsController);
    const svc = moduleRef.get(StatsService) as any;

    const res = await ctrl.opportunityScore({
      code_commune: '75056',
      from: '2020-01-01',
      to: '2024-12-31',
      limit: '12',
      offset: '0',
    } as any);

    expect(svc.opportunityScore).toHaveBeenCalledWith({
      codeCommune: '75056',
      from: '2020-01-01',
      to: '2024-12-31',
      limit: 12,
      offset: 0,
    });
    expect(res[0].composite_score).toBe('55');
  });

  it('parses commune ranking query params', async () => {
    const moduleRef = await makeModule({
      communeRanking: jest.fn(async () => [
        { code_commune: '75101', nom_commune: 'Paris 1er', value: '45000' },
      ]),
    });
    const ctrl = moduleRef.get(StatsController);
    const svc = moduleRef.get(StatsService) as any;

    const res = await ctrl.communeRanking({
      metric: 'median_income_eur',
      order: 'desc',
      limit: '50',
      offset: '100',
    } as any);

    expect(svc.communeRanking).toHaveBeenCalledWith({
      metric: 'median_income_eur',
      order: 'desc',
      limit: 50,
      offset: 100,
    });
    expect(res[0].value).toBe('45000');
  });

  it('parses commune ranking count query params', async () => {
    const moduleRef = await makeModule({
      communeRankingCount: jest.fn(async () => 34875),
    });
    const ctrl = moduleRef.get(StatsController);
    const svc = moduleRef.get(StatsService) as any;

    const res = await ctrl.communeRankingCount({
      metric: 'price_median_per_sqm',
    } as any);

    expect(svc.communeRankingCount).toHaveBeenCalledWith({
      metric: 'price_median_per_sqm',
    });
    expect(res.count).toBe(34875);
  });
});
