import { TransactionsService } from './transactions.service';

function mockDb(rows: any[] = []) {
  return {
    query: jest.fn(async () => ({ rows })),
  };
}

describe('TransactionsService', () => {
  it('fetches by id', async () => {
    const db = mockDb([{ transaction_id: 'tx_1' }]);
    const svc = new TransactionsService(db as any);
    const out = await svc.byId({ transactionId: 'tx_1', includeLocation: true });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('WHERE f.transaction_id = $1');
    expect(params).toEqual(['tx_1']);
    expect(out?.transaction_id).toBe('tx_1');
  });

  it('includes location fields when includeLocation=true', async () => {
    const db = mockDb([{ transaction_id: '1', code_commune: '75056' }]);
    const svc = new TransactionsService(db as any);

    const out = await svc.list({
      codeCommune: '75056',
      natureMutation: 'Vente',
      typeLocal: 'Appartement',
      from: '2020-01-01',
      to: '2020-12-31',
      limit: 10,
      offset: 0,
      includeLocation: true,
    });

    const [sql, params] = (db.query as any).mock.calls[0];
    expect(sql).toContain('FROM fact_transaction');
    expect(sql).toContain('JOIN dim_location');
    expect(sql).toContain('d.code_commune');
    expect(sql).toContain('f.type_local = $5');
    expect(params).toEqual(['75056', '2020-01-01', '2020-12-31', 'Vente', 'Appartement', 10, 0]);
    expect(out[0].transaction_id).toBe('1');
  });

  it('does not include location select when includeLocation=false', async () => {
    const db = mockDb([{ transaction_id: '1' }]);
    const svc = new TransactionsService(db as any);

    await svc.list({
      limit: 10,
      offset: 0,
      includeLocation: false,
    });

    const [sql] = (db.query as any).mock.calls[0];
    expect(sql).not.toContain('d.nom_commune');
    expect(sql).toContain("f.nature_mutation = $1");
    expect(sql).toContain("f.type_local IN ('Maison', 'Appartement')");
  });
});

