import { ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { VerificationMethod } from './enums/verification-method.enum';
import { SMS_TURNED_OFF } from 'src/settings/settings.service';

// BE-25: while the admin switch is OFF, every SMS route is a 403.
describe('AuthService SMS routes and the admin switch', () => {
  const users = { findOne: jest.fn(), findByEmail: jest.fn() };
  const verifications = { findOne: jest.fn() };
  const settings = { assertSmsEnabled: jest.fn() };
  const service = new AuthService(
    {} as never,
    users as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    verifications as never,
    {} as never,
    {} as never,
    settings as never,
  );
  const off = () =>
    settings.assertSmsEnabled.mockRejectedValue(
      new ForbiddenException(SMS_TURNED_OFF),
    );
  const sms = {
    phoneOtp: () => service.phoneVerification('u1'),
    verifyPhone: () => service.verifyPhone('u1', { otp: '123456' }),
    forgotSms: () =>
      service.forgotPassword({
        email: 'a@b.co',
        verificationMethod: VerificationMethod.SMS,
      }),
    resetSms: () =>
      service.resetPassword({
        resetTokenOrOTP: '123456',
        newPassword: 'x',
        verificationMethod: VerificationMethod.SMS,
        email: 'a@b.co',
      }),
  };

  beforeEach(() => jest.clearAllMocks());

  it.each(Object.keys(sms))('OFF: %s is 403 and touches nothing', async (k) => {
    off();
    await expect(sms[k as keyof typeof sms]()).rejects.toThrow(
      new ForbiddenException(SMS_TURNED_OFF),
    );
    expect(users.findOne).not.toHaveBeenCalled();
    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(verifications.findOne).not.toHaveBeenCalled();
  });

  it.each(Object.keys(sms))('ON: %s goes past the switch', async (k) => {
    settings.assertSmsEnabled.mockResolvedValue(undefined);
    users.findOne.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    verifications.findOne.mockResolvedValue(null);
    // the user/code lookups now fail normally, but not with the 403
    await expect(sms[k as keyof typeof sms]()).rejects.not.toThrow(
      SMS_TURNED_OFF,
    );
    expect(settings.assertSmsEnabled).toHaveBeenCalled();
  });

  it('e-mail flows never ask the switch', async () => {
    off();
    users.findByEmail.mockResolvedValue(null);
    await expect(
      service.forgotPassword({ email: 'a@b.co' }),
    ).rejects.not.toThrow(SMS_TURNED_OFF);
    verifications.findOne.mockResolvedValue(null);
    await expect(
      service.resetPassword({ resetTokenOrOTP: 't', newPassword: 'x' }),
    ).rejects.not.toThrow(SMS_TURNED_OFF);
    expect(settings.assertSmsEnabled).not.toHaveBeenCalled();
  });
});
