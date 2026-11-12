/** BE-25: every switch the admin page shows. Add new ones here. */
export const SMS_OTP = 'sms_otp';

export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  /** Value of a freshly created row. */
  defaultEnabled: boolean;
  /** False when the switch cannot work (e.g. missing credentials). */
  available: () => boolean;
}

const hasEnv = (...names: string[]) =>
  names.every((n) => !!process.env[n]?.trim());

export const SETTINGS: SettingDefinition[] = [
  {
    key: SMS_OTP,
    label: 'SMS verification (OTP)',
    description:
      'Phone verification and password reset by SMS code. Keep it off while there are no SMS credits; e-mail flows keep working.',
    defaultEnabled: false,
    available: () => hasEnv('SMS_API_URL', 'SMS_API_KEY', 'SMS_SENDER_ID'),
  },
];

export const settingDefinition = (key: string) =>
  SETTINGS.find((s) => s.key === key);
