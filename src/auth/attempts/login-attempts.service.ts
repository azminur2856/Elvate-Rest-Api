import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThan, Repository } from 'typeorm';
import { LoginAttempt } from './login-attempt.entity';

const MINUTE = 60_000;

export interface AttemptPolicy {
  /** Failures inside `windowMs` that trigger a lock. */
  maxFailures: number;
  windowMs: number;
  lockMs: number;
}

/** SEC-04 / SEC-06: 5 failures within 15 minutes lock the key for 15 minutes. */
export const LOGIN_POLICY: AttemptPolicy = {
  maxFailures: 5,
  windowMs: 15 * MINUTE,
  lockMs: 15 * MINUTE,
};

export interface AttemptKey {
  scope: string;
  key: string;
}

/** E-mail keys are case- and space-insensitive. */
export const emailKey = (scope: string, email: string): AttemptKey => ({
  scope,
  key: email.trim().toLowerCase(),
});

export class TooManyAttemptsException extends HttpException {
  constructor(retryAfterSeconds: number, what = 'sign-in') {
    // round, not ceil: DB and app clocks differ by a second or two
    const minutes = Math.max(1, Math.round(retryAfterSeconds / 60));
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `Too many failed ${what} attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class LoginAttemptsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LoginAttemptsService.name);

  constructor(
    @InjectRepository(LoginAttempt)
    private readonly attempts: Repository<LoginAttempt>,
  ) {}

  /** Rows untouched for a day carry no state any more. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.attempts.delete({
        updatedAt: LessThan(new Date(Date.now() - 24 * 60 * MINUTE)),
      });
    } catch (err) {
      this.logger.warn(`Could not prune login_attempts: ${String(err)}`);
    }
  }

  /** 429 when any of the keys is currently locked. */
  async assertNotLocked(keys: AttemptKey[], what?: string): Promise<void> {
    const locked = await this.attempts.find({
      where: keys.map((k) => ({
        scope: k.scope,
        key: k.key,
        lockedUntil: MoreThan(new Date()),
      })),
    });
    if (!locked.length) return;
    const until = Math.max(...locked.map((l) => l.lockedUntil!.getTime()));
    throw new TooManyAttemptsException(
      Math.ceil((until - Date.now()) / 1000),
      what,
    );
  }

  /**
   * Counts one failure for every key (atomic upsert). Returns true when this
   * failure locked at least one of them.
   */
  async recordFailure(
    keys: AttemptKey[],
    policy: AttemptPolicy = LOGIN_POLICY,
  ): Promise<boolean> {
    let lockedNow = false;
    for (const { scope, key } of keys) {
      const rows: { failures: number }[] = await this.attempts.query(
        `INSERT INTO login_attempts (scope, key, failures, "windowStart", "updatedAt")
         VALUES ($1, $2, 1, now(), now())
         ON CONFLICT (scope, key) DO UPDATE SET
           failures = CASE
             WHEN login_attempts."windowStart" < now() - $3::int * interval '1 millisecond'
             THEN 1 ELSE login_attempts.failures + 1 END,
           "windowStart" = CASE
             WHEN login_attempts."windowStart" < now() - $3::int * interval '1 millisecond'
             THEN now() ELSE login_attempts."windowStart" END,
           "updatedAt" = now()
         RETURNING failures`,
        [scope, key, policy.windowMs],
      );
      if ((rows[0]?.failures ?? 0) >= policy.maxFailures) {
        lockedNow = true;
        await this.attempts.query(
          `UPDATE login_attempts
              SET "lockedUntil" = now() + $3::int * interval '1 millisecond',
                  failures = 0, "windowStart" = now(), "updatedAt" = now()
            WHERE scope = $1 AND key = $2`,
          [scope, key, policy.lockMs],
        );
      }
    }
    return lockedNow;
  }

  /** Forget the failures of these keys (after a successful sign-in). */
  async clear(keys: AttemptKey[]): Promise<void> {
    for (const scope of new Set(keys.map((k) => k.scope))) {
      await this.attempts.delete({
        scope,
        key: In(keys.filter((k) => k.scope === scope).map((k) => k.key)),
      });
    }
  }
}
