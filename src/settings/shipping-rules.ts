/** BE-30: the three delivery numbers, in whole BDT. */
export interface ShippingRules {
  insideDhaka: number;
  outsideDhaka: number;
  /** Free delivery from this amount (after the coupon); 0 = off. */
  freeThreshold: number;
}

export const FEE_MAX = 5_000;
export const FREE_THRESHOLD_MIN = 100;
export const FREE_THRESHOLD_MAX = 100_000;

export const FEE_LIMIT_MESSAGE =
  'Delivery fees must be whole numbers from 0 to 5,000.';
export const FREE_THRESHOLD_LIMIT_MESSAGE =
  'Free delivery must be 0 (off) or a whole number from 100 to 100,000.';

export const isValidFee = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= FEE_MAX;

export const isValidFreeThreshold = (v: unknown): v is number =>
  v === 0 ||
  (typeof v === 'number' &&
    Number.isInteger(v) &&
    v >= FREE_THRESHOLD_MIN &&
    v <= FREE_THRESHOLD_MAX);

/** The first problem with these numbers, or null when they are fine. */
export function shippingRulesProblem(r: Partial<ShippingRules>): string | null {
  if (!isValidFee(r?.insideDhaka) || !isValidFee(r?.outsideDhaka)) {
    return FEE_LIMIT_MESSAGE;
  }
  if (!isValidFreeThreshold(r?.freeThreshold)) {
    return FREE_THRESHOLD_LIMIT_MESSAGE;
  }
  return null;
}

/** Used when the env vars are not set. */
export const DEFAULT_SHIPPING: Readonly<ShippingRules> = {
  insideDhaka: 60,
  outsideDhaka: 120,
  freeThreshold: 3000,
};

/**
 * First-start values for the table row: the `SHIPPING_*` env vars when they
 * are set and within the limits, else 60 / 120 / 3000. `ignored` names the
 * env vars that were set but not usable.
 */
export function envShippingDefaults(env: NodeJS.ProcessEnv = process.env): {
  rules: ShippingRules;
  ignored: string[];
} {
  const ignored: string[] = [];
  const read = (
    name: string,
    valid: (v: unknown) => boolean,
    fallback: number,
  ) => {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    const v = Number(raw);
    if (valid(v)) return v;
    ignored.push(name);
    return fallback;
  };
  return {
    rules: {
      insideDhaka: read(
        'SHIPPING_FEE_INSIDE_DHAKA',
        isValidFee,
        DEFAULT_SHIPPING.insideDhaka,
      ),
      outsideDhaka: read(
        'SHIPPING_FEE_OUTSIDE_DHAKA',
        isValidFee,
        DEFAULT_SHIPPING.outsideDhaka,
      ),
      freeThreshold: read(
        'FREE_SHIPPING_THRESHOLD',
        isValidFreeThreshold,
        DEFAULT_SHIPPING.freeThreshold,
      ),
    },
    ignored,
  };
}

/**
 * The delivery fee of an order (contract `Quote`): free when the amount after
 * the coupon reaches the threshold, never free while the threshold is 0.
 */
export function shippingFeeFor(
  rules: ShippingRules,
  insideDhaka: boolean,
  afterDiscount: number,
): number {
  if (afterDiscount <= 0) return 0;
  if (rules.freeThreshold > 0 && afterDiscount >= rules.freeThreshold) return 0;
  return insideDhaka ? rules.insideDhaka : rules.outsideDhaka;
}
