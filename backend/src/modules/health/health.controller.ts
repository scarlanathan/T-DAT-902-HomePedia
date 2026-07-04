import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded'] },
        postgres: { type: 'string', enum: ['up', 'down'] },
      },
      required: ['status', 'postgres'],
    },
  })
  async getHealth(): Promise<{ status: 'ok' | 'degraded'; postgres: 'up' | 'down' }> {
    const postgresUp = await this.health.postgresUp();
    return {
      status: postgresUp ? 'ok' : 'degraded',
      postgres: postgresUp ? 'up' : 'down',
    };
  }
}

