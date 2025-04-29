import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsArray, IsUUID, IsNumber, IsString, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty({
    description: 'ID of the product to order',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Quantity of the product to order',
    example: 2,
    minimum: 1
  })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    description: 'Selected size of the clothing item',
    example: 'M',
    required: false
  })
  @IsString()
  @IsOptional()
  size?: string;

  @ApiProperty({
    description: 'Selected color of the clothing item',
    example: 'Navy Blue',
    required: false
  })
  @IsString()
  @IsOptional()
  color?: string;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'List of items in the order',
    type: [OrderItemDto],
    example: [
      {
        productId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 2,
        size: 'M',
        color: 'Navy Blue'
      },
      {
        productId: '123e4567-e89b-12d3-a456-426614174001',
        quantity: 1,
        size: '32',
        color: 'Dark Wash'
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({
    description: 'Payment method for the order',
    example: 'CREDIT_CARD',
    enum: ['CREDIT_CARD', 'PAYPAL', 'CASH_ON_DELIVERY']
  })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({
    description: 'Additional notes for the order',
    example: 'Please deliver after 5 PM. Gift wrapping required.',
    required: false
  })
  @IsString()
  @IsOptional()
  notes?: string;
} 