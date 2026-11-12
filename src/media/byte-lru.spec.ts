import { ByteLru } from './byte-lru';

const img = (bytes: number) => ({ body: Buffer.alloc(bytes) });

describe('ByteLru (BE-28 avatar cache)', () => {
  it('returns what was stored until it expires', () => {
    const lru = new ByteLru(100, 1_000);
    lru.set('a', img(10), 0);
    expect(lru.get('a', 999)?.body.length).toBe(10);
    expect(lru.get('a', 1_000)).toBeUndefined();
    expect(lru.size).toBe(0);
    expect(lru.totalBytes).toBe(0);
  });

  it('evicts the least recently used entries over the byte budget', () => {
    const lru = new ByteLru(30, 60_000);
    lru.set('a', img(10), 0);
    lru.set('b', img(10), 0);
    lru.set('c', img(10), 0);
    lru.get('a', 1); // a is now the most recent
    lru.set('d', img(10), 2); // over budget: b goes
    expect(lru.get('b', 3)).toBeUndefined();
    expect(lru.get('a', 3)).toBeDefined();
    expect(lru.get('c', 3)).toBeDefined();
    expect(lru.get('d', 3)).toBeDefined();
    expect(lru.totalBytes).toBe(30);
  });

  it('replacing a key counts its bytes once', () => {
    const lru = new ByteLru(100, 60_000);
    lru.set('a', img(40), 0);
    lru.set('a', img(25), 0);
    expect(lru.size).toBe(1);
    expect(lru.totalBytes).toBe(25);
  });

  it('never stores an item larger than the whole budget', () => {
    const lru = new ByteLru(16, 60_000);
    lru.set('big', img(17), 0);
    expect(lru.size).toBe(0);
    expect(lru.totalBytes).toBe(0);
  });
});
