import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from '../entities/coupon.entity';
import { CreateCouponDto } from '../dto/create_coupon.dto';
import { UpdateCouponDto } from '../dto/update_coupon.dto';

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
  ) {}

  async createCoupon(dto: CreateCouponDto): Promise<Coupon> {
    const coupon = this.couponRepository.create(dto);
    return this.couponRepository.save(coupon);
  }

  async updateCoupon(id: number, dto: UpdateCouponDto): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${id} not found`);
    }
    Object.assign(coupon, dto);
    return this.couponRepository.save(coupon);
  }

  async deleteCoupon(id: number): Promise<{ message: string }> {
    const result = await this.couponRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Coupon with ID ${id} not found`);
    }
    return { message: `Coupon with ID ${id} deleted successfully` };
  }

  async findAll(): Promise<Coupon[]> {
    return this.couponRepository.find();
  }
}
