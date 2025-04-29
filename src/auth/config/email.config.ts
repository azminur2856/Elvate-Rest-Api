import { NotFoundException } from '@nestjs/common';

export interface EmailConfig {
  emailHost: string;
  emailPort: number;
  emailSender: string;
  emailPassword: string;
}

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new NotFoundException(`Missing environment variable: ${key}`);
  }
  return value;
}

export default (): EmailConfig => ({
  emailHost: getEnv('EMAIL_HOST'),
  emailPort: parseInt(getEnv('EMAIL_PORT'), 10),
  emailSender: getEnv('EMAIL_SENDER'),
  emailPassword: getEnv('EMAIL_PASSWORD'),
});
