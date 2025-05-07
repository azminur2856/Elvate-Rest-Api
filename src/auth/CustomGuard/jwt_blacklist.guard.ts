import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtWithBlacklistGuard extends AuthGuard('jwt') {
  constructor(
    private authService: AuthService,
    private reflector: Reflector, // Add Reflector for metadata access
  ) {
    super();
    console.log('AuthService:', authService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();

    if (request.method === 'GET') {
      return true;
    }

    const isNoJwtBlacklist = this.reflector.get<boolean>(
      'noJwtBlacklist',
      handler,
    );

    if (isNoJwtBlacklist) {
      // SKIP JWT GUARD COMPLETELY
      return true;
    }

    const token = this.extractTokenFromRequest(request);

    if (token && (await this.authService.isBlacklisted(token))) {
      throw new UnauthorizedException('Token is invalid, User Logged Out');
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  private extractTokenFromRequest(request: Request): string | null {
    const authHeader = request.headers['authorization'];
    if (!authHeader) return null;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
