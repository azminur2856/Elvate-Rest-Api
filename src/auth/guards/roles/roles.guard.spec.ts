import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from 'src/users/enums/role.enum';

const ctx = (role?: Role) =>
  ({
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  it('lets everything through when the route has no @Roles', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(ctx(Role.BUYER))).toBe(true);
  });

  it('allows any of the listed roles (ADMIN + STAFF on shop routes)', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      Role.ADMIN,
      Role.STAFF,
    ]);
    expect(guard.canActivate(ctx(Role.STAFF))).toBe(true);
    expect(guard.canActivate(ctx(Role.ADMIN))).toBe(true);
    expect(guard.canActivate(ctx(Role.BUYER))).toBe(false);
    expect(guard.canActivate(ctx(Role.DELIVERY_MAN))).toBe(false);
  });
});
