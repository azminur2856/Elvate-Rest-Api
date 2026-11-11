import { clientIp, throttlerTracker } from './rate-limit';

describe('rate-limit tracker', () => {
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
    expect(throttlerTracker({ user: { id: 'u1' }, ip: '::1' })).toBe('user:u1');
    expect(throttlerTracker({ headers: {}, ip: '::1' })).toBe('ip:::1');
  });
});
