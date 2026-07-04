import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('meta')
@Controller()
export class AppController {
  @Get()
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        status: { type: 'string' },
      },
      required: ['name', 'status'],
    },
  })
  getRoot(): { name: string; status: string } {
    return { name: 'homepedia-backend', status: 'ok' };
  }
}
