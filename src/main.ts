import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtWithBlacklistGuard } from './auth/CustomGuard/jwt_blacklist.guard';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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

  const config = new DocumentBuilder()
    .setTitle('Elvate E-commerce API')
    .setDescription(
      'API documentation for the Elvate online shopping platform, including products, orders, users, and chatbot integration.',
    )
    .setVersion('1.0')
    .addTag('Products')
    .addTag('Orders')
    .addTag('Users')
    .addTag('Chatbot')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  await app.listen(3000);
}
bootstrap();
