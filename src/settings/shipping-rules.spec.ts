import {
  DEFAULT_SHIPPING,
  FEE_LIMIT_MESSAGE,
  FREE_THRESHOLD_LIMIT_MESSAGE,
  envShippingDefaults,
  shippingFeeFor,
  shippingRulesProblem,
} from './shipping-rules';

// BE-30: the pure delivery fee rules.
describe('shippingFeeFor', () => {
  const rules = { insideDhaka: 60, outsideDhaka: 120, freeThreshold: 3000 };

  it('charges by zone below the threshold', () => {
    expect(shippingFeeFor(rules, true, 2999)).toBe(60);
    expect(shippingFeeFor(rules, false, 2999)).toBe(120);
  });

  it('is free from the threshold on (amount after the coupon)', () => {
    expect(shippingFeeFor(rules, true, 3000)).toBe(0);
    expect(shippingFeeFor(rules, false, 50_000)).toBe(0);
  });

  it('threshold 0 = free delivery off: every order pays', () => {
    const off = { ...rules, freeThreshold: 0 };
    expect(shippingFeeFor(off, true, 100_000)).toBe(60);
    expect(shippingFeeFor(off, false, 100_000)).toBe(120);
  });

  it('nothing to pay for, nothing to deliver for', () => {
    expect(shippingFeeFor(rules, true, 0)).toBe(0);
  });
});

describe('shippingRulesProblem', () => {
  const ok = { insideDhaka: 0, outsideDhaka: 5000, freeThreshold: 0 };

  it('accepts the limits', () => {
    expect(shippingRulesProblem(ok)).toBeNull();
    expect(shippingRulesProblem({ ...ok, freeThreshold: 100 })).toBeNull();
    expect(shippingRulesProblem({ ...ok, freeThreshold: 100000 })).toBeNull();
  });

  it('names the first problem with the API message', () => {
    expect(shippingRulesProblem({ ...ok, insideDhaka: 1.5 })).toBe(
      FEE_LIMIT_MESSAGE,
    );
    expect(shippingRulesProblem({ ...ok, outsideDhaka: 5001 })).toBe(
      FEE_LIMIT_MESSAGE,
    );
    expect(shippingRulesProblem({ ...ok, freeThreshold: 50 })).toBe(
      FREE_THRESHOLD_LIMIT_MESSAGE,
    );
    expect(shippingRulesProblem({})).toBe(FEE_LIMIT_MESSAGE);
  });
});

describe('envShippingDefaults (first start only)', () => {
  it('60 / 120 / 3000 without the env vars', () => {
    expect(envShippingDefaults({})).toEqual({
      rules: DEFAULT_SHIPPING,
      ignored: [],
    });
  });

  it('takes the env vars when they are within the limits', () => {
    expect(
      envShippingDefaults({
        SHIPPING_FEE_INSIDE_DHAKA: '70',
        SHIPPING_FEE_OUTSIDE_DHAKA: ' 150 ',
        FREE_SHIPPING_THRESHOLD: '0',
      }).rules,
    ).toEqual({ insideDhaka: 70, outsideDhaka: 150, freeThreshold: 0 });
  });

  it('ignores unusable env values and says which', () => {
    expect(
      envShippingDefaults({
        SHIPPING_FEE_INSIDE_DHAKA: '60.5',
        SHIPPING_FEE_OUTSIDE_DHAKA: 'abc',
        FREE_SHIPPING_THRESHOLD: '50',
      }),
    ).toEqual({
      rules: DEFAULT_SHIPPING,
      ignored: [
        'SHIPPING_FEE_INSIDE_DHAKA',
        'SHIPPING_FEE_OUTSIDE_DHAKA',
        'FREE_SHIPPING_THRESHOLD',
      ],
    });
  });
});
