import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FaceReference } from './face-reference.entity';
import { Users } from 'src/users/entities/users.entity';
import { FaceVerificationService } from 'src/users/services/face-verification.service';
import {
  FaceCheckFailure,
  LIVENESS,
  isMatch,
} from 'src/users/services/face-check';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { MailService } from 'src/auth/services/mail.services';
import { imagekit } from 'src/auth/utility/imagekit';
import { faceJpeg } from './face-photo';
import { SettingsService } from 'src/settings/settings.service';
import { UserSession } from 'src/auth/entities/user-session.entity';
import { hasUsablePassword } from 'src/common/password';
import * as bcrypt from 'bcrypt';

/** ImageKit folder of a user's private face reference. */
export const faceReferenceFolder = (userId: string) =>
  `/face_reference/user_${userId}/`;

/** Signed reference URLs live just long enough for Face++ to fetch them. */
const SIGNED_URL_SECONDS = 120;

/** BE-26: Google-only accounts must have signed in this recently. */
export const RECENT_LOGIN_MS = 10 * 60_000;

export const NO_PROFILE_PICTURE =
  'Add a profile picture that clearly shows your face before setting up face login.';
export const PROFILE_PICTURE_MISMATCH =
  "This photo doesn't match your profile picture. Make sure you're the person in your profile picture, or update your profile picture and try again.";
const PROFILE_PICTURE_UNREADABLE =
  "We couldn't check your profile picture. Try again, or upload a clearer profile picture.";

/** What face setup needs to re-check the user (BE-26). */
export interface FaceSetupAuth {
  /** current password (password accounts) */
  password?: string;
  /** session id from the JWT (Google-only accounts) */
  sessionId?: string;
}

/** A real profile picture (private since BE-28, or a legacy public one). */
export const hasProfilePicture = (
  user: Pick<Users, 'profileImage' | 'profileImagePath'>,
) =>
  !!user.profileImagePath ||
  (!!user.profileImage && user.profileImage !== 'profile.png');

export interface FaceLoginState {
  faceLoginEnabled: boolean;
}

@Injectable()
export class FaceReferenceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FaceReferenceService.name);

  constructor(
    @InjectRepository(FaceReference)
    private readonly refs: Repository<FaceReference>,
    @InjectRepository(Users) private readonly users: Repository<Users>,
    @InjectRepository(UserSession)
    private readonly sessions: Repository<UserSession>,
    private readonly face: FaceVerificationService,
    private readonly activityLogs: ActivityLogsService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Users who set up face login before SEC-04 were matched against their
   * public profile picture. They must set it up once more: without a private
   * reference, face login counts as off. Idempotent; runs on every boot.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const reset: unknown[] = await this.users.query(
        `UPDATE users SET "isFaceVerified" = false
          WHERE "isFaceVerified" = true
            AND NOT EXISTS (SELECT 1 FROM face_references f WHERE f."userId" = users.id)
          RETURNING id`,
      );
      const count = Array.isArray(reset[0]) ? reset[0].length : reset.length;
      if (count) {
        this.logger.log(
          `Face login switched off for ${count} user(s) without a private reference (they must set it up again).`,
        );
      }
    } catch (err) {
      this.logger.error(`Could not normalise face login flags: ${String(err)}`);
    }
  }

  /**
   * Face setup: checks the photo with Face++ (one clear, frontal face with
   * open eyes), stores it as a private ImageKit file, replaces any earlier
   * reference and turns face login on.
   */
  async enroll(
    userId: string,
    photo: Buffer,
    auth: FaceSetupAuth = {},
  ): Promise<FaceLoginState> {
    await this.settings.assertFaceLoginEnabled(); // BE-27 admin switch
    if (!this.face.isConfigured()) {
      throw new ServiceUnavailableException(
        'Face login is not available right now.',
      );
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // BE-26 "option A": a profile picture of the user to check against ...
    if (!hasProfilePicture(user)) {
      throw new BadRequestException(NO_PROFILE_PICTURE);
    }
    // ... and proof that the person at the keyboard owns the account
    await this.reauthenticate(user, auth);

    let jpeg: Buffer;
    try {
      jpeg = await faceJpeg(photo);
      const face = await this.face.analyze(jpeg.toString('base64'));
      if (Math.abs(face.yaw) > LIVENESS.neutralMaxYaw + 5) {
        throw new FaceCheckFailure('NOT_FRONTAL');
      }
      if (face.eyesOpen < LIVENESS.eyesOpenMin) {
        throw new FaceCheckFailure('EYES_CLOSED');
      }
      // the live photo must be the person in the profile picture (strict)
      let match;
      try {
        match = await this.face.compare(
          { imageUrl: this.profilePictureUrl(user) },
          { faceToken: face.faceToken },
        );
      } catch (err) {
        if (err instanceof FaceCheckFailure) {
          throw new BadRequestException(PROFILE_PICTURE_UNREADABLE);
        }
        throw err;
      }
      if (!isMatch(match, '1e-5')) {
        throw new BadRequestException(PROFILE_PICTURE_MISMATCH);
      }
    } catch (err) {
      if (err instanceof FaceCheckFailure) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const upload = await imagekit.upload({
      file: jpeg,
      fileName: `face-${Date.now()}.jpg`,
      folder: faceReferenceFolder(userId),
      useUniqueFileName: true,
      isPrivateFile: true,
    });
    const previous = await this.refs.findOne({ where: { userId } });
    await this.refs.save({
      userId,
      fileId: upload.fileId,
      filePath: upload.filePath,
    });
    await this.users.update(userId, { isFaceVerified: true });
    if (previous) await this.deleteFile(previous.fileId);

    await this.activityLogs.createActivityLog({
      activity: ActivityType.USER_VERIFY_FACE,
      description: `User ${userId} set up face login (private reference photo).`,
      user,
    });
    void this.mail.sendNotificationEmail(
      user.email,
      `${user.firstName} ${user.lastName ?? ''}`.trim(), // escaped by MailService
      'Face login was set up on your Elvate account',
      'Face login was just set up on your account. If this was not you, change your password and remove face login in Settings.',
    );
    return { faceLoginEnabled: true };
  }

  /**
   * BE-26: a password account re-enters its password; a Google-only account
   * must have signed in within the last 10 minutes.
   */
  private async reauthenticate(user: Users, auth: FaceSetupAuth) {
    if (hasUsablePassword(user.password)) {
      const ok =
        !!auth.password && (await bcrypt.compare(auth.password, user.password));
      if (!ok) throw new UnauthorizedException('Incorrect password.');
      return;
    }
    const session = auth.sessionId
      ? await this.sessions.findOne({
          where: { id: auth.sessionId, userId: user.id },
          select: ['id', 'createdAt'],
        })
      : null;
    if (
      !session ||
      Date.now() - session.createdAt.getTime() > RECENT_LOGIN_MS
    ) {
      throw new UnauthorizedException(
        'For your security, please sign in again before setting up face login.',
      );
    }
  }

  /** Short-lived signed URL Face++ fetches the profile picture from. */
  private profilePictureUrl(user: Users): string {
    return imagekit.url({
      path:
        user.profileImagePath ??
        `/user_profile_image/user_${user.id}/${user.profileImage}`,
      signed: true,
      expireSeconds: SIGNED_URL_SECONDS,
    });
  }

  /** Turns face login off and deletes the private photo. */
  async remove(userId: string): Promise<FaceLoginState> {
    const ref = await this.refs.findOne({ where: { userId } });
    if (ref) {
      await this.refs.delete({ userId });
      await this.deleteFile(ref.fileId);
    }
    await this.users.update(userId, { isFaceVerified: false });
    if (ref) {
      await this.activityLogs.createActivityLog({
        activity: ActivityType.USER_REMOVE_FACE,
        description: `User ${userId} turned face login off.`,
        user: { id: userId } as Users,
      });
    }
    return { faceLoginEnabled: false };
  }

  /** Short-lived signed URL of the private photo, or null without one. */
  async signedReferenceUrl(userId: string): Promise<string | null> {
    const ref = await this.refs.findOne({ where: { userId } });
    if (!ref) return null;
    return imagekit.url({
      path: ref.filePath,
      signed: true,
      expireSeconds: SIGNED_URL_SECONDS,
    });
  }

  private async deleteFile(fileId: string): Promise<void> {
    try {
      await imagekit.deleteFile(fileId);
    } catch (err) {
      this.logger.warn(
        `Could not delete face reference ${fileId}: ${String(err)}`,
      );
    }
  }
}
