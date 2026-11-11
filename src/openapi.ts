/**
 * `npm run openapi`: writes openapi.json without starting the HTTP server.
 * The app is created in preview mode, so no provider runs: no database
 * connection, no schema sync, no Stripe/mail clients.
 */
import './set-timezone';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './swagger';

async function main() {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: ['error'],
  });
  const document = buildOpenApiDocument(app);
  const out = resolve(process.cwd(), process.argv[2] ?? 'openapi.json');
  writeFileSync(out, JSON.stringify(document, null, 2) + '\n');
  console.log(`Wrote ${out} (${Object.keys(document.paths).length} paths)`);
  await app.close();
}

main().catch((err) => {
  console.error('openapi failed:', err);
  process.exit(1);
});
