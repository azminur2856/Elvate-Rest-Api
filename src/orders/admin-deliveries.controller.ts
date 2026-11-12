import { ApiTags } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { AdminOrdersService } from './admin-orders.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SHOP_MANAGER_ROLES } from 'src/users/enums/role.enum';

/** BE-29: ADMIN and STAFF see and manage deliveries (they never perform them). */
@ApiTags('Admin · Deliveries')
@Roles(...SHOP_MANAGER_ROLES)
@Controller('admin/deliveries')
export class AdminDeliveriesController {
  constructor(private readonly admin: AdminOrdersService) {}

  @Get('summary')
  summary() {
    return this.admin.deliverySummary();
  }
}
