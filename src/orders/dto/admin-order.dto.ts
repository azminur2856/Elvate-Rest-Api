import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/pagination';
import { toBool, toList } from 'src/common/query';
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

  /** BE-29: orders assigned to this delivery man. */
  @IsOptional()
  @IsUUID()
  deliveryManId?: string;

  /** BE-29: several statuses as CSV, e.g. "PROCESSING,SHIPPED" (list only, like `status`). */
  @IsOptional()
  @Transform(toList)
  @IsEnum(OrderStatus, { each: true })
  statuses?: OrderStatus[];

  /** BE-29: `true` = orders without a delivery man. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  unassigned?: boolean;
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

/** BE-29: why the admin corrects a stuck delivery. */
export enum CorrectionReason {
  DELIVERY_MAN_CONFIRMED_BY_PHONE = 'DELIVERY_MAN_CONFIRMED_BY_PHONE',
  CUSTOMER_CONFIRMED = 'CUSTOMER_CONFIRMED',
  DELIVERY_MAN_UNAVAILABLE = 'DELIVERY_MAN_UNAVAILABLE',
  OTHER = 'OTHER',
}

export const CORRECTION_REASON_LABELS: Record<CorrectionReason, string> = {
  [CorrectionReason.DELIVERY_MAN_CONFIRMED_BY_PHONE]:
    'Delivery man confirmed by phone',
  [CorrectionReason.CUSTOMER_CONFIRMED]: 'Customer confirmed',
  [CorrectionReason.DELIVERY_MAN_UNAVAILABLE]: 'Delivery man unavailable',
  [CorrectionReason.OTHER]: 'Other',
};

export const CORRECTION_ACTIONS = [
  OrderStatus.DELIVERED,
  OrderStatus.RETURN_REQUESTED,
] as const;
export type CorrectionAction = (typeof CORRECTION_ACTIONS)[number];

/** POST /admin/orders/:id/correction (ADMIN only, OUT_FOR_DELIVERY only). */
export class OrderCorrectionDto {
  @IsIn(CORRECTION_ACTIONS)
  action: CorrectionAction;

  @IsEnum(CorrectionReason)
  reason: CorrectionReason;

  @trim
  @IsString()
  @Length(10, 500)
  note: string;

  /** Required for cash on delivery when action is DELIVERED. */
  @IsOptional()
  @IsBoolean()
  cashCollected?: boolean;
}

export class OrderStatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}
