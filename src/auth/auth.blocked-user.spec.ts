import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { Users } from 'src/users/entities/users.entity';
import { UserSession } from './entities/user-session.entity';

const BLOCKED =
  'User account is inactive or has been blocked. Please contact support for assistance.';

// SEC-07: blocking an account must end access at once.
describe('blocked accounts', () => {
  describe('AuthService', () => {
    const users = { findOne: jest.fn() };
    const sessions = { findOne: jest.fn(), delete: jest.fn() };
    const service = new AuthService(
      {} as never,
      users as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      sessions as never,
      {} as never, // login attempts
      {} as never, // settings (BE-25)
    );

    beforeEach(() => jest.clearAllMocks());

    it('every request of a blocked user is 401', async () => {
      users.findOne.mockResolvedValueOnce({ id: 'u1', isActive: false });
      await expect(
        service.validateJwtUser('u1', Date.now() / 1000, 's1'),
      ).rejects.toThrow(new UnauthorizedException(BLOCKED));
      expect(sessions.findOne).not.toHaveBeenCalled();
    });

    it('a blocked user cannot refresh, and that session is deleted', async () => {
      sessions.findOne.mockResolvedValueOnce({
        id: 's1',
        expiresAt: new Date(Date.now() + 60_000),
        hashedRefreshToken: 'irrelevant',
      });
      users.findOne.mockResolvedValueOnce({ id: 'u1', isActive: false });
      await expect(
        service.validateRefreshToken('u1', 's1', 'token'),
      ).rejects.toThrow(new UnauthorizedException(BLOCKED));
      expect(sessions.delete).toHaveBeenCalledWith({ id: 's1' });
    });
  });

  describe('UsersService.updateUserStatus', () => {
    const m = { update: jest.fn(), delete: jest.fn() };
    const userRepo = {
      findOne: jest.fn(),
      manager: {
        transaction: jest.fn((fn: (em: typeof m) => unknown) => fn(m)),
      },
    };
    const service = new UsersService(
      { createActivityLog: jest.fn() } as never, // activity logs
      userRepo as never,
      {} as never, // verification repo
      {} as never, // mail
    );

    beforeEach(() => {
      jest.clearAllMocks();
      userRepo.findOne.mockResolvedValue({ id: 'u2', role: 'BUYER' });
      m.update.mockResolvedValue({ affected: 1 });
    });

    it('blocking deletes every session and sets lastLogoutAt', async () => {
      await service.updateUserStatus('u2', false, 'admin');
      expect(m.update).toHaveBeenCalledWith(Users, 'u2', {
        isActive: false,
        lastLogoutAt: expect.any(Date) as Date,
      });
      expect(m.delete).toHaveBeenCalledWith(UserSession, { userId: 'u2' });
    });

    it('unblocking only sets isActive', async () => {
      await service.updateUserStatus('u2', true, 'admin');
      expect(m.update).toHaveBeenCalledWith(Users, 'u2', { isActive: true });
      expect(m.delete).not.toHaveBeenCalled();
    });
  });
});
