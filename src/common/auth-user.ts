import { Role } from 'src/users/enums/role.enum';

/** What JwtStrategy puts on `req.user` (AuthService.validateJwtUser). */
export type AuthUser = { id: string; role: Role; sid?: string };

export type AuthRequest = { user: AuthUser };

/** For activity-log descriptions: "STAFF 1a2b…" / "ADMIN 3c4d…". */
export const actorLabel = (user: AuthUser) => `${user.role} ${user.id}`;
