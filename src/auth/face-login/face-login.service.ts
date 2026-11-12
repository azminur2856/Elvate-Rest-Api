import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { FaceLoginChallenge } from './face-login-challenge.entity';
import {
  FACE_ACTION_PROMPTS,
  FACE_ACTIONS,
  FaceAction,
  FaceAnalysis,
  FaceCheckFailure,
  isMatch,
  performedAction,
} from 'src/users/services/face-check';
import { FaceVerificationService } from 'src/users/services/face-verification.service';
import { FaceReferenceService } from 'src/face/face-reference.service';
import { faceJpeg } from 'src/face/face-photo';
import {
  AttemptKey,
  LoginAttemptsService,
  emailKey,
} from '../attempts/login-attempts.service';
import { Users } from 'src/users/entities/users.entity';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { MailService } from '../services/mail.services';
import { escapeHtml } from 'src/common/html';
import { SettingsService } from 'src/settings/settings.service';

/** How long the user has to take both photos. */
export const CHALLENGE_TTL_MS = 2 * 60_000;

/** One answer for every failure, so face login reveals nothing (SEC-12). */
export const FACE_LOGIN_FAILED =
  "We couldn't sign you in with your face. If you haven't set up face login yet, sign in with your password and set it up from your profile. Otherwise, make sure your face is clearly visible in good light and follow the on-screen prompt.";

export interface FaceChallenge {
  challengeId: string;
  action: FaceAction;
  prompt: string;
  expiresAt: Date;
}

export interface FaceLoginInput {
  email: string;
  challengeId: string;
  /** Photo taken while looking at the camera. */
  neutral: Buffer;
  /** Photo taken after doing the prompt. */
  action: Buffer;
  ip: string;
}

@Injectable()
export class FaceLoginService {
  constructor(
    @InjectRepository(FaceLoginChallenge)
    private readonly challenges: Repository<FaceLoginChallenge>,
    @InjectRepository(Users) private readonly users: Repository<Users>,
    private readonly attempts: LoginAttemptsService,
    private readonly face: FaceVerificationService,
    private readonly references: FaceReferenceService,
    private readonly activityLogs: ActivityLogsService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Step 1 of face login. Answers the same way for any e-mail, so it does not
   * reveal whether an account (or face login) exists.
   */
  async createChallenge(email: string): Promise<FaceChallenge> {
    await this.settings.assertFaceLoginEnabled(); // BE-27, same for any e-mail
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

  /**
   * Step 2: both frames must show exactly one clear face, the prompt must have
   * been done between them, they must show the same person, and the first one
   * must match the private reference at Face++'s strict 1e-5 level.
   * Returns the user to sign in; every failure is the same 401 and counts
   * against the e-mail and the IP (5 per 15 minutes, then a 15-minute lock).
   */
  async verify(input: FaceLoginInput): Promise<Users> {
    // BE-27: also stops challenges issued before the switch went off
    await this.settings.assertFaceLoginEnabled();
    const keys: AttemptKey[] = [
      emailKey('face-email', input.email),
      { scope: 'face-ip', key: input.ip },
    ];
    await this.attempts.assertNotLocked(keys, 'face sign-in');
    const action = await this.consumeChallenge(input.challengeId, input.email);

    const user = await this.users.findOne({ where: { email: input.email } });
    const fail = async (reason: string): Promise<never> => {
      await this.attempts.recordFailure(keys);
      if (user) {
        await this.activityLogs.createActivityLog({
          activity: ActivityType.USER_LOGIN_FACE_FAILED,
          description: `Failed face login for user ${user.id} (${reason}).`,
          user,
        });
      }
      throw new UnauthorizedException(FACE_LOGIN_FAILED);
    };

    if (!user || !user.isActive || !user.isFaceVerified) {
      return fail('face login not available');
    }
    const referenceUrl = await this.references.signedReferenceUrl(user.id);
    if (!referenceUrl) return fail('no private reference');

    let neutral: FaceAnalysis;
    let acted: FaceAnalysis;
    try {
      neutral = await this.face.analyze(
        (await faceJpeg(input.neutral)).toString('base64'),
      );
      acted = await this.face.analyze(
        (await faceJpeg(input.action)).toString('base64'),
      );
    } catch (err) {
      if (err instanceof FaceCheckFailure) return fail(err.reason);
      throw err;
    }

    if (!performedAction(action, neutral, acted)) {
      return fail(`liveness ${action} not seen`);
    }
    const samePerson = await this.face.compare(
      { faceToken: neutral.faceToken },
      { faceToken: acted.faceToken },
    );
    if (!isMatch(samePerson, '1e-4'))
      return fail('frames show different faces');
    const reference = await this.face.compare(
      { imageUrl: referenceUrl },
      { faceToken: neutral.faceToken },
    );
    if (!isMatch(reference, '1e-5')) return fail('no match with reference');

    await this.attempts.clear([keys[0]]);
    return user;
  }

  /** "New sign-in with face login" e-mail; never blocks the sign-in. */
  notifySignIn(user: Users, userAgent?: string): void {
    const when = new Date().toLocaleString('en-GB', {
      timeZone: 'Asia/Dhaka',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const device = userAgent ? ` (${escapeHtml(userAgent.slice(0, 160))})` : '';
    void this.mail.sendNotificationEmail(
      user.email,
      `${user.firstName} ${user.lastName ?? ''}`.trim(), // escaped by MailService
      'New sign-in to Elvate with face login',
      `Someone signed in to your account with face login on ${escapeHtml(when)} (Bangladesh time)${device}. If this was not you, change your password and turn face login off in Settings.`,
    );
  }
}
