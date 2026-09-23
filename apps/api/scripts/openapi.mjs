import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/http.js';
const app = await NestFactory.create(AppModule, { logger: false });
try {
  const document = configureApp(app);
  writeFileSync(
    '../../packages/contracts/openapi.json',
    JSON.stringify(document, null, 2) + '\n',
  );
  console.log('OpenAPI exported without starting an HTTP server.');
} finally {
  await app.close();
}
