import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FaceReferenceService } from 'src/face/face-reference.service';
import { AvatarService } from 'src/media/avatar.service';
import { AccountService } from 'src/account/account.service';

describe('UsersController', () => {
  it('GET /users/profile adds hasPassword', async () => {
    const moduleRef = await Test.createTestingModule({
      // @RateLimit() routes need the throttler
      imports: [
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 10 }] }),
      ],
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: { getUserById: jest.fn().mockResolvedValue({ id: 'u1' }) },
        },
        { provide: FaceReferenceService, useValue: {} },
        { provide: AvatarService, useValue: {} },
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
