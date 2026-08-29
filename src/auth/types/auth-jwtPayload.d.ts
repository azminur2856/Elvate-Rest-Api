export type AuthJwtPayload = {
  /** user id */
  sub: string;
  /** session id (user_sessions.id) — one per login/device */
  sid?: string;
};
