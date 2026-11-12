import { HttpStatus } from '@nestjs/common';
import {
  LOGIN_POLICY,
  LoginAttemptsService,
  TooManyAttemptsException,
  emailKey,
} from './login-attempts.service';

// SEC-04 / SEC-06. The SQL itself was checked against the dev database.
describe('LoginAttemptsService', () => {
  const repo = {
    find: jest.fn(),
    query: jest.fn(),
    delete: jest.fn(),
  };
  const service = new LoginAttemptsService(repo as never);
  const keys = [emailKey('face-email', '  Buyer@Elvate.TEST ')];

  beforeEach(() => jest.clearAllMocks());

  it('normalises e-mail keys', () => {
    expect(keys[0]).toEqual({ scope: 'face-email', key: 'buyer@elvate.test' });
  });

  it('lets unlocked keys through', async () => {
    repo.find.mockResolvedValueOnce([]);
    await expect(service.assertNotLocked(keys)).resolves.toBeUndefined();
  });

  it('answers 429 with the minutes left while a key is locked', async () => {
    repo.find.mockResolvedValueOnce([
      { lockedUntil: new Date(Date.now() + 15 * 60_000) },
    ]);
    const err = (await service
      .assertNotLocked(keys, 'face sign-in')
      .catch((e: unknown) => e)) as TooManyAttemptsException;
    expect(err).toBeInstanceOf(TooManyAttemptsException);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(err.getResponse()).toMatchObject({
      message:
        'Too many failed face sign-in attempts. Try again in 15 minutes.',
      retryAfterSeconds: expect.any(Number) as number,
    });
  });

  it('locks a key when the failure count reaches the policy', async () => {
    repo.query
      .mockResolvedValueOnce([{ failures: LOGIN_POLICY.maxFailures }]) // upsert
      .mockResolvedValueOnce([]); // lock update
    await expect(service.recordFailure(keys)).resolves.toBe(true);
    expect(repo.query).toHaveBeenCalledTimes(2);
    expect(repo.query.mock.calls[1][0]).toContain('"lockedUntil"');
  });

  it('only counts below the policy', async () => {
    repo.query.mockResolvedValueOnce([{ failures: 2 }]);
    await expect(service.recordFailure(keys)).resolves.toBe(false);
    expect(repo.query).toHaveBeenCalledTimes(1);
  });

  it('clear() forgets the given keys', async () => {
    await service.clear(keys);
    expect(repo.delete).toHaveBeenCalledWith({
      scope: 'face-email',
      key: expect.objectContaining({ _value: ['buyer@elvate.test'] }) as object,
    });
  });
});
