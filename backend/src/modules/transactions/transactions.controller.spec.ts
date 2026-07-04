import { Test } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

describe('TransactionsController', () => {
  it('parses query params and calls service', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: {
            list: jest.fn(async () => [{ transaction_id: '1' }]),
          },
        },
      ],
    }).compile();

    const ctrl = moduleRef.get(TransactionsController);
    const svc = moduleRef.get(TransactionsService) as any;

    const res = await ctrl.list({
      code_commune: '75056',
      nature_mutation: 'Vente',
      type_local: 'Appartement',
      from: '2020-01-01',
      to: '2020-12-31',
      limit: '10',
      offset: '5',
      include_location: 'false',
    } as any);

    expect(svc.list).toHaveBeenCalledWith({
      codeCommune: '75056',
      natureMutation: 'Vente',
      typeLocal: 'Appartement',
      from: '2020-01-01',
      to: '2020-12-31',
      limit: 10,
      offset: 5,
      includeLocation: false,
    });
    expect(res[0].transaction_id).toBe('1');
  });
});

