/**
 * SEC-19: no default password in code. The demo rider / staff accounts get
 * SEED_DEMO_PASSWORD; without a usable one the seed writes nothing.
 * (Its own file so tests can import it without running the seed.)
 */
export function demoPasswordProblem(value: string | undefined): string | null {
  if (!value) return 'SEED_DEMO_PASSWORD is not set';
  if (value.length < 8 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'SEED_DEMO_PASSWORD must have at least 8 characters with letters and numbers';
  }
  return null;
}
