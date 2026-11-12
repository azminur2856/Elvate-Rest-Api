import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService, INVALID_LOGIN, RESET_SENT } from './auth.service';
import { VerificationMethod } from './enums/verification-method.enum';

// SEC-12: replies must not tell which e-mails have accounts.
describe('account enumeration', () => {
  const users = { findByEmail: jest.fn() };
  const attempts = {
    assertNotLocked: jest.fn(),
    recordFailure: jest.fn(),
    clear: jest.fn(),
  };
  const mail = { sendPasswordResetEmail: jest.fn() };
  const sms = { sendOtp: jest.fn() };
  const verifications = {
    update: jest.fn(),
    create: jest.fn((v: unknown) => v),
    save: jest.fn(),
  };
  const service = new AuthService(
    { createActivityLog: jest.fn() } as never,
    users as never,
    sms as never,
    mail as never,
    {} as never,
    {} as never,
    verifications as never,
    {} as never,
    attempts as never,
    { assertSmsEnabled: jest.fn() } as never,
  );
  const account = (over: Record<string, unknown> = {}) => ({
    id: 'u1',
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.co',
    phone: '01700000000',
    isActive: true,
    isEmailVerified: true,
    isPhoneVerified: true,
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    attempts.assertNotLocked.mockResolvedValue(undefined);
    mail.sendPasswordResetEmail.mockResolvedValue({
      accepted: ['a@b.co'],
      rejected: [],
    });
    sms.sendOtp.mockResolvedValue({ success: true });
  });

  describe('login', () => {
    it('unknown e-mail and wrong password give the same 401', async () => {
      users.findByEmail.mockResolvedValueOnce(null);
      const unknown = await service
        .validateUser('x@y.co', 'whatever')
        .catch((e: UnauthorizedException) => e.message);
      users.findByEmail.mockResolvedValueOnce(
        account({ password: await bcrypt.hash('right', 4) }),
      );
      const wrong = await service
        .validateUser('a@b.co', 'wrong')
        .catch((e: UnauthorizedException) => e.message);
      expect(unknown).toBe(INVALID_LOGIN);
      expect(wrong).toBe(INVALID_LOGIN);
    });
  });

  describe('forgotPassword', () => {
    const generic = { message: RESET_SENT };

    it.each([
      ['unknown e-mail', null],
      ['blocked account', account({ isActive: false })],
      ['unverified e-mail', account({ isEmailVerified: false })],
    ])('%s: generic answer, nothing sent', async (_l, user) => {
      users.findByEmail.mockResolvedValueOnce(user);
      await expect(
        service.forgotPassword({
          email: 'a@b.co',
          verificationMethod: VerificationMethod.EMAIL,
        }),
      ).resolves.toEqual(generic);
      expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it.each([
      ['no phone', account({ phone: null })],
      ['unverified phone', account({ isPhoneVerified: false })],
    ])('SMS with %s: generic answer, nothing sent', async (_l, user) => {
      users.findByEmail.mockResolvedValueOnce(user);
      await expect(
        service.forgotPassword({
          email: 'a@b.co',
          verificationMethod: VerificationMethod.SMS,
        }),
      ).resolves.toEqual(generic);
      expect(sms.sendOtp).not.toHaveBeenCalled();
    });

    it('a real account gets the same answer, and the e-mail is sent', async () => {
      users.findByEmail.mockResolvedValueOnce(account());
      await expect(
        service.forgotPassword({
          email: 'a@b.co',
          verificationMethod: VerificationMethod.EMAIL,
        }),
      ).resolves.toEqual(generic);
      expect(mail.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('a failed send is not revealed either', async () => {
      users.findByEmail.mockResolvedValueOnce(account());
      mail.sendPasswordResetEmail.mockResolvedValueOnce({
        accepted: [],
        rejected: ['a@b.co'],
      });
      await expect(
        service.forgotPassword({
          email: 'a@b.co',
          verificationMethod: VerificationMethod.EMAIL,
        }),
      ).resolves.toEqual(generic);
    });
  });
});
