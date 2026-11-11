import { autoSku } from './admin-products.service';

describe('autoSku (<SLUG>-<SIZE>-<COLOR>)', () => {
  it('uppercases and kebab-cases every part', () => {
    expect(autoSku('test-polo-shirt', 'M', 'Navy Blue')).toBe(
      'TEST-POLO-SHIRT-M-NAVY-BLUE',
    );
  });

  it('skips missing parts and strips odd characters', () => {
    expect(autoSku('basic-tee', null, 'Off/White!')).toBe(
      'BASIC-TEE-OFF-WHITE',
    );
    expect(autoSku('socks', undefined, undefined)).toBe('SOCKS');
  });

  it('leaves room for a numeric suffix (max 72 chars before it)', () => {
    expect(autoSku('a'.repeat(100), 'XL', 'Red').length).toBeLessThanOrEqual(
      72,
    );
  });
});
