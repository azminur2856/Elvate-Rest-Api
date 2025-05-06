import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import dbConfig from './config/db.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductModule } from './product/product.module';
import { CategoryModule } from './category/category.module';
import { CartModule } from './cart/cart.module';
import { PromotionModule } from './promotion/promotion.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
// import path, { join } from 'path';
import { LogModule } from './log/log.module';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [dbConfig], // Assuming dbConfig is defined elsewhere
    }),
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST, // smtp.gmail.com
        port: parseInt(process.env.MAIL_PORT!), // 587
        auth: {
          user: process.env.MAIL_USER, // your-gmail-email@gmail.com
          pass: process.env.MAIL_PASS, // your-app-password
        },
      },
      defaults: {
        from: `"Elvate " <${process.env.MAIL_FROM}>`, // your-gmail-email@gmail.com
      },
      template: {
        dir: path.join(__dirname, '..', 'templates'),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
    TypeOrmModule.forRootAsync({ useFactory: dbConfig }),
    ProductModule,
    CartModule,
    PromotionModule,
    CategoryModule,
    AuthModule,
    UserModule,
    LogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
