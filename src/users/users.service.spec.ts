import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ValidationPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { Users } from './entities/users.entity';
import { Verification } from 'src/auth/entities/verification.entity';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { MailService } from 'src/auth/services/mail.services';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

// Regression tests for B-08: a logged-in buyer could make themselves ADMIN
// with PATCH /users/updateUser {"role":"ADMIN"} (and sign up as one), because
// the body went straight into repository.update()/create().
describe('UsersService: profile writes only touch allowed fields', () => {
  let service: UsersService;
  const userRepo = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn((u: Record<string, unknown>) => u),
    save: jest.fn((u: Record<string, unknown>) =>
      Promise.resolve({ id: 'new-id', ...u }),
    ),
  };
  const verificationRepo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(Users), useValue: userRepo },
        {
          provide: getRepositoryToken(Verification),
          useValue: verificationRepo,
        },
        {
          provide: ActivityLogsService,
          useValue: { createActivityLog: jest.fn() },
        },
        {
          provide: MailService,
          useValue: { sendRegistrationVerificationEmail: jest.fn() },
        },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('updateUser ignores role, flags and password even if they reach the service', async () => {
    userRepo.findOne.mockResolvedValueOnce({ id: 'u1', phone: null });
    await service.updateUser('u1', {
      firstName: 'New',
      role: 'ADMIN',
      isEmailVerified: true,
      password: 'plain',
    } as unknown as UpdateUserDto);
    expect(userRepo.update).toHaveBeenCalledWith('u1', { firstName: 'New' });
  });

  it('updateUser resets phone verification when the number changes', async () => {
    userRepo.findOne
      .mockResolvedValueOnce({ id: 'u1', phone: '01700000001' })
      .mockResolvedValueOnce(null); // nobody else has the new number
    await service.updateUser('u1', { phone: '01800000000' });
    expect(userRepo.update).toHaveBeenCalledWith('u1', {
      phone: '01800000000',
      isPhoneVerified: false,
    });
  });

  it('createUser never copies role or verification flags from the body', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await service.createUser({
      firstName: 'A',
      email: 'a@elvate.test',
      password: 'Test@12345',
      role: 'ADMIN',
      isActive: true,
      isEmailVerified: true,
    } as unknown as CreateUserDto);
    const created = userRepo.create.mock.calls[0][0];
    expect(created).not.toHaveProperty('role');
    expect(created).not.toHaveProperty('isActive');
    expect(created).not.toHaveProperty('isEmailVerified');
  });
});

describe('Global ValidationPipe (whitelist)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });

  it('strips fields that are not on UpdateUserDto', async () => {
    const out: unknown = await pipe.transform(
      { firstName: 'A', role: 'ADMIN', isPhoneVerified: true, password: 'x' },
      { type: 'body', metatype: UpdateUserDto },
    );
    expect(out).toEqual(Object.assign(new UpdateUserDto(), { firstName: 'A' }));
  });
});
