import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  MAX_CODE_ATTEMPTS,
  TOO_MANY_WRONG_CODES,
  WRONG_CODE,
  useSmsCode,
} from './sms-code';
import { generateOtp } from './otp.util';
import { VerificationType } from '../enums/verification-type.enum';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerificationMethod } from '../enums/verification-method.enum';

const T = VerificationType.PASSWORD_RESET_OTP;

// SEC-05: 6-digit codes only work for their own account, 5 guesses max.
describe('useSmsCode', () => {
  const repo = { findOne: jest.fn(), query: jest.fn() };
  const latest = () => ({
    id: 'v1',
    userId: 'u1',
    tokenOrOtp: '482913',
    isUsed: false,
    attempts: 0,
    expiresAt: new Date(Date.now() + 60_000),
    user: { id: 'u1' },
  });
  const run = (userId: string | undefined, code: string) =>
    useSmsCode(repo as never, userId, T, code);
  const message = (p: Promise<unknown>) =>
    p.catch((e: BadRequestException) => {
      expect(e).toBeInstanceOf(BadRequestException);
      return e.message;
    });

  beforeEach(() => jest.clearAllMocks());

  it("looks only at the account's latest unused code of that type", async () => {
    repo.findOne.mockResolvedValueOnce(latest());
    repo.query.mockResolvedValueOnce([[{ id: 'v1' }], 1]);
    await expect(run('u1', ' 482913 ')).resolves.toMatchObject({
      id: 'v1',
      isUsed: true,
    });
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { userId: 'u1', type: T, isUsed: false },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  });

  it('unknown account, no code and an expired code: the same 400', async () => {
    expect(await message(run(undefined, '482913'))).toBe(WRONG_CODE);
    expect(repo.findOne).not.toHaveBeenCalled();
    repo.findOne.mockResolvedValueOnce(null);
    expect(await message(run('u1', '482913'))).toBe(WRONG_CODE);
    repo.findOne.mockResolvedValueOnce({
      ...latest(),
      expiresAt: new Date(Date.now() - 1),
    });
    expect(await message(run('u1', '482913'))).toBe(WRONG_CODE);
  });

  it('a wrong guess is counted; the 5th voids the code', async () => {
    repo.findOne.mockResolvedValue(latest());
    repo.query.mockResolvedValueOnce([[{ attempts: 1 }], 1]);
    expect(await message(run('u1', '000000'))).toBe(WRONG_CODE);
    expect(repo.query.mock.calls[0][1]).toEqual(['v1', MAX_CODE_ATTEMPTS]);
    repo.query.mockResolvedValueOnce([[{ attempts: MAX_CODE_ATTEMPTS }], 1]);
    expect(await message(run('u1', '000000'))).toBe(TOO_MANY_WRONG_CODES);
  });

  it('a code used concurrently by another request is refused', async () => {
    repo.findOne.mockResolvedValueOnce(latest());
    repo.query.mockResolvedValueOnce([[], 0]); // nothing updated
    expect(await message(run('u1', '482913'))).toBe(WRONG_CODE);
  });
});

describe('generateOtp', () => {
  it('always gives 6 digits without a leading zero', () => {
    for (let i = 0; i < 2000; i++) {
      expect(generateOtp()).toMatch(/^[1-9]\d{5}$/);
    }
  });
});

describe('ResetPasswordDto', () => {
  const errors = async (plain: object) =>
    (await validate(plainToInstance(ResetPasswordDto, plain))).map(
      (e) => e.property,
    );

  it('requires the e-mail with SMS codes only', async () => {
    const base = { resetTokenOrOTP: '482913', newPassword: 'Valid1234' };
    expect(
      await errors({ ...base, verificationMethod: VerificationMethod.SMS }),
    ).toEqual(['email']);
    expect(
      await errors({
        ...base,
        verificationMethod: VerificationMethod.SMS,
        email: 'a@b.co',
      }),
    ).toEqual([]);
    expect(await errors(base)).toEqual([]); // e-mail link: no e-mail needed
  });
});
