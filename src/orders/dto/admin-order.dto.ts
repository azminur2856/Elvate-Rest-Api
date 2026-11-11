import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/pagination';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../order.enums';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

export class AdminOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  /** Order number, customer e-mail or name. */
  @IsOptional()
  @trim
  @IsString()
  @MaxLength(100)
  q?: string;

  /** ISO date or date-time; a plain date means from 00:00 UTC. */
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  /** ISO date or date-time; a plain date includes that whole day. */
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AssignDeliveryDto {
  @IsUUID()
  deliveryManId: string;
}

export class OrderNotesDto {
  /** `null` or "" clears the notes. */
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  adminNotes: string | null;
}

export class OrderStatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}
