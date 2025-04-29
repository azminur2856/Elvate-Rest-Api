import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../users/enums/roles.enum';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // No roles required means open to all authenticated users
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    
    const { user } = context.switchToHttp().getRequest();
    
    // Make sure user exists and has roles
    if (!user || !user.roles || user.roles.length === 0) {
      throw new ForbiddenException('User has no roles');
    }
    
    // Check if user has any of the required roles
    const userRoles = user.roles.map(role => role.name);
    const hasRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      throw new ForbiddenException(
        `User doesn't have sufficient permissions. Required roles: ${requiredRoles.join(', ')}`
      );
    }
    
    return true;
  }
}