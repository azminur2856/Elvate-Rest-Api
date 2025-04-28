import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePromoCodeUsageDto } from '../dto/create_promo_code_usage.dto';
import { PromoCodeUsage } from '../entities/promocode_usage.entity';
import { UpdatePromoCodeUsageDto } from '../dto/update_promo_code_usage.dto';
import { Coupon } from '../entities/coupon.entity';

@Injectable()
export class PromoCodeUsageService {
  constructor(
    @InjectRepository(PromoCodeUsage)
    private readonly promoCodeUsageRepository: Repository<PromoCodeUsage>,

    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
  ) {}

  async create(
    createPromoCodeUsageDto: CreatePromoCodeUsageDto,
  ): Promise<PromoCodeUsage> {
    const coupon = await this.couponRepository.findOne({
      where: { id: createPromoCodeUsageDto.coupon_id },
    });

    if (!coupon) {
      throw new NotFoundException(
        `Coupon with ID ${createPromoCodeUsageDto.coupon_id} not found`,
      );
    }

    if (coupon.usage_count >= coupon.usage_limit) {
      throw new BadRequestException('Coupon usage limit exceeded');
    }

    coupon.usage_count += 1;
    await this.couponRepository.save(coupon);

    const usage = this.promoCodeUsageRepository.create(createPromoCodeUsageDto);
    return this.promoCodeUsageRepository.save(usage);
  }

  async update(
    id: number,
    dto: UpdatePromoCodeUsageDto,
  ): Promise<PromoCodeUsage> {
    const usage = await this.promoCodeUsageRepository.findOne({
      where: { id },
    });
    if (!usage) {
      throw new NotFoundException(`PromoCodeUsage with ID ${id} not found`);
    }
    Object.assign(usage, dto);
    return this.promoCodeUsageRepository.save(usage);
  }

  async delete(id: number): Promise<{ message: string }> {
    const result = await this.promoCodeUsageRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`PromoCodeUsage with ID ${id} not found`);
    }
    return { message: `PromoCodeUsage with ID ${id} deleted successfully` };
  }

  async findAll(): Promise<PromoCodeUsage[]> {
    return this.promoCodeUsageRepository.find({
      relations: ['coupon'],
    });
  }
}
