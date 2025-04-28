import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Import controllers
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminProductsController } from './controllers/admin-products.controller';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminReportsController } from './controllers/admin-reports.controller';

// Import services
import { AdminUsersService } from './services/admin-users.service';
import { AdminProductsService } from './services/admin-products.service';
import { AdminOrdersService } from './services/admin-orders.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminReportsService } from './services/admin-reports.service';

// Import entities
import { AdminActivity } from './entities/admin-activity.entity';
import { Users } from 'src/users/entities/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AdminActivity, Users]), Users],
  controllers: [
    AdminUsersController,
    AdminProductsController,
    AdminOrdersController,
    AdminDashboardController,
    AdminReportsController,
  ],
  providers: [
    AdminUsersService,
    AdminProductsService,
    AdminOrdersService,
    AdminDashboardService,
    AdminReportsService,
  ],
  exports: [
    AdminUsersService,
    AdminProductsService,
    AdminOrdersService,
    AdminDashboardService,
    AdminReportsService,
  ],
})
export class AdminModule {}
