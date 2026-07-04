import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { parseQuery } from '../../lib/http';
import { MapService } from './map.service';

@ApiTags('map')
@Controller('map')
export class MapController {
  constructor(private readonly map: MapService) {}

  @Get('transactions')
  @ApiQuery({
    name: 'bbox',
    required: true,
    description: 'Bounding box as "minLon,minLat,maxLon,maxLat".',
  })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 2000 } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          transaction_id: { type: 'string' },
          date_mutation: { type: 'string', nullable: true, format: 'date-time' },
          valeur_fonciere: { type: 'string', nullable: true },
          price_per_sqm_built: { type: 'string', nullable: true },
          type_local: { type: 'string', nullable: true },
          longitude: { type: 'number' },
          latitude: { type: 'number' },
          code_commune: { type: 'string', nullable: true },
        },
        required: ['transaction_id', 'longitude', 'latitude'],
      },
    },
  })
  async transactions(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        bbox: z
          .string()
          .trim()
          .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/),
        from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.coerce.number().int().min(1).max(5000).default(2000),
      }),
      query,
    );

    const [minLon, minLat, maxLon, maxLat] = q.bbox.split(',').map(Number);

    return this.map.transactionPoints({
      bbox: { minLon, minLat, maxLon, maxLat },
      from: q.from,
      to: q.to,
      limit: q.limit,
    });
  }
}

