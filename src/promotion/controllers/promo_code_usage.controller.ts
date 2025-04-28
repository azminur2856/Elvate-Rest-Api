import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Param,
  Delete,
} from '@nestjs/common';
import { PromoCodeUsageService } from '../services/promoCodeUsage.service';
import { CreatePromoCodeUsageDto } from '../dto/create_promo_code_usage.dto';
import { UpdatePromoCodeUsageDto } from '../dto/update_promo_code_usage.dto';

@Controller('promo-code-usage')
export class PromoCodeUsageController {
  constructor(private readonly promoCodeUsageService: PromoCodeUsageService) {}

  @Post()
  create(@Body() dto: CreatePromoCodeUsageDto) {
    return this.promoCodeUsageService.create(dto);
  }

  @Get()
  findAll() {
    return this.promoCodeUsageService.findAll();
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdatePromoCodeUsageDto) {
    return this.promoCodeUsageService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: number) {
    return this.promoCodeUsageService.delete(id);
  }
}
