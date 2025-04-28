import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from 'src/users/enums/roles.enum';

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
    if (!user || !user.roles) {
      throw new ForbiddenException('User has no roles');
    }
    
    // Check if user has any of the required roles
    const hasRole = user.roles.some(
      (userRole) => requiredRoles.includes(userRole.name)
    );
    
    if (!hasRole) {
      throw new ForbiddenException(
        `User doesn't have sufficient permissions. Required roles: ${requiredRoles.join(', ')}`
      );
    }
    
    return true;
  }
}