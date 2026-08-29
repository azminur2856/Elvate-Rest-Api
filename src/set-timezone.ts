/**
 * Pin the Node process to UTC — imported FIRST in main.ts so it runs before
 * TypeORM / node-pg are loaded.
 *
 * Why: the entities use `timestamp` (without time zone) columns. node-pg
 * serialises a JS Date into that type using the process's LOCAL wall-clock and
 * parses it back the same way. Render runs in UTC, but a developer machine in
 * Bangladesh runs at UTC+6, so a `lastLogoutAt` written locally was read by
 * Render as six hours in the future and every access token was rejected
 * ("Token invalid due to logout"). Running every process in UTC makes the
 * stored wall-clock identical everywhere.
 *
 * Node applies a runtime change to process.env.TZ immediately on all platforms
 * (v13+), so this works for `nest start --watch` and `node dist/main` alike.
 */
process.env.TZ = 'UTC';

export {};
