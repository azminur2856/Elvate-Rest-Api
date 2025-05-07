import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtWithBlacklistGuard } from './auth/CustomGuard/jwt_blacklist.guard';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const jwtWithBlacklistGuard = app.get(JwtWithBlacklistGuard);
  app.useGlobalGuards(jwtWithBlacklistGuard);
  await app.listen(3000);
}
bootstrap();
