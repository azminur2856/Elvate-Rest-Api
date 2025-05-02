import { nanoid } from 'nanoid';

export const generateVerificationToken = (): string => {
  return nanoid(64); // secure 64-character token
};
