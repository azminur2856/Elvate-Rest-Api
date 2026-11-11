import { BadRequestException } from '@nestjs/common';
import { assertQuantity, CartLine, CartService } from './cart.service';

const line = (over: Partial<CartLine>): CartLine => ({
  id: 'l1',
  variantId: 'v1',
  productId: 'p1',
  slug: 'tee',
  name: 'Tee',
  image: null,
  size: 'M',
  color: null,
  unitPrice: 640,
  quantity: 2,
  lineTotal: 1280,
  stock: 5,
  available: true,
  ...over,
});

describe('cart rules', () => {
  it('caps a line at 10 and at stock with a readable 400', () => {
    expect(() => assertQuantity(11, 50)).toThrow('at most 10');
    expect(() => assertQuantity(1, 0)).toThrow('out of stock');
    expect(() => assertQuantity(6, 5)).toThrow('Only 5 left');
    expect(() => assertQuantity(6, 5)).toThrow(BadRequestException);
    expect(() => assertQuantity(5, 5)).not.toThrow();
  });

  it('subtotal counts available lines only; itemCount counts every unit', () => {
    const view = CartService.prototype.toView([
      line({}),
      line({ id: 'l2', quantity: 3, lineTotal: 2700, available: false }),
      line({ id: 'l3', quantity: 1, unitPrice: 0.1, lineTotal: 0.1 }),
      line({ id: 'l4', quantity: 1, unitPrice: 0.2, lineTotal: 0.2 }),
    ]);
    expect(view).toMatchObject({
      itemCount: 7,
      subtotal: 1280.3, // no floating-point drift
      currency: 'BDT',
    });
  });
});
