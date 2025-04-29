import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from 'src/users/entities/users.entity';
import { Roles } from 'src/users/entities/roles.entity';
import { AdminUserController } from './controllers/admin-user.controller';
import { AdminUserService } from './services/admin-user.service';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminProductsController } from '../products/admin-products.controller';
import { AdminOrdersController } from './controllers/admin-orders.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users, Roles]),
    ProductsModule,
    OrdersModule,
  ],
  controllers: [AdminUserController, AdminProductsController, AdminOrdersController],
  providers: [AdminUserService],
  exports: [AdminUserService],
})
export class AdminModule {}
