import { hasUsablePassword } from './account.service';

describe('hasUsablePassword (drives hasPassword + delete-account confirmation)', () => {
  it('is true for a bcrypt hash', () => {
    expect(
      hasUsablePassword(
        '$2b$10$abcdefghijklmnopqrstuuJ8m0Yb1qQx3jxGvLW7m1tq9vQ2o4bG',
      ),
    ).toBe(true);
  });

  it('is false for Google-only sign-ups (empty password) and anything else', () => {
    expect(hasUsablePassword('')).toBe(false);
    expect(hasUsablePassword(null)).toBe(false);
    expect(hasUsablePassword('plain-text')).toBe(false);
  });
});
