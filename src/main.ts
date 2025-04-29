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
    { 
      name: 'A. Authentication', 
      description: 'User authentication endpoints' 
    },
    { 
      name: 'B. Public - User Profile', 
      description: 'Public user profile management endpoints' 
    },
    { 
      name: 'C. Public - Product Catalog', 
      description: 'Public product catalog endpoints' 
    },
    { 
      name: 'D. Public - Orders', 
      description: 'Customer order management endpoints' 
    },
    { 
      name: 'E. Admin - User Management', 
      description: 'Admin user management endpoints' 
    },
    { 
      name: 'F. Admin - Products', 
      description: 'Admin product management endpoints' 
    },
    { 
      name: 'G. Admin - Orders', 
      description: 'Admin order management endpoints' 
    }
  ];

  Object.keys(document.paths).forEach(path => {
    const pathItem = document.paths[path];
    Object.keys(pathItem).forEach(method => {
      const operation = pathItem[method];
      if (operation.tags) {
        operation.tags = operation.tags.map(tag => {
          switch (tag) {
            case 'auth': return 'A. Authentication';
            case 'users': return 'B. Public - User Profile';
            case 'products': return 'C. Public - Product Catalog';
            case 'orders': return 'D. Public - Orders';
            case 'admin-users': return 'E. Admin - User Management';
            case 'admin-products': return 'F. Admin - Products';
            case 'admin-orders': return 'G. Admin - Orders';
            case 'delivery-orders': return 'H. Delivery - Orders';
            default: return tag;
          }
        });
      }
    });
  });

  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();
