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
import { DeliveryService } from './delivery.service';
import { DeliveryOrdersQueryDto, DeliveryStatusDto } from './dto/delivery.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/users/enums/role.enum';
import type { AuthRequest } from 'src/common/auth-user';

/** Delivery app (BE-17). ADMIN may call these too. */
@Roles(Role.DELIVERY_MAN, Role.ADMIN)
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get('orders')
  list(@Query() query: DeliveryOrdersQueryDto, @Req() req: AuthRequest) {
    return this.delivery.list(req.user, query);
  }

  @Patch('orders/:id/status')
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeliveryStatusDto,
    @Req() req: AuthRequest,
  ) {
    return this.delivery.updateStatus(req.user, id, dto);
  }

  @Get('stats')
  stats(@Req() req: AuthRequest) {
    return this.delivery.stats(req.user);
  }
}
