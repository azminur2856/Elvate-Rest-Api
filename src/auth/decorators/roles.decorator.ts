import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension, ApiForbiddenResponse } from '@nestjs/swagger';
import { Role } from 'src/users/enums/role.enum';

export const ROLES_KEY = 'roles';

/** Only these roles may call the route; also documented in the OpenAPI docs. */
export const Roles = (...roles: [Role, ...Role[]]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    ApiExtension('x-roles', roles),
    ApiForbiddenResponse({
      description: `Requires role: ${roles.join(' or ')}`,
    }),
  );
