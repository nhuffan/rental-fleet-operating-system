import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Database } from './database/database.js';

@ApiTags('Health')
@Controller('health')
export class AppController {
  constructor(@Inject(Database) private readonly database: Database) {}
  /** Liveness: the process is up. No dependency is touched. */
  @Get() health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
  /** Readiness: the database answers within 3 seconds. Failure details are never returned. */
  @Get('ready')
  @ApiOkResponse({ description: 'Database reachable.' })
  async ready() {
    try {
      await Promise.race([
        this.database.pool.query('select 1'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000).unref(),
        ),
      ]);
    } catch {
      throw new ServiceUnavailableException({
        code: 'NOT_READY',
        message: 'Service is not ready',
      });
    }
    return { status: 'ready', timestamp: new Date().toISOString() };
  }
}
