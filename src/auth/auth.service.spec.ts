import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { SmsService } from './services/sms.service';
import { MailService } from './services/mail.services';
import refreshJwtConfig from './config/refresh-jwt.config';
import { Verification } from './entities/verification.entity';
import { UserSession } from './entities/user-session.entity';
import { VerificationMethod } from './enums/verification-method.enum';
import { LoginAttemptsService } from './attempts/login-attempts.service';
import { SettingsService } from 'src/settings/settings.service';

// SEC-01: POST /auth/forgotPassword is public. Its reply must never carry the
// reset token or the SMS code, or anyone who knows an e-mail address could
// reset that account's password (hotfix 6e353b2).
describe('AuthService.forgotPassword never returns the secret', () => {
  let service: AuthService;
  const saved: { tokenOrOtp?: string }[] = [];
  const user = {
    id: 'u1',
    firstName: 'Test',
    lastName: 'Buyer',
    email: 'buyer@elvate.test',
    phone: '01700000001',
    isEmailVerified: true,
    isPhoneVerified: true,
  };
  const mailService = {
    sendPasswordResetEmail: jest
      .fn()
      .mockResolvedValue({ accepted: [user.email], rejected: [] }),
  };
  const smsService = {
    sendOtp: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    saved.length = 0;
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findByEmail: () => user } },
        {
          provide: ActivityLogsService,
          useValue: { createActivityLog: jest.fn() },
        },
        { provide: SmsService, useValue: smsService },
        { provide: MailService, useValue: mailService },
        { provide: JwtService, useValue: {} },
        { provide: refreshJwtConfig.KEY, useValue: {} },
        {
          provide: getRepositoryToken(Verification),
          useValue: {
            update: jest.fn(),
            create: (v: { tokenOrOtp?: string }) => v,
            save: (v: { tokenOrOtp?: string }) => {
              saved.push(v);
              return Promise.resolve(v);
            },
          },
        },
        { provide: getRepositoryToken(UserSession), useValue: {} },
        { provide: LoginAttemptsService, useValue: {} },
        {
          provide: SettingsService,
          useValue: { assertSmsEnabled: () => Promise.resolve() },
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('e-mail: the token goes into the e-mail, not into the reply', async () => {
    const reply = await service.forgotPassword({
      email: user.email,
      verificationMethod: VerificationMethod.EMAIL,
    });
    const token = saved[0]?.tokenOrOtp;
    expect(token).toBeTruthy();
    expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      user.email,
      expect.any(String),
      token,
    );
    expect(reply).not.toHaveProperty('resetToken');
    expect(JSON.stringify(reply)).not.toContain(token);
  });

  it('SMS: the code goes into the SMS, not into the reply', async () => {
    const reply = await service.forgotPassword({
      email: user.email,
      verificationMethod: VerificationMethod.SMS,
    });
    const otp = saved[0]?.tokenOrOtp;
    expect(otp).toBeTruthy();
    expect(smsService.sendOtp).toHaveBeenCalledWith(
      user.phone,
      expect.any(String),
      otp,
    );
    expect(JSON.stringify(reply)).not.toContain(otp);
  });
});
