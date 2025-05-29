import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateStockDto {
  @ApiProperty({
    description: 'The new stock quantity for the product',
    minimum: 0,
    example: 100
  })
  @IsInt()
  @Min(0, { message: 'Stock quantity cannot be negative' })
  stockQuantity: number;
} 