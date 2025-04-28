import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from 'src/users/entities/users.entity';
import { Roles } from 'src/users/entities/roles.entity';
import { AdminUserController } from './controllers/admin-user.controller';
import { AdminUserService } from './services/admin-user.service';
import { ProductsModule } from '../products/products.module';
import { AdminProductController } from './controllers/admin-product.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users, Roles]),
    ProductsModule,
  ],
  controllers: [AdminUserController, AdminProductController],
  providers: [AdminUserService],
  exports: [AdminUserService],
})
export class AdminModule {}
