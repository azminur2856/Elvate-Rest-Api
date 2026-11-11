import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FaceVerificationService } from './services/face-verification.service';
import { AccountService } from 'src/account/account.service';

describe('UsersController', () => {
  it('GET /users/profile adds hasPassword', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: { getUserById: jest.fn().mockResolvedValue({ id: 'u1' }) },
        },
        { provide: FaceVerificationService, useValue: {} },
        {
          provide: AccountService,
          useValue: { hasPassword: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();
    const controller = moduleRef.get(UsersController);
    await expect(
      controller.getUserProfile({ user: { id: 'u1' } }),
    ).resolves.toEqual({
      id: 'u1',
      hasPassword: false,
    });
  });
});
