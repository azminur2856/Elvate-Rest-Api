require('dotenv').config();
import { EncryptJWT, jwtDecrypt } from 'jose';

const base64Key = process.env.COOKIES_SECRET!;
if (!base64Key) {
  throw new Error('COOKIES_SECRET environment variable is not set');
}
const secretKey = Buffer.from(base64Key, 'base64');

export async function encryptSessionCookie(payload: any): Promise<string> {
  return await new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .encrypt(secretKey);
}

export async function decryptSessionCookie(token: string): Promise<any> {
  const { payload } = await jwtDecrypt(token, secretKey);
  return payload;
}
