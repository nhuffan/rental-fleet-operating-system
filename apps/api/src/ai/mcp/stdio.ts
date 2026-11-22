import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { AppModule } from '../../app.module.js';
import { Database } from '../../database/database.js';
import { AiTools } from '../ai-tools.js';
import { createMcpServer } from './mcp-server.js';
import {
  assertLocalMcpAllowed,
  resolveLocalPrincipal,
} from './mcp-principal.js';

// Local development MCP host over stdio. stdout carries protocol frames only;
// diagnostics go to stderr and never include tokens, SQL or business data.
try {
  assertLocalMcpAllowed(process.env);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const database = app.get(Database);
  const server = createMcpServer(app.get(AiTools), () =>
    resolveLocalPrincipal(database, process.env),
  );
  await resolveLocalPrincipal(database, process.env);
  await server.connect(new StdioServerTransport());
  process.stdin.on('close', () => void app.close());
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'MCP server failed to start',
  );
  process.exit(1);
}
