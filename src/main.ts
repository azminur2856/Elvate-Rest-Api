// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   await app.listen(process.env.PORT ?? 3000);
// }
// bootstrap();

// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { join } from 'path';
// import { NestExpressApplication } from '@nestjs/platform-express';

// async function bootstrap() {
//   const app = await NestFactory.create<NestExpressApplication>(AppModule);

//   app.useStaticAssets(join(__dirname, '..', 'src', 'auth', 'static'), {
//     prefix: '/auth/view',
//   });

//   app.enableCors({
//     origin: 'http://localhost:3000',
//     credentials: true,
//   });
//   await app.listen(8000);
// }
// bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: Buffer;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: 'https://elvate.vercel.app',
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

  await app.listen(process.env.PORT || 8000);
}
bootstrap();
