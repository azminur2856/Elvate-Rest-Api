import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { ValidateBy, ValidationError } from 'class-validator';
import {
  FEE_LIMIT_MESSAGE,
  FEE_MAX,
  FREE_THRESHOLD_LIMIT_MESSAGE,
  FREE_THRESHOLD_MAX,
  ShippingRules,
  isValidFee,
  isValidFreeThreshold,
} from './shipping-rules';

/** One rule and one message per field (a missing field fails it too). */
const Check = (name: string, valid: (v: unknown) => boolean, message: string) =>
  ValidateBy({
    name,
    validator: { validate: (v) => valid(v), defaultMessage: () => message },
  });

/** BE-30: PATCH /admin/settings/shipping (all three required, whole BDT). */
export class UpdateShippingDto implements ShippingRules {
  @ApiProperty({ type: 'integer', minimum: 0, maximum: FEE_MAX, example: 60 })
  @Check('deliveryFee', isValidFee, FEE_LIMIT_MESSAGE)
  insideDhaka: number;

  @ApiProperty({ type: 'integer', minimum: 0, maximum: FEE_MAX, example: 120 })
  @Check('deliveryFee', isValidFee, FEE_LIMIT_MESSAGE)
  outsideDhaka: number;

  @ApiProperty({
    type: 'integer',
    description: `0 = free delivery off, else 100–${FREE_THRESHOLD_MAX}`,
    example: 3000,
  })
  @Check('freeThreshold', isValidFreeThreshold, FREE_THRESHOLD_LIMIT_MESSAGE)
  freeThreshold: number;
}

const messagesOf = (errors: ValidationError[]) => [
  ...new Set(errors.flatMap((e) => Object.values(e.constraints ?? {}))),
];

/**
 * Body pipe for the shipping route: unknown fields are a 400 here (the global
 * pipe only strips them) and each message is listed once. The route's body
 * parameter is typed with the `ShippingRules` interface, so the global pipe
 * leaves the body to this one.
 */
export const shippingBodyPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  expectedType: UpdateShippingDto,
  exceptionFactory: (errors) => new BadRequestException(messagesOf(errors)),
});
