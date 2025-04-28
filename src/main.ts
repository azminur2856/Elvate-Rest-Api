import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationExceptionFilter } from './common/exceptions/validation-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.setGlobalPrefix('/');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new ValidationExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Elvate REST API')
    .setDescription('API documentation for Elvate e-commerce platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  document.tags = [
    { name: 'A. Authentication', description: 'User authentication endpoints' },
    { name: 'B. Public - User Management', description: 'Public user management endpoints' },
    { name: 'C. Public - Product Catalog', description: 'Public product catalog endpoints' },
    { name: 'D. Admin - User Management', description: 'Admin user management endpoints' },
    { name: 'E. Admin - Products', description: 'Admin product management endpoints' },
  ];

  Object.keys(document.paths).forEach(path => {
    const pathItem = document.paths[path];
    Object.keys(pathItem).forEach(method => {
      const operation = pathItem[method];
      if (operation.tags) {
        operation.tags = operation.tags.map(tag => {
          if (tag === 'Authentication') return 'A. Authentication';
          if (tag === 'Public - User Management') return 'B. Public - User Management';
          if (tag === 'Public - Product Catalog') return 'C. Public - Product Catalog';
          if (tag === 'Admin - User Management') return 'D. Admin - User Management';
          if (tag === 'Admin - Products') return 'E. Admin - Products';
          return tag;
        });
      }
    });
  });

  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();
