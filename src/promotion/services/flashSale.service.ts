import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlashSale } from '../entities/flash_sale.entity';
import { CreateFlashSaleDto } from '../dto/create_flash_sale.dto';
import { UpdateFlashSaleDto } from '../dto/update_flash_sale.dto';

@Injectable()
export class FlashSaleService {
  constructor(
    @InjectRepository(FlashSale)
    private readonly flashSaleRepository: Repository<FlashSale>,
  ) {}

  async create(dto: CreateFlashSaleDto): Promise<FlashSale> {
    const sale = this.flashSaleRepository.create(dto);
    return this.flashSaleRepository.save(sale);
  }

  async update(id: number, dto: UpdateFlashSaleDto): Promise<FlashSale> {
    const sale = await this.flashSaleRepository.findOne({ where: { id } });
    if (!sale) {
      throw new NotFoundException(`FlashSale with ID ${id} not found`);
    }
    Object.assign(sale, dto);
    return this.flashSaleRepository.save(sale);
  }

  async delete(id: number): Promise<{ message: string }> {
    const result = await this.flashSaleRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`FlashSale with ID ${id} not found`);
    }
    return { message: `FlashSale with ID ${id} deleted successfully` };
  }

  async findAll(): Promise<FlashSale[]> {
    return this.flashSaleRepository.find({
      relations: ['product'],
    });
  }
}
