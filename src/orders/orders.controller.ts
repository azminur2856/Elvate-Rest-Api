import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import {
  CancelOrderDto,
  MyOrdersQueryDto,
  PlaceOrderDto,
  QuoteDto,
} from './dto/order.dto';
import type { AuthRequest } from 'src/common/auth-user';

/** Checkout + the customer's orders (BE-15). */
@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Prices the server cart for the checkout page. */
  @Post('quote')
  @HttpCode(HttpStatus.OK)
  quote(@Body() dto: QuoteDto, @Req() req: AuthRequest) {
    return this.orders.quote(req.user.id, dto);
  }

  @Post()
  place(@Body() dto: PlaceOrderDto, @Req() req: AuthRequest) {
    return this.orders.place(req.user, dto);
  }

  @Get('my')
  my(@Query() query: MyOrdersQueryDto, @Req() req: AuthRequest) {
    return this.orders.myOrders(req.user.id, query);
  }

  /** Stripe success page: `?session_id=` → which order, paid yet? */
  @Get('session/:sessionId')
  session(@Param('sessionId') sessionId: string, @Req() req: AuthRequest) {
    return this.orders.sessionStatus(req.user, sessionId);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.orders.detailFor(id, req.user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @Req() req: AuthRequest,
  ) {
    return this.orders.cancelByCustomer(req.user, id, dto);
  }

  /** New Stripe Checkout session for an unpaid card order. */
  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  pay(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.orders.pay(req.user, id);
  }
}
