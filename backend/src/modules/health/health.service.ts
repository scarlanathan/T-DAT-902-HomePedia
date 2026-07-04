import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class HealthService {
  constructor(private readonly db: DbService) {}

  async postgresUp(): Promise<boolean> {
    return this.db.ping();
  }
}

