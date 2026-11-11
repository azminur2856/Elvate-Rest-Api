import { randomBytes } from 'crypto';

/**
 * Secure 64-character URL-safe token (same alphabet as nanoid: A-Z a-z 0-9 _ -).
 * Uses node:crypto instead of nanoid, whose v5 is ESM-only and cannot be
 * loaded by Jest.
 */
export const generateVerificationToken = (): string => {
  return randomBytes(48).toString('base64url');
};
