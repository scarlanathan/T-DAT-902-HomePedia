import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { parseQuery } from '../../lib/http';
import { LocationsService } from './locations.service';

const locationSchema = {
  type: 'object',
  properties: {
    location_id: { type: 'string' },
    code_commune: { type: 'string' },
    nom_commune: { type: 'string', nullable: true },
    code_departement: { type: 'string', nullable: true },
    code_region: { type: 'string', nullable: true },
    type_commune: { type: 'string', nullable: true },
    code_commune_parent: { type: 'string', nullable: true },
    cog_millesime: { type: 'integer', nullable: true },
    code_postal: { type: 'string', nullable: true },
  },
  required: ['location_id', 'code_commune'],
};

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('regions')
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 50 } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          region_id: { type: 'string' },
          code_region: { type: 'string' },
          nom_region: { type: 'string', nullable: true },
          code_commune_cheflieu: { type: 'string', nullable: true },
          cog_millesime: { type: 'integer', nullable: true },
        },
        required: ['region_id', 'code_region'],
      },
    },
  })
  async listRegions(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
      }),
      query,
    );
    return this.locations.listRegions({ limit: q.limit });
  }

  @Get('regions/:codeRegion')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        region_id: { type: 'string' },
        code_region: { type: 'string' },
        nom_region: { type: 'string', nullable: true },
        code_commune_cheflieu: { type: 'string', nullable: true },
        cog_millesime: { type: 'integer', nullable: true },
      },
      required: ['region_id', 'code_region'],
    },
  })
  @ApiNotFoundResponse({ description: 'Unknown region code' })
  async getRegion(@Param('codeRegion') codeRegion: string) {
    const row = await this.locations.byCodeRegion(codeRegion);
    if (!row) throw new NotFoundException('Unknown region code');
    return row;
  }

  @Get('departments')
  @ApiQuery({ name: 'code_region', required: false })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 200 } })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          departement_id: { type: 'string' },
          code_departement: { type: 'string' },
          nom_departement: { type: 'string', nullable: true },
          code_region: { type: 'string', nullable: true },
          code_commune_cheflieu: { type: 'string', nullable: true },
          cog_millesime: { type: 'integer', nullable: true },
        },
        required: ['departement_id', 'code_departement'],
      },
    },
  })
  async listDepartments(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        code_region: z.string().trim().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(200).default(200),
      }),
      query,
    );
    return this.locations.listDepartments({
      codeRegion: q.code_region,
      limit: q.limit,
    });
  }

  @Get('departments/:codeDepartement/communes')
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 500 } })
  @ApiQuery({ name: 'offset', required: false, schema: { type: 'integer', default: 0 } })
  @ApiOkResponse({ schema: { type: 'array', items: locationSchema } })
  async communesByDepartement(
    @Param('codeDepartement') codeDepartement: string,
    @Query() query: unknown,
  ) {
    const q = parseQuery(
      z.object({
        limit: z.coerce.number().int().min(1).max(2000).default(500),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      query,
    );
    return this.locations.communesByDepartement({
      codeDepartement,
      limit: q.limit,
      offset: q.offset,
    });
  }

  @Get('departments/:codeDepartement')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        departement_id: { type: 'string' },
        code_departement: { type: 'string' },
        nom_departement: { type: 'string', nullable: true },
        code_region: { type: 'string', nullable: true },
        code_commune_cheflieu: { type: 'string', nullable: true },
        cog_millesime: { type: 'integer', nullable: true },
      },
      required: ['departement_id', 'code_departement'],
    },
  })
  @ApiNotFoundResponse({ description: 'Unknown department code' })
  async getDepartment(@Param('codeDepartement') codeDepartement: string) {
    const row = await this.locations.byCodeDepartement(codeDepartement);
    if (!row) throw new NotFoundException('Unknown department code');
    return row;
  }

  @Get()
  @ApiQuery({ name: 'q', required: false, description: 'Search by commune name, postal code, or INSEE code prefix.' })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 20 } })
  @ApiOkResponse({ schema: { type: 'array', items: locationSchema } })
  async search(@Query() query: unknown) {
    const q = parseQuery(
      z.object({
        q: z.string().trim().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(200).default(20),
      }),
      query,
    );
    return this.locations.search({ q: q.q, limit: q.limit });
  }

  @Get(':codeCommune')
  @ApiOkResponse({ schema: locationSchema })
  @ApiNotFoundResponse({ description: 'Unknown commune code' })
  async getByCodeCommune(@Param('codeCommune') codeCommune: string) {
    const row = await this.locations.byCodeCommune(codeCommune);
    if (!row) throw new NotFoundException('Unknown commune code');
    return row;
  }
}
