import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { parseQuery } from '../../lib/http';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('transaction-summary')
  @ApiQuery({ name: 'code_commune', required: false })
  @ApiQuery({ name: 'code_departement', required: false })
  @ApiQuery({ name: 'nature_mutation', required: false })
  @ApiQuery({ name: 'type_local', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD (inclusive)' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        transaction_count: { type: 'string' },
        min_date_mutation: { type: 'string', nullable: true, format: 'date-time' },
        max_date_mutation: { type: 'string', nullable: true, format: 'date-time' },
        median_valeur_fonciere: { nullable: true },
        median_price_per_sqm_built: { nullable: true },
      },
      required: ['transaction_count'],
    },
  })
  async transactionSummary(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        code_commune: z.string().trim().min(1).optional(),
        code_departement: z.string().trim().min(1).optional(),
        nature_mutation: z.string().trim().min(1).optional(),
        type_local: z.string().trim().min(1).optional(),
        from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
      query,
    );

    return this.stats.transactionSummary({
      codeCommune: q.code_commune,
      codeDepartement: q.code_departement,
      natureMutation: q.nature_mutation,
      typeLocal: q.type_local,
      from: q.from,
      to: q.to,
    });
  }

  @Get('city-housing-summary')
  @ApiQuery({ name: 'code_commune', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 500 } })
  @ApiQuery({ name: 'offset', required: false, schema: { type: 'integer', default: 0 } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code_commune: { type: 'string' },
          nom_commune: { type: 'string', nullable: true },
          period_month: { type: 'string', format: 'date-time' },
          sale_line_count: { type: 'string' },
          median_valeur_fonciere: { nullable: true },
          median_price_per_sqm_built: { nullable: true },
        },
        required: ['code_commune', 'period_month', 'sale_line_count'],
      },
    },
  })
  async cityHousingSummary(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        code_commune: z.string().trim().min(1).optional(),
        from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.coerce.number().int().min(1).max(2000).default(500),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      query,
    );

    return this.stats.cityHousingSummary({
      codeCommune: q.code_commune,
      from: q.from,
      to: q.to,
      limit: q.limit,
      offset: q.offset,
    });
  }

  @Get('city-equipment-summary')
  @ApiQuery({ name: 'code_commune', required: false })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 500 } })
  @ApiQuery({ name: 'offset', required: false, schema: { type: 'integer', default: 0 } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code_commune: { type: 'string' },
          nom_commune: { type: 'string', nullable: true },
          bpe_millesime: { type: 'integer', nullable: true },
          equipment_total_count: { type: 'string' },
          education_count: { type: 'string' },
          health_count: { type: 'string' },
          commerce_count: { type: 'string' },
          sport_count: { type: 'string' },
          other_count: { type: 'string' },
        },
        required: ['code_commune', 'equipment_total_count'],
      },
    },
  })
  async cityEquipmentSummary(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        code_commune: z.string().trim().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(2000).default(500),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      query,
    );

    return this.stats.cityEquipmentSummary({
      codeCommune: q.code_commune,
      limit: q.limit,
      offset: q.offset,
    });
  }

  @Get('city-social-summary')
  @ApiQuery({ name: 'code_commune', required: false })
  @ApiQuery({ name: 'sort_by', required: false, enum: ['median_income_eur'] })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 500 } })
  @ApiQuery({ name: 'offset', required: false, schema: { type: 'integer', default: 0 } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code_commune: { type: 'string' },
          nom_commune: { type: 'string', nullable: true },
          filosofi_millesime: { type: 'integer', nullable: true },
          median_income_eur: { nullable: true },
          poverty_rate: { nullable: true },
          inequality_ratio: { nullable: true },
          caf_beneficiary_share: { nullable: true },
          housing_aid_share: { nullable: true },
          income_d1_eur: { nullable: true },
          income_d9_eur: { nullable: true },
        },
        required: ['code_commune'],
      },
    },
  })
  async citySocialSummary(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        code_commune: z.string().trim().min(1).optional(),
        sort_by: z.enum(['median_income_eur']).optional(),
        order: z.enum(['asc', 'desc']).optional(),
        limit: z.coerce.number().int().min(1).max(2000).default(500),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      query,
    );

    return this.stats.citySocialSummary({
      codeCommune: q.code_commune,
      sortBy: q.sort_by,
      order: q.order,
      limit: q.limit,
      offset: q.offset,
    });
  }

  @Get('city-social-summary/count')
  @ApiQuery({ name: 'code_commune', required: false })
  @ApiQuery({ name: 'sort_by', required: false, enum: ['median_income_eur'] })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { count: { type: 'integer' } },
      required: ['count'],
    },
  })
  async citySocialSummaryCount(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        code_commune: z.string().trim().min(1).optional(),
        sort_by: z.enum(['median_income_eur']).optional(),
      }),
      query,
    );

    const count = await this.stats.citySocialSummaryCount({
      codeCommune: q.code_commune,
      sortBy: q.sort_by,
    });

    return { count };
  }

  @Get('iris-social-summary')
  @ApiQuery({ name: 'code_commune', required: false })
  @ApiQuery({ name: 'code_iris', required: false })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 500 } })
  @ApiQuery({ name: 'offset', required: false, schema: { type: 'integer', default: 0 } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code_iris: { type: 'string' },
          code_commune: { type: 'string' },
          nom_commune: { type: 'string', nullable: true },
          nom_iris: { type: 'string', nullable: true },
          filosofi_millesime: { type: 'integer', nullable: true },
          median_income_eur: { nullable: true },
          poverty_rate: { nullable: true },
          inequality_ratio: { nullable: true },
          caf_beneficiary_share: { nullable: true },
        },
        required: ['code_iris', 'code_commune'],
      },
    },
  })
  async irisSocialSummary(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        code_commune: z.string().trim().min(1).optional(),
        code_iris: z.string().trim().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(2000).default(500),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      query,
    );

    return this.stats.irisSocialSummary({
      codeCommune: q.code_commune,
      codeIris: q.code_iris,
      limit: q.limit,
      offset: q.offset,
    });
  }

  @Get('opportunity-score')
  @ApiQuery({ name: 'code_commune', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 500 } })
  @ApiQuery({ name: 'offset', required: false, schema: { type: 'integer', default: 0 } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code_commune: { type: 'string' },
          nom_commune: { type: 'string', nullable: true },
          period_month: { type: 'string', format: 'date-time' },
          sale_line_count: { type: 'string' },
          median_valeur_fonciere: { nullable: true },
          price_median_per_sqm: { nullable: true },
          median_income_eur: { nullable: true },
          poverty_rate: { nullable: true },
          csp_diversity_index: { nullable: true },
          qpv_share: { nullable: true },
          equipment_density: { nullable: true },
          transit_accessibility: { nullable: true },
          safety_index: { nullable: true },
          property_tax_rate_pct: { nullable: true },
          assumed_interest_rate: { nullable: true },
          assumed_term_months: { type: 'integer', nullable: true },
          assumed_max_dti: { nullable: true },
          borrowing_capacity_eur: { nullable: true },
          price_to_capacity_ratio: { nullable: true },
          price_score: { nullable: true },
          social_mix_score: { nullable: true },
          quality_of_life_score: { nullable: true },
          composite_score: { nullable: true },
        },
        required: ['code_commune', 'period_month', 'sale_line_count'],
      },
    },
  })
  async opportunityScore(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        code_commune: z.string().trim().min(1).optional(),
        from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.coerce.number().int().min(1).max(2000).default(500),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      query,
    );

    return this.stats.opportunityScore({
      codeCommune: q.code_commune,
      from: q.from,
      to: q.to,
      limit: q.limit,
      offset: q.offset,
    });
  }

  @Get('commune-ranking/count')
  @ApiQuery({
    name: 'metric',
    required: true,
    enum: [
      'median_income_eur',
      'composite_score',
      'social_mix_score',
      'quality_of_life_score',
      'price_median_per_sqm',
    ],
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { count: { type: 'integer' } },
      required: ['count'],
    },
  })
  async communeRankingCount(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        metric: z.enum([
          'median_income_eur',
          'composite_score',
          'social_mix_score',
          'quality_of_life_score',
          'price_median_per_sqm',
          'personalized',
        ]),
      }),
      query,
    );

    const count = await this.stats.communeRankingCount({ metric: q.metric });
    return { count };
  }

  @Get('commune-ranking')
  @ApiQuery({
    name: 'metric',
    required: true,
    enum: [
      'median_income_eur',
      'composite_score',
      'social_mix_score',
      'quality_of_life_score',
      'price_median_per_sqm',
    ],
  })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 500 } })
  @ApiQuery({ name: 'offset', required: false, schema: { type: 'integer', default: 0 } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code_commune: { type: 'string' },
          nom_commune: { type: 'string', nullable: true },
          value: { nullable: true },
        },
        required: ['code_commune'],
      },
    },
  })
  async communeRanking(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        metric: z.enum([
          'median_income_eur',
          'composite_score',
          'social_mix_score',
          'quality_of_life_score',
          'price_median_per_sqm',
          'personalized',
        ]),
        order: z.enum(['asc', 'desc']).default('desc'),
        limit: z.coerce.number().int().min(1).max(2000).default(500),
        offset: z.coerce.number().int().min(0).default(0),
        w_price: z.coerce.number().min(0).max(1).optional(),
        w_social: z.coerce.number().min(0).max(1).optional(),
        w_quality: z.coerce.number().min(0).max(1).optional(),
      }),
      query,
    );

    return this.stats.communeRanking({
      metric: q.metric,
      order: q.order,
      limit: q.limit,
      offset: q.offset,
      weights:
        q.w_price !== undefined ||
        q.w_social !== undefined ||
        q.w_quality !== undefined
          ? {
              price: q.w_price ?? 0.5,
              social: q.w_social ?? 0.25,
              quality: q.w_quality ?? 0.25,
            }
          : undefined,
    });
  }
}

