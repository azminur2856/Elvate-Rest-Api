import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Param,
  Delete,
} from '@nestjs/common';
import { FlashSaleService } from '../services/flashSale.service';
import { CreateFlashSaleDto } from '../dto/create_flash_sale.dto';
import { UpdateFlashSaleDto } from '../dto/update_flash_sale.dto';

@Controller('flash-sales')
export class FlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  @Post()
  create(@Body() dto: CreateFlashSaleDto) {
    return this.flashSaleService.create(dto);
  }

  @Get()
  findAll() {
    return this.flashSaleService.findAll();
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateFlashSaleDto) {
    return this.flashSaleService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: number) {
    return this.flashSaleService.delete(id);
  }
}
