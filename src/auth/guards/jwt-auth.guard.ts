import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

/**
 * JWT Authentication Guard.
 * @class JwtAuthGuard
 * @description Extends Passport's AuthGuard to implement JWT-based authentication.
 * Protects routes by requiring a valid JWT token in the request.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check for public route metadata
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Continue with JWT validation
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    // You can throw custom exceptions based on different scenarios
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid token or token expired');
    }
    return user;
  }
}
