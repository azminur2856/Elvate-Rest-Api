import { BadRequestException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { Verification } from '../entities/verification.entity';
import { VerificationType } from '../enums/verification-type.enum';

/** SEC-05: wrong guesses allowed per SMS code before it is voided. */
export const MAX_CODE_ATTEMPTS = 5;

/** One answer for unknown account, no code, expired or wrong code. */
export const WRONG_CODE = 'The code is wrong or has expired.';
export const TOO_MANY_WRONG_CODES = 'Too many wrong codes. Request a new code.';

const sameCode = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Checks `code` against the user's **latest unused** code of this type and
 * marks it used. A wrong guess counts against that code (atomic increment);
 * the 5th wrong guess voids it. Every failure is a 400, so callers cannot
 * tell "no code" from "wrong code".
 */
export async function useSmsCode(
  repo: Repository<Verification>,
  userId: string | undefined,
  type: VerificationType,
  code: string,
): Promise<Verification> {
  const latest = userId
    ? await repo.findOne({
        where: { userId, type, isUsed: false },
        order: { createdAt: 'DESC' },
        relations: ['user'],
      })
    : null;
  if (!latest || latest.expiresAt < new Date()) {
    throw new BadRequestException(WRONG_CODE);
  }

  if (!sameCode(latest.tokenOrOtp, code.trim())) {
    const rows: [{ attempts: number }[], number] = await repo.query(
      `UPDATE verification SET attempts = attempts + 1,
              "isUsed" = (attempts + 1 >= $2)
        WHERE id = $1 RETURNING attempts`,
      [latest.id, MAX_CODE_ATTEMPTS],
    );
    const attempts = rows[0]?.[0]?.attempts ?? MAX_CODE_ATTEMPTS;
    throw new BadRequestException(
      attempts >= MAX_CODE_ATTEMPTS ? TOO_MANY_WRONG_CODES : WRONG_CODE,
    );
  }

  // mark used only if nobody else used it in the meantime
  const used: [unknown[], number] = await repo.query(
    `UPDATE verification SET "isUsed" = true
      WHERE id = $1 AND "isUsed" = false RETURNING id`,
    [latest.id],
  );
  if (!used[0]?.length) throw new BadRequestException(WRONG_CODE);
  latest.isUsed = true;
  return latest;
}
