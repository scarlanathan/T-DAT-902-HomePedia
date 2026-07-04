import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DbService } from '../../src/modules/db/db.service';

type QueryCall = { text: string; params?: any[] };

class MockDbService {
  calls: QueryCall[] = [];

  async ping(): Promise<boolean> {
    return true;
  }

  async query(text: string, params?: any[]) {
    this.calls.push({ text, params });

    if (text.includes('FROM dim_region') && text.includes('WHERE code_region = $1')) {
      if (params?.[0] === '11') {
        return {
          rows: [
            {
              region_id: 'reg_11',
              code_region: '11',
              nom_region: 'Île-de-France',
              code_commune_cheflieu: '75056',
              cog_millesime: 2024,
              code_postal: '75001',
            },
          ],
        };
      }
      return { rows: [] };
    }

    if (text.includes('FROM dim_region')) {
      return {
        rows: [
          {
            region_id: 'reg_11',
            code_region: '11',
            nom_region: 'Île-de-France',
            code_commune_cheflieu: '75056',
            cog_millesime: 2024,
          },
        ],
      };
    }

    if (text.includes('FROM dim_departement') && text.includes('WHERE code_departement = $1')) {
      if (params?.[0] === '75') {
        return {
          rows: [
            {
              departement_id: 'dep_75',
              code_departement: '75',
              nom_departement: 'Paris',
              code_region: '11',
              code_commune_cheflieu: '75056',
              cog_millesime: 2024,
              code_postal: '75001',
            },
          ],
        };
      }
      return { rows: [] };
    }

    if (text.includes('FROM dim_departement')) {
      return {
        rows: [
          {
            departement_id: 'dep_75',
            code_departement: '75',
            nom_departement: 'Paris',
            code_region: '11',
            code_commune_cheflieu: '75056',
            cog_millesime: 2024,
          },
        ],
      };
    }

    if (text.includes('FROM dim_location') && text.includes('WHERE code_commune = $1')) {
      const code = params?.[0];
      if (code === '75056') {
        return {
          rows: [
            {
              location_id: 'loc_paris',
              code_commune: '75056',
              nom_commune: 'Paris',
              code_departement: '75',
              code_region: '11',
              type_commune: 'COM',
              code_commune_parent: null,
              cog_millesime: 2024,
              code_postal: '75001',
            },
          ],
        };
      }
      return { rows: [] };
    }

    if (text.includes('FROM dim_location') && text.includes('code_departement = $1')) {
      return {
        rows: [
          {
            location_id: 'loc_paris',
            code_commune: '75056',
            nom_commune: 'Paris',
            code_departement: '75',
            code_region: '11',
            type_commune: 'COM',
            code_commune_parent: null,
            cog_millesime: 2024,
          },
        ],
      };
    }

    if (text.includes('FROM dim_location')) {
      return {
        rows: [
          {
            location_id: 'loc_paris',
            code_commune: '75056',
            nom_commune: 'Paris',
            code_departement: '75',
            code_region: '11',
            type_commune: 'COM',
            code_commune_parent: null,
            cog_millesime: 2024,
          },
        ],
      };
    }

    if (text.includes('median_income_eur::text AS value')) {
      return {
        rows: [{ code_commune: '75056', nom_commune: 'Paris', value: '35000' }],
      };
    }

    if (text.includes('median_price_per_sqm_built::text AS value')) {
      return {
        rows: [{ code_commune: '75056', nom_commune: 'Paris', value: '10000' }],
      };
    }

    if (
      text.includes('::text AS value')
      && text.includes('FROM latest')
      && text.includes('composite_score')
    ) {
      return {
        rows: [{ code_commune: '75056', nom_commune: 'Paris', value: '55' }],
      };
    }

    if (text.includes('SELECT COUNT(*)::int AS count') && text.includes('FROM latest')) {
      return { rows: [{ count: 12000 }] };
    }

    if (
      text.includes('SELECT COUNT(*)::int AS count')
      && text.includes('FROM app_city_social_summary')
      && text.includes('median_income_eur IS NOT NULL')
    ) {
      return { rows: [{ count: 34875 }] };
    }

    if (text.includes('FROM app_city_housing_summary')) {
      return {
        rows: [
          {
            code_commune: '75056',
            nom_commune: 'Paris',
            period_month: '2024-01-01',
            sale_line_count: '1',
            median_valeur_fonciere: '450000',
            median_price_per_sqm_built: '10000',
          },
        ],
      };
    }

    if (text.includes('FROM app_city_equipment_summary')) {
      return {
        rows: [
          {
            code_commune: '75056',
            nom_commune: 'Paris',
            bpe_millesime: 2024,
            equipment_total_count: '5',
            education_count: '2',
            health_count: '1',
            commerce_count: '1',
            sport_count: '1',
            other_count: '0',
          },
        ],
      };
    }

    if (text.includes('FROM app_city_social_summary')) {
      return {
        rows: [
          {
            code_commune: '75056',
            nom_commune: 'Paris',
            filosofi_millesime: 2021,
            median_income_eur: '35000',
            poverty_rate: '12.5',
            inequality_ratio: '3.2',
            caf_beneficiary_share: '5.1',
            housing_aid_share: '2.0',
            income_d1_eur: '12000',
            income_d9_eur: '65000',
          },
        ],
      };
    }

    if (text.includes('FROM app_iris_social_summary')) {
      return {
        rows: [
          {
            code_iris: '751010101',
            code_commune: '75056',
            nom_commune: 'Paris',
            nom_iris: 'Quartier 1',
            filosofi_millesime: 2021,
            median_income_eur: '32000',
            poverty_rate: '10.0',
            inequality_ratio: '3.0',
            caf_beneficiary_share: '4.5',
          },
        ],
      };
    }

    if (text.includes('FROM app_opportunity_score')) {
      return {
        rows: [
          {
            code_commune: '75056',
            nom_commune: 'Paris',
            period_month: '2024-01-01',
            sale_line_count: '1',
            median_valeur_fonciere: '450000',
            price_median_per_sqm: '10000',
            median_income_eur: '35000',
            poverty_rate: '12.5',
            qpv_share: null,
            equipment_density: '0.8',
            transit_accessibility: null,
            safety_index: null,
            assumed_interest_rate: '0.035',
            assumed_term_months: 240,
            assumed_max_dti: '0.35',
            borrowing_capacity_eur: null,
            price_to_capacity_ratio: null,
            price_score: '40',
            social_mix_score: '70',
            quality_of_life_score: '60',
            composite_score: '55',
          },
        ],
      };
    }

    if (text.includes('FROM fact_equipment')) {
      return {
        rows: [
          {
            equipment_id: 'eq_1',
            location_id: 'loc_paris',
            code_commune: '75056',
            code_iris: '751010101',
            millesime: 2024,
            typequ: 'A101',
            equipment_category: 'education',
            lambert_x: '650000',
            lambert_y: '6860000',
            qualite_xy: '1',
            source_file: 'bpe_sample.csv',
            ingested_at: new Date().toISOString(),
            nom_commune: 'Paris',
          },
        ],
      };
    }

    if (text.includes('percentile_cont(0.5)') && text.includes('FROM dvf_mutation_price')) {
      return {
        rows: [
          {
            transaction_count: '1',
            min_date_mutation: '2024-01-01',
            max_date_mutation: '2024-01-01',
            median_valeur_fonciere: '450000',
            median_price_per_sqm_built: '10000',
          },
        ],
      };
    }

    if (text.includes('FROM fact_transaction')) {
      return {
        rows: [
          {
            transaction_id: 'tx_1',
            location_id: 'loc_paris',
            date_mutation: '2024-01-15',
            nature_mutation: 'Vente',
            valeur_fonciere: '450000',
            surface_reelle_bati: '45',
            price_per_sqm_built: '10000',
            type_local: 'Appartement',
            code_type_local: '2',
            id_parcelle: '75101000AB0001',
            code_postal: '75001',
            longitude: 2.3522,
            latitude: 48.8566,
            source_file: 'fixture.csv',
            ingested_at: new Date().toISOString(),
            code_commune: '75056',
            nom_commune: 'Paris',
          },
        ],
      };
    }

    return { rows: [] };
  }
}

describe('API e2e', () => {
  let app: INestApplication;
  let db: MockDbService;

  beforeAll(async () => {
    db = new MockDbService();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DbService)
      .useValue(db)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', postgres: 'up' });
  });

  it('GET /locations validates query params', async () => {
    await request(app.getHttpServer()).get('/locations?limit=999999').expect(400);
  });

  it('GET /locations returns results', async () => {
    const res = await request(app.getHttpServer()).get('/locations?q=paris&limit=5').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].code_commune).toBe('75056');
  });

  it('GET /locations/regions returns results', async () => {
    const res = await request(app.getHttpServer()).get('/locations/regions?limit=10').expect(200);
    expect(res.body[0].code_region).toBe('11');
    expect(res.body[0].nom_region).toBe('Île-de-France');
  });

  it('GET /locations/regions/:codeRegion returns detail', async () => {
    const res = await request(app.getHttpServer()).get('/locations/regions/11').expect(200);
    expect(res.body.code_region).toBe('11');
    expect(res.body.cog_millesime).toBe(2024);
  });

  it('GET /locations/regions/:codeRegion returns 404 if missing', async () => {
    await request(app.getHttpServer()).get('/locations/regions/99').expect(404);
  });

  it('GET /locations/departments returns results', async () => {
    const res = await request(app.getHttpServer())
      .get('/locations/departments?code_region=11&limit=10')
      .expect(200);
    expect(res.body[0].code_departement).toBe('75');
    expect(res.body[0].nom_departement).toBe('Paris');
  });

  it('GET /locations/departments/:code returns detail', async () => {
    const res = await request(app.getHttpServer()).get('/locations/departments/75').expect(200);
    expect(res.body.code_departement).toBe('75');
    expect(res.body.code_region).toBe('11');
  });

  it('GET /locations/departments/:code returns 404 if missing', async () => {
    await request(app.getHttpServer()).get('/locations/departments/99').expect(404);
  });

  it('GET /locations/departments/:code/communes returns results', async () => {
    const res = await request(app.getHttpServer())
      .get('/locations/departments/75/communes?limit=10')
      .expect(200);
    expect(res.body[0].code_commune).toBe('75056');
    expect(res.body[0].code_region).toBe('11');
  });

  it('GET /locations/:codeCommune returns commune with COG fields', async () => {
    const res = await request(app.getHttpServer()).get('/locations/75056').expect(200);
    expect(res.body.code_commune).toBe('75056');
    expect(res.body.type_commune).toBe('COM');
    expect(res.body.cog_millesime).toBe(2024);
  });

  it('GET /locations/:codeCommune returns 404 if missing', async () => {
    await request(app.getHttpServer()).get('/locations/00000').expect(404);
  });

  it('GET /stats/city-housing-summary returns rows', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/city-housing-summary?code_commune=75056&from=2020-01-01&to=2025-01-01&limit=5')
      .expect(200);
    expect(res.body[0].code_commune).toBe('75056');
  });

  it('GET /stats/city-equipment-summary validates limit', async () => {
    await request(app.getHttpServer()).get('/stats/city-equipment-summary?limit=99999').expect(400);
  });

  it('GET /stats/city-equipment-summary returns rows', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/city-equipment-summary?code_commune=75056&limit=5')
      .expect(200);
    expect(res.body[0].equipment_total_count).toBe('5');
    expect(res.body[0].education_count).toBe('2');
  });

  it('GET /stats/city-social-summary returns rows', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/city-social-summary?code_commune=75056&limit=5')
      .expect(200);
    expect(res.body[0].median_income_eur).toBe('35000');
    expect(res.body[0].poverty_rate).toBe('12.5');
  });

  it('GET /stats/iris-social-summary returns rows', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/iris-social-summary?code_commune=75056&code_iris=751010101&limit=5')
      .expect(200);
    expect(res.body[0].code_iris).toBe('751010101');
    expect(res.body[0].nom_iris).toBe('Quartier 1');
  });

  it('GET /stats/opportunity-score validates date format', async () => {
    await request(app.getHttpServer())
      .get('/stats/opportunity-score?from=not-a-date')
      .expect(400);
  });

  it('GET /stats/opportunity-score returns rows', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/opportunity-score?code_commune=75056&from=2020-01-01&to=2025-01-01&limit=5')
      .expect(200);
    expect(res.body[0].composite_score).toBe('55');
    expect(res.body[0].price_score).toBe('40');
    expect(res.body[0].social_mix_score).toBe('70');
  });

  it('GET /equipment validates limit', async () => {
    await request(app.getHttpServer()).get('/equipment?limit=99999').expect(400);
  });

  it('GET /equipment returns rows with filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/equipment?code_commune=75056&equipment_category=education&include_location=true&limit=5')
      .expect(200);
    expect(res.body[0].equipment_id).toBe('eq_1');
    expect(res.body[0].equipment_category).toBe('education');
    expect(res.body[0].nom_commune).toBe('Paris');
  });

  it('GET /transactions returns rows', async () => {
    const res = await request(app.getHttpServer())
      .get('/transactions?code_commune=75056&limit=5&include_location=true')
      .expect(200);
    expect(res.body[0].transaction_id).toBe('tx_1');
  });

  it('GET /transactions/:id returns row', async () => {
    const res = await request(app.getHttpServer()).get('/transactions/tx_1').expect(200);
    expect(res.body.transaction_id).toBe('tx_1');
  });

  it('GET /stats/transaction-summary returns summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/transaction-summary?code_commune=75056&from=2020-01-01&to=2025-01-01')
      .expect(200);
    expect(res.body.transaction_count).toBe('1');
  });

  it('GET /stats/commune-ranking requires metric', async () => {
    await request(app.getHttpServer()).get('/stats/commune-ranking').expect(400);
  });

  it('GET /stats/commune-ranking returns ranked rows', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/commune-ranking?metric=median_income_eur&limit=10&offset=0')
      .expect(200);
    expect(res.body[0].code_commune).toBe('75056');
    expect(res.body[0].value).toBe('35000');
  });

  it('GET /stats/commune-ranking/count returns total', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/commune-ranking/count?metric=median_income_eur')
      .expect(200);
    expect(res.body.count).toBe(34875);
  });

  it('GET /stats/commune-ranking returns composite score rows', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/commune-ranking?metric=composite_score&limit=5')
      .expect(200);
    expect(res.body[0].value).toBe('55');
  });

  it('GET /map/transactions validates bbox', async () => {
    await request(app.getHttpServer()).get('/map/transactions?bbox=bad').expect(400);
  });

  it('GET /map/transactions returns points', async () => {
    const res = await request(app.getHttpServer())
      .get('/map/transactions?bbox=2.0,48.0,3.0,49.0&limit=10')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].transaction_id).toBe('tx_1');
  });
});
