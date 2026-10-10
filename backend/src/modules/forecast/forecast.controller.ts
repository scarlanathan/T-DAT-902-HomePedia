import { Controller, Get, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { parseQuery } from '../../lib/http';
import { ForecastService } from './forecast.service';

const LEVELS = ['france', 'region', 'departement', 'commune'] as const;
const MAP_LEVELS = ['departement', 'region'] as const;
const RANKING_LEVELS = ['commune', 'departement'] as const;
const PROPERTY_TYPES = ['all', 'appartement', 'maison'] as const;
const SCENARIOS = ['central', 'optimiste', 'pessimiste'] as const;
const HORIZONS = [4, 8] as const;

const propertyTypeSchema = z.enum(PROPERTY_TYPES).default('all');
const scenarioSchema = z.enum(SCENARIOS).default('central');
const horizonSchema = z.coerce
  .number()
  .pipe(z.union([z.literal(4), z.literal(8)]))
  .default(4);

const num = () => ({ type: 'string', nullable: true });
const str = () => ({ type: 'string', nullable: true });
const date = () => ({ type: 'string', format: 'date', nullable: true });

const summaryRowSchema = {
  type: 'object',
  properties: {
    level: { type: 'string' },
    code: { type: 'string' },
    nom: str(),
    code_departement: str(),
    property_type: { type: 'string' },
    scenario: { type: 'string' },
    last_quarter: date(),
    last_price: num(),
    last_observed_price: num(),
    annual_sales: num(),
    trend_pct_year: num(),
    price_h4: num(),
    change_pct_h4: num(),
    lower_80_h4: num(),
    upper_80_h4: num(),
    price_h8: num(),
    change_pct_h8: num(),
    lower_80_h8: num(),
    upper_80_h8: num(),
    reliability: { type: 'string', nullable: true, enum: ['elevee', 'moyenne', 'faible'] },
    trained_at: { type: 'string', format: 'date-time', nullable: true },
  },
  required: ['level', 'code', 'property_type', 'scenario'],
};

const forecastValueProperties = () => ({
  last_price: num(),
  forecast_price: num(),
  change_pct: num(),
  lower_80: num(),
  upper_80: num(),
  annual_sales: num(),
  reliability: { type: 'string', nullable: true, enum: ['elevee', 'moyenne', 'faible'] },
});

@ApiTags('forecast')
@Controller('forecast')
export class ForecastController {
  constructor(private readonly forecast: ForecastService) {}

  @Get('model')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        model: {
          type: 'object',
          nullable: true,
          properties: {
            trained_at: { type: 'string', format: 'date-time' },
            history_start: date(),
            history_end: date(),
            horizon_quarters: { type: 'integer', nullable: true },
            method: str(),
            rate_elasticity: num(),
            damping_phi: num(),
            mean_reversion_kappa: num(),
            last_rate_pct: num(),
            last_rate_month: date(),
            n_series: { type: 'object', nullable: true, additionalProperties: { type: 'integer' } },
          },
        },
        scenarios: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              scenario: { type: 'string' },
              label: str(),
              description: str(),
              period_quarter: { type: 'string', format: 'date' },
              horizon: { type: 'integer' },
              rate_pct: num(),
              national_change_pct_year: num(),
            },
            required: ['scenario', 'period_quarter', 'horizon'],
          },
        },
        backtest: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              level: { type: 'string' },
              horizon: { type: 'integer' },
              n_series: { type: 'integer', nullable: true },
              mape_model: num(),
              mape_naive: num(),
              coverage_80: num(),
            },
            required: ['level', 'horizon'],
          },
        },
      },
      required: ['model', 'scenarios', 'backtest'],
    },
  })
  async model() {
    return this.forecast.model();
  }

  @Get('series')
  @ApiQuery({ name: 'level', required: true, enum: LEVELS })
  @ApiQuery({ name: 'code', required: false, description: "INSEE code; optional for level=france (defaults to 'FR')" })
  @ApiQuery({ name: 'property_type', required: false, enum: PROPERTY_TYPES, schema: { default: 'all' } })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: [...LEVELS] },
        code: { type: 'string' },
        nom: str(),
        property_type: { type: 'string', enum: [...PROPERTY_TYPES] },
        history: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              period_quarter: { type: 'string', format: 'date' },
              median_price_per_sqm: num(),
              sale_count: num(),
            },
            required: ['period_quarter'],
          },
        },
        forecast: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              scenario: { type: 'string' },
              period_quarter: { type: 'string', format: 'date' },
              horizon: { type: 'integer' },
              median_price_per_sqm: num(),
              lower_80: num(),
              upper_80: num(),
            },
            required: ['scenario', 'period_quarter', 'horizon'],
          },
        },
        summary: { type: 'array', items: summaryRowSchema },
        fallback: {
          type: 'object',
          nullable: true,
          properties: {
            level: { type: 'string', enum: ['departement'] },
            code: { type: 'string' },
          },
          required: ['level', 'code'],
        },
      },
      required: ['level', 'code', 'nom', 'property_type', 'history', 'forecast', 'summary', 'fallback'],
    },
  })
  @ApiNotFoundResponse({ description: 'Neither history nor forecast exist for this series' })
  async series(@Query() query: unknown) {
    const q = parseQuery(
      z
        .object({
          level: z.enum(LEVELS),
          code: z.string().trim().min(1).optional(),
          property_type: propertyTypeSchema,
        })
        .refine((v) => v.level === 'france' || v.code !== undefined, {
          message: 'code is required unless level=france',
          path: ['code'],
        }),
      query,
    );

    return this.forecast.series({
      level: q.level,
      code: q.code,
      propertyType: q.property_type,
    });
  }

  @Get('map')
  @ApiQuery({ name: 'level', required: true, enum: MAP_LEVELS })
  @ApiQuery({ name: 'scenario', required: false, enum: SCENARIOS, schema: { default: 'central' } })
  @ApiQuery({ name: 'property_type', required: false, enum: PROPERTY_TYPES, schema: { default: 'all' } })
  @ApiQuery({ name: 'horizon', required: false, enum: [...HORIZONS], description: 'Quarters ahead (4 or 8)', schema: { type: 'integer', default: 4 } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          nom: str(),
          ...forecastValueProperties(),
        },
        required: ['code'],
      },
    },
  })
  async map(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        level: z.enum(MAP_LEVELS),
        scenario: scenarioSchema,
        property_type: propertyTypeSchema,
        horizon: horizonSchema,
      }),
      query,
    );

    return this.forecast.map({
      level: q.level,
      scenario: q.scenario,
      propertyType: q.property_type,
      horizon: q.horizon,
    });
  }

  @Get('ranking')
  @ApiQuery({ name: 'level', required: true, enum: RANKING_LEVELS })
  @ApiQuery({ name: 'scenario', required: false, enum: SCENARIOS, schema: { default: 'central' } })
  @ApiQuery({ name: 'property_type', required: false, enum: PROPERTY_TYPES, schema: { default: 'all' } })
  @ApiQuery({ name: 'horizon', required: false, enum: [...HORIZONS], description: 'Quarters ahead (4 or 8)', schema: { type: 'integer', default: 4 } })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], schema: { default: 'desc' } })
  @ApiQuery({ name: 'code_departement', required: false })
  @ApiQuery({ name: 'min_annual_sales', required: false, schema: { type: 'integer', default: 0 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 20 } })
  @ApiQuery({ name: 'offset', required: false, schema: { type: 'integer', default: 0 } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          level: { type: 'string' },
          code: { type: 'string' },
          nom: str(),
          code_departement: str(),
          ...forecastValueProperties(),
        },
        required: ['level', 'code'],
      },
    },
  })
  async ranking(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        level: z.enum(RANKING_LEVELS),
        scenario: scenarioSchema,
        property_type: propertyTypeSchema,
        horizon: horizonSchema,
        order: z.enum(['asc', 'desc']).default('desc'),
        code_departement: z.string().trim().min(1).optional(),
        min_annual_sales: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(200).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      query,
    );

    return this.forecast.ranking({
      level: q.level,
      scenario: q.scenario,
      propertyType: q.property_type,
      horizon: q.horizon,
      order: q.order,
      codeDepartement: q.code_departement,
      minAnnualSales: q.min_annual_sales,
      limit: q.limit,
      offset: q.offset,
    });
  }
}
