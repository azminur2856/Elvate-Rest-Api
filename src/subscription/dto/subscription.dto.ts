import { IsIn, IsUUID } from 'class-validator';

export const PLANS = ['1m', '6m', '12m'] as const;
export type Plan = (typeof PLANS)[number];

/** POST /subscriptions/checkout (SEC-14). */
export class CreateCheckoutDto {
  @IsIn(PLANS, { message: 'plan must be one of 1m, 6m or 12m' })
  plan: Plan;
}

/** POST /subscriptions/cancel (SEC-14). */
export class CancelSubscriptionDto {
  @IsUUID()
  subscriptionId: string;
}
