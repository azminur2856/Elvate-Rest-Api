import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import {
  CouponQueryDto,
  CreateCouponDto,
  CreateFlashSaleDto,
  FlashSaleQueryDto,
  UpdateCouponDto,
  UpdateFlashSaleDto,
} from './dto/offers.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/users/enums/role.enum';
import type { AuthRequest } from 'src/common/auth-user';

/** Live flash sales + public coupons (BE-18). */
@ApiTags('Offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Public()
  @Get()
  list() {
    return this.offers.publicOffers();
  }
}

/** Coupon administration: ADMIN only (not STAFF). */
@ApiTags('Admin · Coupons')
@Roles(Role.ADMIN)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(@Query() query: CouponQueryDto) {
    return this.offers.listCoupons(query);
  }

  @Post()
  create(@Body() dto: CreateCouponDto, @Req() req: AuthRequest) {
    return this.offers.createCoupon(dto, req.user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
    @Req() req: AuthRequest,
  ) {
    return this.offers.updateCoupon(id, dto, req.user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.offers.removeCoupon(id, req.user);
  }
}

/** Flash sale administration: ADMIN only (not STAFF). */
@ApiTags('Admin · Flash sales')
@Roles(Role.ADMIN)
@Controller('admin/flash-sales')
export class AdminFlashSalesController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(@Query() query: FlashSaleQueryDto) {
    return this.offers.listFlashSales(query);
  }

  @Post()
  create(@Body() dto: CreateFlashSaleDto, @Req() req: AuthRequest) {
    return this.offers.createFlashSale(dto, req.user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlashSaleDto,
    @Req() req: AuthRequest,
  ) {
    return this.offers.updateFlashSale(id, dto, req.user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.offers.removeFlashSale(id, req.user);
  }
}
