import { Logger } from '@nestjs/common';
import {
  AppService,
  DB_CHECK_CACHE_MS,
  DB_CHECK_TIMEOUT_MS,
  deployedVersion,
} from './app.service';

// GET / : worked out per request from the visitor's address and the server settings.
describe('AppService root info', () => {
  const local = {
    NODE_ENV: 'development',
    FRONTEND_URL: 'http://localhost:3000',
  };
  const live = {
    NODE_ENV: 'production',
    SWAGGER_ENABLED: 'true',
    FRONTEND_URL: 'https://elvate.vercel.app/',
    RENDER_GIT_COMMIT: 'e835ce4f0b9a1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
  };
  let query: jest.Mock;
  let service: AppService;

  beforeEach(() => {
    jest.useRealTimers();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    service = new AppService({ isInitialized: true, query } as never);
  });
  afterEach(() => jest.useRealTimers());

  it('local: links to localhost, version "local"', async () => {
    const info = await service.info('http://localhost:8000', local);
    expect(info).toEqual({
      message: 'Welcome to ELVATE!',
      name: 'Elvate REST API',
      status: 'ok',
      database: 'ok',
      version: 'local',
      time: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/),
      docs: 'http://localhost:8000/docs',
      health: 'http://localhost:8000/healthz',
      app: 'http://localhost:3000',
    });
  });

  it('server: the deployed commit, https links, the web app address', async () => {
    const info = await service.info(
      'https://elvate-rest-api.onrender.com/',
      live,
    );
    expect(info).toMatchObject({
      version: 'e835ce4',
      docs: 'https://elvate-rest-api.onrender.com/docs',
      health: 'https://elvate-rest-api.onrender.com/healthz',
      app: 'https://elvate.vercel.app',
    });
  });

  it('no docs link while Swagger is off (production default)', async () => {
    const info = await service.info('https://api.example', {
      NODE_ENV: 'production',
    });
    expect(info).not.toHaveProperty('docs');
    expect(
      await service.info('http://localhost:8000', {
        ...local,
        SWAGGER_ENABLED: 'false',
      }),
    ).not.toHaveProperty('docs');
  });

  it('shows only these fields (nothing about the environment)', async () => {
    const info = await service.info('https://x.example', {
      ...live,
      DATABASE_URL: 'postgres://secret',
      JWT_SECRET: 'secret',
    });
    expect(Object.keys(info)).toEqual([
      'message',
      'name',
      'status',
      'database',
      'version',
      'time',
      'docs',
      'health',
      'app',
    ]);
    expect(JSON.stringify(info)).not.toContain('secret');
  });

  it('database unreachable -> degraded / down, still an answer', async () => {
    query.mockRejectedValueOnce(new Error('connection refused'));
    await expect(
      service.info('http://localhost:8000', local),
    ).resolves.toMatchObject({
      message: 'Welcome to ELVATE!',
      status: 'degraded',
      database: 'down',
    });
  });

  it('database not connected yet -> down without a query', async () => {
    service = new AppService({ isInitialized: false, query } as never);
    await expect(service.databaseUp()).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('a check slower than the timeout counts as down', async () => {
    jest.useFakeTimers();
    query.mockReturnValueOnce(new Promise(() => undefined)); // never answers
    const up = service.databaseUp();
    jest.advanceTimersByTime(DB_CHECK_TIMEOUT_MS + 1);
    await expect(up).resolves.toBe(false);
  });

  it('checks the database at most once per 30 s', async () => {
    jest.useFakeTimers();
    await service.databaseUp();
    await service.databaseUp();
    expect(query).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(DB_CHECK_CACHE_MS + 1);
    await service.databaseUp();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('requests arriving during a check share it', async () => {
    let answer: (v: unknown) => void = () => undefined;
    query.mockReturnValueOnce(new Promise((r) => (answer = r)));
    const both = Promise.all([service.databaseUp(), service.databaseUp()]);
    answer([]);
    await expect(both).resolves.toEqual([true, true]);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('deployedVersion', () => {
  it('short commit ID on Render, "local" otherwise', () => {
    expect(deployedVersion({ RENDER_GIT_COMMIT: 'A1B2C3D4E5F6' })).toBe(
      'A1B2C3D',
    );
    expect(deployedVersion({})).toBe('local');
    expect(deployedVersion({ RENDER_GIT_COMMIT: 'not a commit' })).toBe(
      'local',
    );
  });
});
