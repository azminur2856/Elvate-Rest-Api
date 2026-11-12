import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { FaceLoginChallenge } from './face-login-challenge.entity';
import {
  FACE_ACTION_PROMPTS,
  FACE_ACTIONS,
  FaceAction,
} from 'src/users/services/face-check';

/** How long the user has to take both photos. */
export const CHALLENGE_TTL_MS = 2 * 60_000;

export interface FaceChallenge {
  challengeId: string;
  action: FaceAction;
  prompt: string;
  expiresAt: Date;
}

@Injectable()
export class FaceLoginService {
  constructor(
    @InjectRepository(FaceLoginChallenge)
    private readonly challenges: Repository<FaceLoginChallenge>,
  ) {}

  /**
   * Step 1 of face login. Answers the same way for any e-mail, so it does not
   * reveal whether an account (or face login) exists.
   */
  async createChallenge(email: string): Promise<FaceChallenge> {
    // housekeeping: challenges are useless an hour after expiry
    await this.challenges.delete({
      expiresAt: LessThan(new Date(Date.now() - 60 * 60_000)),
    });
    const action = FACE_ACTIONS[randomInt(FACE_ACTIONS.length)];
    const row = await this.challenges.save(
      this.challenges.create({
        email: email.trim().toLowerCase(),
        action,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
        usedAt: null,
      }),
    );
    return {
      challengeId: row.id,
      action,
      prompt: FACE_ACTION_PROMPTS[action],
      expiresAt: row.expiresAt,
    };
  }

  /**
   * Marks the challenge used (atomically) and returns its action. 400 when it
   * is unknown, expired, already used or issued for another e-mail.
   */
  async consumeChallenge(
    challengeId: string,
    email: string,
  ): Promise<FaceAction> {
    const rows: [{ action: FaceAction }[], number] =
      await this.challenges.query(
        `UPDATE face_login_challenges SET "usedAt" = now()
        WHERE id = $1 AND email = $2 AND "usedAt" IS NULL AND "expiresAt" > now()
        RETURNING action`,
        [challengeId, email.trim().toLowerCase()],
      );
    const action = rows[0]?.[0]?.action;
    if (!action) {
      throw new BadRequestException(
        'This face check has expired or was already used. Start again.',
      );
    }
    return action;
  }
}
