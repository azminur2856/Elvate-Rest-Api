import { NotFoundException } from '@nestjs/common';
import * as dotenv from 'dotenv';

dotenv.config();

export interface SmsConfig {
  smsSenderId: string;
  smsApiKey: string;
  smsApiUrl: string;
}

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new NotFoundException(`Missing environment variable: ${key}`);
  }
  return value;
}

export default (): SmsConfig => ({
  smsSenderId: getEnv('SMS_SENDER_ID'),
  smsApiKey: getEnv('SMS_API_KEY'),
  smsApiUrl: getEnv('SMS_API_URL'),
});
