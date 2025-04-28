import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePromoCodeUsageDto } from '../dto/create_promo_code_usage.dto';
import { PromoCodeUsage } from '../entities/promocode_usage.entity';
import { UpdatePromoCodeUsageDto } from '../dto/update_promo_code_usage.dto';

@Injectable()
export class PromoCodeUsageService {
  constructor(
    @InjectRepository(PromoCodeUsage)
    private readonly promoCodeUsageRepository: Repository<PromoCodeUsage>,
  ) {}

  async create(dto: CreatePromoCodeUsageDto): Promise<PromoCodeUsage> {
    const usage = this.promoCodeUsageRepository.create(dto);
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
    return this.promoCodeUsageRepository.find();
  }
}
