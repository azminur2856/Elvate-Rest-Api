import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from 'src/common/pagination';
import { OrderStatus } from 'src/orders/order.enums';

export const DELIVERY_STATUSES = [
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  // SEC-09: riders request a return; ADMIN / STAFF confirm RETURNED
  OrderStatus.RETURN_REQUESTED,
] as const;

export class DeliveryOrdersQueryDto extends PaginationQueryDto {
  /** active = PROCESSING / SHIPPED / OUT_FOR_DELIVERY / RETURN_REQUESTED; completed = DELIVERED / RETURNED */
  @IsOptional()
  @IsIn(['active', 'completed'])
  scope?: 'active' | 'completed';
}

export class DeliveryStatusDto {
  @IsIn(DELIVERY_STATUSES)
  status: (typeof DELIVERY_STATUSES)[number];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  note?: string;
}
