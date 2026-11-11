import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from 'src/auth/decorators/public.decorator';
import { OPTIONAL_AUTH_KEY } from 'src/auth/decorators/optional-auth.decorator';

const ctx = {
  getHandler: () => null,
  getClass: () => null,
} as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  const flags: Record<string, boolean | undefined> = {};
  const reflector = {
    getAllAndOverride: (key: string) => flags[key],
  } as unknown as Reflector;
  const guard = new JwtAuthGuard(reflector);
  // the passport check the guard delegates to
  const passport = jest.spyOn(
    Object.getPrototypeOf(JwtAuthGuard.prototype) as InstanceType<
      ReturnType<typeof AuthGuard>
    >,
    'canActivate',
  );

  beforeEach(() => {
    passport.mockReset();
    delete flags[IS_PUBLIC_KEY];
    delete flags[OPTIONAL_AUTH_KEY];
  });

  it('protected routes need a valid session', async () => {
    passport.mockRejectedValue(new UnauthorizedException());
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('@Public() routes skip authentication entirely', async () => {
    flags[IS_PUBLIC_KEY] = true;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(passport).not.toHaveBeenCalled();
  });

  it('@OptionalAuth() tries the session but never blocks', async () => {
    flags[IS_PUBLIC_KEY] = true;
    flags[OPTIONAL_AUTH_KEY] = true;
    passport.mockRejectedValue(new UnauthorizedException());
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(passport).toHaveBeenCalledTimes(1);
  });
});
