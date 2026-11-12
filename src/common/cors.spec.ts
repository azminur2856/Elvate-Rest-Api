import { corsOrigins } from './cors';
import { swaggerEnabled } from 'src/swagger';

// SEC-20: production configuration.
describe('corsOrigins', () => {
  it('production: only the frontend origin (trailing slash trimmed)', () => {
    expect(
      corsOrigins({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://elvate.vercel.app/',
      }),
    ).toEqual(['https://elvate.vercel.app']);
  });

  it('development: the frontend plus localhost:3000, once', () => {
    expect(corsOrigins({ FRONTEND_URL: 'https://preview.example' })).toEqual([
      'https://preview.example',
      'http://localhost:3000',
    ]);
    expect(corsOrigins({ FRONTEND_URL: 'http://localhost:3000/' })).toEqual([
      'http://localhost:3000',
    ]);
  });

  it('production without FRONTEND_URL allows no origin at all', () => {
    expect(corsOrigins({ NODE_ENV: 'production' })).toEqual([]);
  });
});

describe('swaggerEnabled', () => {
  it('is off in production unless SWAGGER_ENABLED=true', () => {
    expect(swaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(
      swaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }),
    ).toBe(true);
    expect(swaggerEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(
      swaggerEnabled({ NODE_ENV: 'development', SWAGGER_ENABLED: 'false' }),
    ).toBe(false);
  });
});
