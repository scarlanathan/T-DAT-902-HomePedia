import { Test } from '@nestjs/testing';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';

describe('EquipmentController', () => {
  it('parses query params and calls service', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EquipmentController],
      providers: [
        {
          provide: EquipmentService,
          useValue: {
            list: jest.fn(async () => [{ equipment_id: 'eq_1' }]),
          },
        },
      ],
    }).compile();

    const ctrl = moduleRef.get(EquipmentController);
    const svc = moduleRef.get(EquipmentService) as any;

    const res = await ctrl.list({
      code_commune: '75056',
      code_departement: '75',
      equipment_category: 'health',
      limit: '50',
      offset: '10',
      include_location: 'false',
    } as any);

    expect(svc.list).toHaveBeenCalledWith({
      codeCommune: '75056',
      codeDepartement: '75',
      equipmentCategory: 'health',
      limit: 50,
      offset: 10,
      includeLocation: false,
    });
    expect(res[0].equipment_id).toBe('eq_1');
  });

  it('defaults include_location to true', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EquipmentController],
      providers: [
        {
          provide: EquipmentService,
          useValue: {
            list: jest.fn(async () => []),
          },
        },
      ],
    }).compile();

    const ctrl = moduleRef.get(EquipmentController);
    const svc = moduleRef.get(EquipmentService) as any;

    await ctrl.list({ limit: '10' } as any);
    expect(svc.list).toHaveBeenCalledWith(
      expect.objectContaining({ includeLocation: true }),
    );
  });
});
