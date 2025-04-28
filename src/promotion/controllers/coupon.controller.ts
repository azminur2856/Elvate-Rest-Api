import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Param,
  Delete,
} from '@nestjs/common';
import { CouponService } from '../services/coupon.service';
import { CreateCouponDto } from '../dto/create_coupon.dto';
import { UpdateCouponDto } from '../dto/update_coupon.dto';

@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.couponService.createCoupon(dto);
  }

  @Get()
  findAll() {
    return this.couponService.findAll();
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateCouponDto) {
    return this.couponService.updateCoupon(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: number) {
    return this.couponService.deleteCoupon(id);
  }
}
