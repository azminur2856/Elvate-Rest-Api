/**
 * e2e tests boot the real app, and the app runs TypeORM `synchronize`, so they
 * must never point at production. They only run against E2E_DATABASE_URL.
 *   E2E_DATABASE_URL=<disposable or dev branch> npm run test:e2e
 */
const url = process.env.E2E_DATABASE_URL;
if (!url) {
  throw new Error(
    'Set E2E_DATABASE_URL to a disposable / development database (never production): ' +
      'the e2e tests boot the app, which syncs the schema and writes data.',
  );
}
process.env.DATABASE_URL = url; // dotenv never overrides an existing variable
process.env.SWAGGER_ENABLED = 'false';
