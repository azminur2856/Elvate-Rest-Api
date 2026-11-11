import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { AdminOrdersService } from './admin-orders.service';
import {
  AdminOrdersQueryDto,
  AssignDeliveryDto,
  OrderNotesDto,
  OrderStatsQueryDto,
  UpdateOrderStatusDto,
} from './dto/admin-order.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SHOP_MANAGER_ROLES } from 'src/users/enums/role.enum';
import type { AuthRequest } from 'src/common/auth-user';

/** Order administration (BE-16): ADMIN and STAFF. Order detail is GET /orders/:id. */
@ApiTags('Admin · Orders')
@Roles(...SHOP_MANAGER_ROLES)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly admin: AdminOrdersService) {}

  @Get()
  list(@Query() query: AdminOrdersQueryDto) {
    return this.admin.list(query);
  }

  @Get('delivery-men')
  deliveryMen() {
    return this.admin.deliveryMen();
  }

  @Get('stats')
  stats(@Query() query: OrderStatsQueryDto) {
    return this.admin.stats(query.days ?? 30);
  }

  @Patch(':id/status')
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: AuthRequest,
  ) {
    return this.admin.updateStatus(id, dto, req.user);
  }

  @Patch(':id/assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDeliveryDto,
    @Req() req: AuthRequest,
  ) {
    return this.admin.assign(id, dto, req.user);
  }

  @Patch(':id/notes')
  notes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderNotesDto,
    @Req() req: AuthRequest,
  ) {
    return this.admin.notes(id, dto, req.user);
  }
}
