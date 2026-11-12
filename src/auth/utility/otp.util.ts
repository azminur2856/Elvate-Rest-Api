import { randomInt } from 'crypto';

/**
 * 6-digit SMS code (100000-999999) from a cryptographically secure source
 * (SEC-05). Math.random() codes can be predicted from earlier ones.
 */
export const generateOtp = (): string => randomInt(100000, 1000000).toString();
