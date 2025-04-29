import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { OrderStatus } from '../enums/order-status.enum';

export class UpdateOrderDto {
  @ApiProperty({
    description: 'New status of the order',
    enum: OrderStatus,
    example: OrderStatus.PROCESSING,
    required: false
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiProperty({
    description: 'Additional notes or comments about the order',
    example: 'Order is being processed',
    required: false
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'Amount to be refunded for the order',
    example: 49.99,
    minimum: 0,
    required: false
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  refundAmount?: number;
} 