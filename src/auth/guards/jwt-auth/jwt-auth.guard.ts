import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from 'src/auth/decorators/public.decorator';
import { OPTIONAL_AUTH_KEY } from 'src/auth/decorators/optional-auth.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );
    if (!isPublic) {
      return (await super.canActivate(context)) as boolean;
    }

    // @OptionalAuth(): identify the caller when the cookie is valid, but a
    // missing/expired session never blocks a public route.
    const isOptional = this.reflector.getAllAndOverride<boolean>(
      OPTIONAL_AUTH_KEY,
      targets,
    );
    if (isOptional) {
      try {
        await super.canActivate(context);
      } catch {
        // anonymous caller
      }
    }
    return true;
  }
}
