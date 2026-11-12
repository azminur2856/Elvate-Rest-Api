import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PASSWORD_PATTERN } from 'src/common/password';

// SEC-21: password strength and refresh-token reuse.
describe('password rule', () => {
  it.each(['Abcdef12', 'pass word 9', 'x1x1x1x1', 'Ünïcode9x'])(
    'accepts %p',
    (p) => expect(PASSWORD_PATTERN.test(p)).toBe(true),
  );
  it.each(['short1', 'password', '12345678', '', `a1${'x'.repeat(71)}`])(
    'refuses %p',
    (p) => expect(PASSWORD_PATTERN.test(p)).toBe(false),
  );

  it('the change-password DTO uses it (one message)', async () => {
    const errors = await validate(
      plainToInstance(ChangePasswordDto, {
        oldPassword: 'whatever',
        newPassword: 'weak',
      }),
    );
    expect(errors.map((e) => e.property)).toEqual(['newPassword']);
    expect(Object.values(errors[0].constraints ?? {})).toHaveLength(1);
  });
});

describe('refresh-token reuse', () => {
  const sessions = { findOne: jest.fn(), delete: jest.fn() };
  const logs = { createActivityLog: jest.fn() };
  const service = new AuthService(
    logs as never,
    {
      findOne: jest.fn().mockResolvedValue({ id: 'u1', isActive: true }),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    sessions as never,
    {} as never,
    {} as never,
  );
  let current: string;
  let previous: string;

  beforeAll(async () => {
    current = await argon2.hash('token-new');
    previous = await argon2.hash('token-old');
  });
  beforeEach(() => jest.clearAllMocks());

  const session = (rotatedAgoMs: number) => ({
    id: 's1',
    expiresAt: new Date(Date.now() + 3600_000),
    hashedRefreshToken: current,
    previousRefreshHash: previous,
    rotatedAt: new Date(Date.now() - rotatedAgoMs),
  });

  it('the current token passes', async () => {
    sessions.findOne.mockResolvedValueOnce(session(1000));
    await expect(
      service.validateRefreshToken('u1', 's1', 'token-new'),
    ).resolves.toEqual({ id: 'u1', sid: 's1' });
  });

  it('the just-replaced token (two tabs) is refused but the session stays', async () => {
    sessions.findOne.mockResolvedValueOnce(session(2000));
    await expect(
      service.validateRefreshToken('u1', 's1', 'token-old'),
    ).rejects.toThrow('Session was just refreshed, please retry');
    expect(sessions.delete).not.toHaveBeenCalled();
  });

  it('an old token replayed later ends the session', async () => {
    sessions.findOne.mockResolvedValueOnce(session(60_000));
    await expect(
      service.validateRefreshToken('u1', 's1', 'token-old'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.delete).toHaveBeenCalledWith({ id: 's1' });
    expect(logs.createActivityLog).toHaveBeenCalled();
  });

  it('a token that never belonged to the session ends it too', async () => {
    sessions.findOne.mockResolvedValueOnce(session(1000));
    await expect(
      service.validateRefreshToken('u1', 's1', 'forged'),
    ).rejects.toThrow('Session ended for security reasons');
    expect(sessions.delete).toHaveBeenCalledWith({ id: 's1' });
  });
});
