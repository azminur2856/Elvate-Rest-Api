import { Module } from '@nestjs/common';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminProductsController } from './controllers/admin-products.controller';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminReportsController } from './controllers/admin-reports.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminProductsService } from './services/admin-products.service';
import { AdminOrdersService } from './services/admin-orders.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminReportsService } from './services/admin-reports.service';

@Module({
  controllers: [AdminUsersController, AdminProductsController, AdminOrdersController, AdminDashboardController, AdminReportsController],
  providers: [AdminUsersService, AdminProductsService, AdminOrdersService, AdminDashboardService, AdminReportsService]
})
export class AdminModule {}
