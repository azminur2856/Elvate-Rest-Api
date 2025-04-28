import { SetMetadata } from '@nestjs/common';
import { Role } from '../../users/enums/roles.enum';

/**
 * Metadata key for storing roles in route handlers.
 * @constant
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator for specifying required roles for route handlers.
 * @function Roles
 * @description Sets role-based access control metadata for route handlers.
 * @param {...Role} roles - The roles required to access the route
 * @returns {Function} A decorator function that sets the roles metadata
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
