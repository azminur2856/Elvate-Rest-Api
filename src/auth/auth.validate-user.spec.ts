import { HttpException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

// SEC-06: password login is limited per account, whatever the IP.
describe('AuthService.validateUser (per-account lock)', () => {
  const users = { findByEmail: jest.fn() };
  const attempts = {
    assertNotLocked: jest.fn(),
    recordFailure: jest.fn(),
    clear: jest.fn(),
  };
  const service = new AuthService(
    {} as never, // activity logs
    users as never,
    {} as never, // sms
    {} as never, // mail
    {} as never, // jwt
    {} as never, // refresh config
    {} as never, // verification repo
    {} as never, // session repo
    attempts as never,
  );
  const key = [{ scope: 'password-email', key: 'buyer@elvate.test' }];
  let hash: string;

  beforeAll(async () => {
    hash = await bcrypt.hash('Right#123', 4);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    attempts.assertNotLocked.mockResolvedValue(undefined);
    users.findByEmail.mockResolvedValue({
      id: 'u1',
      password: hash,
      isEmailVerified: true,
      isActive: true,
    });
  });

  it('a locked account is refused before the password is checked', async () => {
    attempts.assertNotLocked.mockRejectedValueOnce(new HttpException('x', 429));
    await expect(
      service.validateUser('Buyer@Elvate.test', 'Right#123'),
    ).rejects.toBeInstanceOf(HttpException);
    expect(attempts.assertNotLocked).toHaveBeenCalledWith(key);
    expect(users.findByEmail).not.toHaveBeenCalled();
  });

  it('a wrong password counts a failure', async () => {
    await expect(
      service.validateUser('buyer@elvate.test', 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(attempts.recordFailure).toHaveBeenCalledWith(key);
    expect(attempts.clear).not.toHaveBeenCalled();
  });

  it('an unknown e-mail counts too', async () => {
    users.findByEmail.mockResolvedValueOnce(null);
    await expect(
      service.validateUser('buyer@elvate.test', 'x'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(attempts.recordFailure).toHaveBeenCalledWith(key);
  });

  it('the right password clears the counter', async () => {
    await expect(
      service.validateUser('buyer@elvate.test', 'Right#123'),
    ).resolves.toEqual({ id: 'u1' });
    expect(attempts.clear).toHaveBeenCalledWith(key);
    expect(attempts.recordFailure).not.toHaveBeenCalled();
  });
});
