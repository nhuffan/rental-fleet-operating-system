import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { loadConfig } from '../config.js';
import * as schema from './schema.js';
export function createPool() {
  const config = loadConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { ca: config.ca, rejectUnauthorized: true },
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
  });
  // Idle disconnections are recoverable. An unhandled Pool error terminates Node
  // and may serialize the client (including connection credentials) in its log.
  pool.on('error', (error: Error) => {
    console.error(
      JSON.stringify({ event: 'database.pool.error', errorType: error.name }),
    );
  });
  return pool;
}
@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool = createPool();
  readonly db = drizzle(this.pool, { schema });
  async onModuleDestroy() {
    await this.pool.end();
  }
}
