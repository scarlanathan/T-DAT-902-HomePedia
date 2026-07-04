import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const poolConfig: PoolConfig = {
      host: this.config.get<string>('POSTGRES_HOST', 'localhost'),
      port: this.config.get<number>('POSTGRES_PORT')
        ? Number(this.config.get('POSTGRES_PORT'))
        : 5432,
      user: this.config.get<string>('POSTGRES_USER', 'homepedia'),
      password: this.config.get<string>('POSTGRES_PASSWORD', 'homepedia'),
      database: this.config.get<string>('POSTGRES_DB', 'homepedia'),
      max: this.config.get<number>('POSTGRES_POOL_MAX')
        ? Number(this.config.get('POSTGRES_POOL_MAX'))
        : 10,
      idleTimeoutMillis: this.config.get<number>('POSTGRES_POOL_IDLE_MS')
        ? Number(this.config.get('POSTGRES_POOL_IDLE_MS'))
        : 30_000,
      connectionTimeoutMillis: this.config.get<number>('POSTGRES_POOL_CONN_TIMEOUT_MS')
        ? Number(this.config.get('POSTGRES_POOL_CONN_TIMEOUT_MS'))
        : 10_000,
      ssl: this.config.get<string>('POSTGRES_SSL', 'false') === 'true' ? { rejectUnauthorized: false } : undefined,
    };

    this.pool = new Pool(poolConfig);
  }

  async onModuleDestroy() {
    if (this.pool) await this.pool.end();
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1 as ok');
      return true;
    } catch {
      return false;
    }
  }
}

