// Must stay the first import: forces the process into UTC before TypeORM/pg load.
import './set-timezone';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import helmet from 'helmet';
import { setupSwagger, swaggerEnabled } from './swagger';
import { corsOrigins } from './common/cors';

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: Buffer;
  }
}

// Safety net: a missed `await` somewhere must not take the whole API down
// for every user (Node exits on unhandled rejections by default).
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Render (and most PaaS) terminate TLS at a reverse proxy; trust the first
  // hop so req.secure / req.protocol reflect the original https request.
  app.set('trust proxy', 1);
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.PROXY_SHARED_SECRET?.trim()
  ) {
    // SEC-06: without it, rate limits trust a forgeable X-Forwarded-For
    console.warn(
      'PROXY_SHARED_SECRET is not set: rate limits fall back to X-Forwarded-For, which direct callers can forge.',
    );
  }

  // Security headers. CORP cross-origin so images/files served by the API
  // still load if a page ever embeds them from the API origin directly.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(cookieParser());

  // whitelist: strip every body/query field without a validator decorator,
  // so DTOs are the allow-list (e.g. `role` can never ride along on
  // updateUser / createUser). transform: DTO instances + typed params.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // In production the frontend proxies API calls through its own origin
  // (Next.js rewrite), so CORS rarely matters — but keep the real frontend
  // origin and localhost allowed for direct calls and local development.
  // SEC-20: localhost is only allowed outside production (see corsOrigins)
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });

  // Only override body parser for webhook route
  app.use(
    '/subscriptions/webhook',
    express.raw({ type: 'application/json' }),
    (req, res, next) => {
      req.rawBody = req.body;
      next();
    },
  );

  // API docs at /docs (SWAGGER_ENABLED; off in production by default)
  if (swaggerEnabled()) setupSwagger(app);

  await app.listen(process.env.PORT || 8000);
}
bootstrap();
