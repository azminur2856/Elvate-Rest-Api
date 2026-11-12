import { IsString, Matches } from 'class-validator';
import { applyDecorators } from '@nestjs/common';

/** SEC-21: shown on sign-up, change and reset. */
export const PASSWORD_RULE =
  'Password must be 8 to 72 characters long and contain letters and numbers.';

/** 8-72 characters (bcrypt ignores bytes past 72), a letter and a digit. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/s;

/** Google-only sign-ups are stored with an empty password (no bcrypt hash). */
export const hasUsablePassword = (hash: string | null | undefined) =>
  !!hash && /^\$2[aby]\$/.test(hash);

/** Property decorator for every field that sets a new password. */
export const NewPassword = () =>
  applyDecorators(
    IsString({ message: PASSWORD_RULE }),
    Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE }),
  );
