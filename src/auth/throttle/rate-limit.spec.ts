import {
  PROXY_CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
  clientIp,
  throttlerTracker,
} from './rate-limit';

// SEC-06: who decides which address a request is counted against.
describe('clientIp', () => {
  const saved = process.env.PROXY_SHARED_SECRET;
  afterEach(() => {
    process.env.PROXY_SHARED_SECRET = saved;
  });
  const req = (headers: Record<string, string> = {}) => ({
    ip: '203.0.113.9', // what connected to Render (trust proxy = 1)
    headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.9', ...headers },
  });

  describe('with PROXY_SHARED_SECRET', () => {
    beforeEach(() => {
      process.env.PROXY_SHARED_SECRET = 'a-long-shared-secret';
    });

    it('ignores a forged X-Forwarded-For from a direct caller', () => {
      expect(clientIp(req())).toBe('203.0.113.9');
    });

    it("uses the frontend proxy's client IP when the secret matches", () => {
      expect(
        clientIp(
          req({
            [PROXY_SECRET_HEADER]: 'a-long-shared-secret',
            [PROXY_CLIENT_IP_HEADER]: '198.51.100.7',
          }),
        ),
      ).toBe('198.51.100.7');
      expect(
        clientIp(
          req({
            [PROXY_SECRET_HEADER]: 'a-long-shared-secret',
            [PROXY_CLIENT_IP_HEADER]: '2001:db8::1',
          }),
        ),
      ).toBe('2001:db8::1');
    });

    it('falls back to the connecting address for a wrong secret or a non-IP', () => {
      expect(
        clientIp(
          req({
            [PROXY_SECRET_HEADER]: 'guess',
            [PROXY_CLIENT_IP_HEADER]: '1.1.1.1',
          }),
        ),
      ).toBe('203.0.113.9');
      expect(
        clientIp(
          req({
            [PROXY_SECRET_HEADER]: 'a-long-shared-secret',
            [PROXY_CLIENT_IP_HEADER]: 'not-an-ip',
          }),
        ),
      ).toBe('203.0.113.9');
    });
  });

  describe('without PROXY_SHARED_SECRET (old behaviour, B-09)', () => {
    beforeEach(() => {
      delete process.env.PROXY_SHARED_SECRET;
    });

    it('uses the left-most X-Forwarded-For entry (client behind Vercel + Render)', () => {
      expect(
        clientIp({
          headers: { 'x-forwarded-for': '203.0.113.7, 76.76.21.1' },
          ip: '10.0.0.1',
        }),
      ).toBe('203.0.113.7');
    });

    it('falls back to req.ip without the header', () => {
      expect(clientIp({ headers: {}, ip: '::1' })).toBe('::1');
    });

    it('counts per user when logged in, else per client IP', () => {
      expect(throttlerTracker({ user: { id: 'u1' }, ip: '::1' })).toBe(
        'user:u1',
      );
      expect(throttlerTracker({ headers: {}, ip: '::1' })).toBe('ip:::1');
    });
  });
});
