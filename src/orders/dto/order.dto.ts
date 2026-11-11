import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/pagination';
import { OrderStatus, PaymentMethod } from '../order.enums';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

export class QuoteDto {
  /** Defaults to the user's default address (or the outside-Dhaka fee when there is none). */
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(40)
  couponCode?: string;
}

export class PlaceOrderDto {
  @IsUUID()
  addressId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(40)
  couponCode?: string;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CancelOrderDto {
  @IsOptional()
  @trim
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class MyOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
