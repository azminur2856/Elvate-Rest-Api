import { demoPasswordProblem } from './demo-password';

// SEC-19: the seed needs an explicit, non-trivial demo password.
describe('demoPasswordProblem', () => {
  it('refuses a missing or empty password', () => {
    expect(demoPasswordProblem(undefined)).toMatch(/not set/);
    expect(demoPasswordProblem('')).toMatch(/not set/);
  });

  it.each(['short1', 'onlyletters', '12345678'])(
    'refuses the weak password %p',
    (p) => {
      expect(demoPasswordProblem(p)).toMatch(/at least 8 characters/);
    },
  );

  it('accepts 8+ characters with letters and numbers', () => {
    expect(demoPasswordProblem('Rider2026!')).toBeNull();
  });
});
