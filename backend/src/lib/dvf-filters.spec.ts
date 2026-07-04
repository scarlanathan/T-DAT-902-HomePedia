import {
  buildDwellingLineWhere,
  buildMutationPriceWhere,
  DVF_MAX_PRICE_PER_SQM,
  DVF_MIN_PRICE_PER_SQM,
  DVF_MIN_SURFACE_SQM,
} from './dvf-filters';

describe('dvf-filters', () => {
  function collect(values: unknown[]) {
    const add = (val: unknown) => {
      values.push(val);
      return `$${values.length}`;
    };
    return add;
  }

  it('buildMutationPriceWhere always applies price band', () => {
    const values: unknown[] = [];
    const where = buildMutationPriceWhere('m', {}, collect(values));

    expect(where.join(' ')).toContain(`BETWEEN ${DVF_MIN_PRICE_PER_SQM} AND ${DVF_MAX_PRICE_PER_SQM}`);
    expect(values).toEqual([]);
  });

  it('buildMutationPriceWhere adds location and date filters', () => {
    const values: unknown[] = [];
    const where = buildMutationPriceWhere(
      'm',
      {
        codeCommune: '75056',
        codeDepartement: '75',
        from: '2020-01-01',
        to: '2020-12-31',
      },
      collect(values),
    );

    expect(where.join(' ')).toContain('d.code_commune = $1');
    expect(where.join(' ')).toContain('d.code_departement = $2');
    expect(where.join(' ')).toContain('m.date_mutation >= $3::date');
    expect(where.join(' ')).toContain('m.date_mutation <= $4::date');
    expect(values).toEqual(['75056', '75', '2020-01-01', '2020-12-31']);
  });

  it('buildMutationPriceWhere uses EXISTS for type_local', () => {
    const values: unknown[] = [];
    const where = buildMutationPriceWhere(
      'm',
      { typeLocal: 'Appartement' },
      collect(values),
    );

    expect(where.join(' ')).toContain('EXISTS');
    expect(where.join(' ')).toContain('normalized_dvf_transaction');
    expect(values).toEqual(['Appartement']);
  });

  it('buildDwellingLineWhere defaults to Vente and dwelling types', () => {
    const values: unknown[] = [];
    const where = buildDwellingLineWhere('f', {}, collect(values));

    expect(where.join(' ')).toContain("f.nature_mutation = $1");
    expect(where.join(' ')).toContain(`f.surface_reelle_bati >= ${DVF_MIN_SURFACE_SQM}`);
    expect(where.join(' ')).toContain("f.type_local IN ('Maison', 'Appartement')");
    expect(values).toEqual(['Vente']);
  });

  it('buildDwellingLineWhere filters a specific property type', () => {
    const values: unknown[] = [];
    const where = buildDwellingLineWhere(
      'f',
      { natureMutation: 'Vente', typeLocal: 'Maison' },
      collect(values),
    );

    expect(where.join(' ')).toContain('f.type_local = $2');
    expect(values).toEqual(['Vente', 'Maison']);
  });
});
