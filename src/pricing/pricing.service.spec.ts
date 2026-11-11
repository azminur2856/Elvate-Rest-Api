import { effectivePriceSql, priceOf } from './pricing.service';
import { compareSizes } from 'src/products/catalog.service';

const ends = new Date('2026-12-01T00:00:00Z');

describe('priceOf (flash sale > salePrice > price)', () => {
  it('regular price when nothing applies', () => {
    expect(priceOf({ price: 800, salePrice: null }, null, null)).toEqual({
      price: 800,
      effectivePrice: 800,
      discountPercent: 0,
      isOnSale: false,
      flashSaleEndsAt: null,
    });
  });

  it('salePrice applies to the product price', () => {
    expect(priceOf({ price: 800, salePrice: 640 }, null, null)).toMatchObject({
      effectivePrice: 640,
      discountPercent: 20,
      isOnSale: true,
    });
  });

  it('a salePrice that is not lower than price is ignored', () => {
    expect(
      priceOf({ price: 800, salePrice: 900 }, null, null).effectivePrice,
    ).toBe(800);
  });

  it('a variant override keeps the same sale percentage', () => {
    expect(
      priceOf({ price: 800, salePrice: 640 }, { price: 1000 }, null),
    ).toMatchObject({ price: 1000, effectivePrice: 800, discountPercent: 20 });
  });

  it('a live flash sale beats salePrice, rounded to whole taka', () => {
    expect(
      priceOf({ price: 1199, salePrice: 999 }, null, {
        discountPercent: 25,
        endsAt: ends,
      }),
    ).toMatchObject({
      price: 1199,
      effectivePrice: 899, // 1199 × 0.75 = 899.25
      discountPercent: 25,
      isOnSale: true,
      flashSaleEndsAt: ends,
    });
  });

  it('flash sale on a variant override', () => {
    expect(
      priceOf(
        { price: 1200, salePrice: null },
        { price: 1300 },
        {
          discountPercent: 25,
          endsAt: ends,
        },
      ).effectivePrice,
    ).toBe(975);
  });

  it('the SQL version encodes the same order of rules', () => {
    const sql = effectivePriceSql.replace(/\s+/g, ' ');
    expect(sql.indexOf('fs.id IS NOT NULL')).toBeLessThan(
      sql.indexOf('"salePrice" < p.price'),
    );
    expect(sql).toContain(
      'ROUND(p.price * (100 - fs."discountPercent") / 100.0)',
    );
  });
});

describe('compareSizes', () => {
  it('orders clothing sizes, then numbers, then text, nulls last', () => {
    expect(
      ['XL', null, '32', 'M', 'Free', 'xs', '30', 'L'].sort(compareSizes),
    ).toEqual(['xs', 'M', 'L', 'XL', '30', '32', 'Free', null]);
  });
});
