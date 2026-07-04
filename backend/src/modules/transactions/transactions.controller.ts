import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { parseQuery } from '../../lib/http';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get(':transactionId')
  @ApiQuery({ name: 'include_location', required: false, schema: { type: 'boolean', default: true } })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        transaction_id: { type: 'string' },
        location_id: { type: 'string' },
        date_mutation: { type: 'string', nullable: true, format: 'date-time' },
        nature_mutation: { type: 'string', nullable: true },
        valeur_fonciere: { type: 'string', nullable: true },
        surface_reelle_bati: { type: 'string', nullable: true },
        price_per_sqm_built: { type: 'string', nullable: true },
        type_local: { type: 'string', nullable: true },
        code_type_local: { type: 'string', nullable: true },
        id_parcelle: { type: 'string', nullable: true },
        code_postal: { type: 'string', nullable: true },
        longitude: { type: 'number', nullable: true },
        latitude: { type: 'number', nullable: true },
        source_file: { type: 'string', nullable: true },
        ingested_at: { type: 'string', format: 'date-time' },
        code_commune: { type: 'string' },
        nom_commune: { type: 'string', nullable: true },
      },
      required: ['transaction_id', 'location_id', 'ingested_at'],
    },
  })
  @ApiNotFoundResponse({ description: 'Unknown transaction_id' })
  async getById(@Param('transactionId') transactionId: string, @Query() query: unknown) {
    const q = parseQuery(
      z.object({
        include_location: z
          .union([z.literal('true'), z.literal('false')])
          .optional()
          .transform((v) => v === 'true'),
      }),
      query,
    );

    const row = await this.transactions.byId({
      transactionId,
      includeLocation: q.include_location ?? true,
    });
    if (!row) throw new NotFoundException('Unknown transaction_id');
    return row;
  }

  @Get()
  @ApiQuery({ name: 'code_commune', required: false })
  @ApiQuery({ name: 'nature_mutation', required: false })
  @ApiQuery({ name: 'type_local', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 200 } })
  @ApiQuery({ name: 'offset', required: false, schema: { type: 'integer', default: 0 } })
  @ApiQuery({ name: 'include_location', required: false, schema: { type: 'boolean', default: true } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          transaction_id: { type: 'string' },
          location_id: { type: 'string' },
          date_mutation: { type: 'string', nullable: true, format: 'date-time' },
          nature_mutation: { type: 'string', nullable: true },
          valeur_fonciere: { type: 'string', nullable: true },
          surface_reelle_bati: { type: 'string', nullable: true },
          price_per_sqm_built: { type: 'string', nullable: true },
          type_local: { type: 'string', nullable: true },
          code_type_local: { type: 'string', nullable: true },
          id_parcelle: { type: 'string', nullable: true },
          code_postal: { type: 'string', nullable: true },
          longitude: { type: 'number', nullable: true },
          latitude: { type: 'number', nullable: true },
          source_file: { type: 'string', nullable: true },
          ingested_at: { type: 'string', format: 'date-time' },
          code_commune: { type: 'string' },
          nom_commune: { type: 'string', nullable: true },
        },
        required: ['transaction_id', 'location_id', 'ingested_at'],
      },
    },
  })
  async list(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        code_commune: z.string().trim().min(1).optional(),
        nature_mutation: z.string().trim().min(1).optional(),
        type_local: z.string().trim().min(1).optional(),
        from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.coerce.number().int().min(1).max(1000).default(200),
        offset: z.coerce.number().int().min(0).default(0),
        include_location: z
          .union([z.literal('true'), z.literal('false')])
          .optional()
          .transform((v) => v === 'true'),
      }),
      query,
    );

    return this.transactions.list({
      codeCommune: q.code_commune,
      natureMutation: q.nature_mutation,
      typeLocal: q.type_local,
      from: q.from,
      to: q.to,
      limit: q.limit,
      offset: q.offset,
      includeLocation: q.include_location ?? true,
    });
  }
}

