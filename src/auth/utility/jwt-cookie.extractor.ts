import { Request } from 'express';

export const accessTokenFromSessionCookie = (req: Request): string | null => {
  return req['accessToken'] || null;
};

export const refreshTokenFromSessionCookie = (req: Request): string | null => {
  return req['refreshToken'] || null;
};
