import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FaceReference } from './face-reference.entity';
import { Users } from 'src/users/entities/users.entity';
import { FaceVerificationService } from 'src/users/services/face-verification.service';
import { FaceCheckFailure, LIVENESS } from 'src/users/services/face-check';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { MailService } from 'src/auth/services/mail.services';
import { imagekit } from 'src/auth/utility/imagekit';
import { faceJpeg } from './face-photo';

/** ImageKit folder of a user's private face reference. */
export const faceReferenceFolder = (userId: string) =>
  `/face_reference/user_${userId}/`;

/** Signed reference URLs live just long enough for Face++ to fetch them. */
const SIGNED_URL_SECONDS = 120;

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
    private readonly face: FaceVerificationService,
    private readonly activityLogs: ActivityLogsService,
    private readonly mail: MailService,
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
  async enroll(userId: string, photo: Buffer): Promise<FaceLoginState> {
    if (!this.face.isConfigured()) {
      throw new ServiceUnavailableException(
        'Face login is not available right now.',
      );
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

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
