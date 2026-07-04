import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { parseQuery } from '../../lib/http';
import { EquipmentService } from './equipment.service';

@ApiTags('equipment')
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get()
  @ApiQuery({ name: 'code_commune', required: false })
  @ApiQuery({ name: 'code_departement', required: false })
  @ApiQuery({
    name: 'equipment_category',
    required: false,
    description: 'education | health | commerce | sport | other',
  })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 200 } })
  @ApiQuery({ name: 'offset', required: false, schema: { type: 'integer', default: 0 } })
  @ApiQuery({ name: 'include_location', required: false, schema: { type: 'boolean', default: true } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          equipment_id: { type: 'string' },
          location_id: { type: 'string' },
          code_commune: { type: 'string' },
          code_iris: { type: 'string', nullable: true },
          millesime: { type: 'integer', nullable: true },
          typequ: { type: 'string', nullable: true },
          equipment_category: { type: 'string', nullable: true },
          lambert_x: { nullable: true },
          lambert_y: { nullable: true },
          qualite_xy: { type: 'string', nullable: true },
          source_file: { type: 'string', nullable: true },
          ingested_at: { type: 'string', format: 'date-time' },
          nom_commune: { type: 'string', nullable: true },
        },
        required: ['equipment_id', 'location_id', 'code_commune', 'ingested_at'],
      },
    },
  })
  async list(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        code_commune: z.string().trim().min(1).optional(),
        code_departement: z.string().trim().min(1).optional(),
        equipment_category: z.string().trim().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(2000).default(200),
        offset: z.coerce.number().int().min(0).default(0),
        include_location: z
          .union([z.literal('true'), z.literal('false')])
          .optional()
          .transform((v) => (v === undefined ? undefined : v === 'true')),
      }),
      query,
    );

    return this.equipment.list({
      codeCommune: q.code_commune,
      codeDepartement: q.code_departement,
      equipmentCategory: q.equipment_category,
      limit: q.limit,
      offset: q.offset,
      includeLocation: q.include_location ?? true,
    });
  }
}
