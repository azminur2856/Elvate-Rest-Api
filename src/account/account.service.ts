import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import Stripe from 'stripe';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { Users } from 'src/users/entities/users.entity';
import { UserSession } from 'src/auth/entities/user-session.entity';
import { Verification } from 'src/auth/entities/verification.entity';
import { Address } from 'src/addresses/entities/address.entity';
import { CartItem } from 'src/cart/entities/cart-item.entity';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { Role } from 'src/users/enums/role.enum';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { AuthUser } from 'src/common/auth-user';
import { imagekit } from 'src/auth/utility/imagekit';
import stripeConfig from 'src/subscription/config/stripe.config';
import { DeleteAccountDto } from './dto/account.dto';
import { FaceReferenceService } from 'src/face/face-reference.service';

/** Contract `DeviceSession`. */
export type DeviceSession = {
  id: string;
  loginMethod: string;
  userAgent: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  current: boolean;
};

// moved to src/common/password.ts (face setup needs it too)
export { hasUsablePassword } from 'src/common/password';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  private readonly stripe: Stripe | null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Users) private readonly users: Repository<Users>,
    @InjectRepository(UserSession)
    private readonly sessions: Repository<UserSession>,
    private readonly activityLogs: ActivityLogsService,
    private readonly faceReferences: FaceReferenceService,
    @Inject(stripeConfig.KEY) stripeSettings: ConfigType<typeof stripeConfig>,
  ) {
    this.stripe = stripeSettings.stripeSecretKey
      ? new Stripe(stripeSettings.stripeSecretKey, {
          apiVersion: '2025-05-28.basil',
        })
      : null;
  }

  // ---------- sessions ----------

  async listSessions(user: AuthUser): Promise<DeviceSession[]> {
    const rows = await this.sessions.find({
      where: { userId: user.id, expiresAt: MoreThan(new Date()) },
      order: { lastUsedAt: 'DESC' },
    });
    return rows.map((s) => ({
      id: s.id,
      loginMethod: s.loginMethod,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      current: s.id === user.sid,
    }));
  }

  /** Returns whether the revoked session was the caller's own (→ clear the cookie). */
  async revokeSession(
    user: AuthUser,
    sessionId: string,
  ): Promise<{ wasCurrent: boolean }> {
    const session = await this.sessions.findOne({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.sessions.delete({ id: sessionId, userId: user.id });
    await this.log(
      user.id,
      ActivityType.USER_REVOKE_SESSION,
      `User ${user.id} signed out session ${sessionId} (${session.loginMethod})`,
    );
    return { wasCurrent: sessionId === user.sid };
  }

  /** Every device: sessions deleted + lastLogoutAt bumped so older JWTs stop working too. */
  async logoutAll(user: AuthUser) {
    await this.sessions.delete({ userId: user.id });
    await this.users.update(user.id, { lastLogoutAt: new Date() });
    await this.log(
      user.id,
      ActivityType.USER_LOGOUT_ALL,
      `User ${user.id} signed out on all devices`,
    );
  }

  // ---------- profile helper ----------

  async hasPassword(userId: string): Promise<boolean> {
    const row = await this.users.findOne({
      select: ['id', 'password'],
      where: { id: userId },
    });
    return hasUsablePassword(row?.password);
  }

  // ---------- DELETE /users/me ----------

  /**
   * Anonymise + deactivate. Orders and payments are kept (bookkeeping), but
   * everything personal goes: name, e-mail, phone, birthday, photos (incl.
   * the face-login image), saved addresses, cart, sessions. An auto-renewing
   * subscription is set to cancel at the end of the paid period.
   */
  async deleteMe(user: AuthUser, dto: DeleteAccountDto): Promise<void> {
    const account = await this.users.findOne({ where: { id: user.id } });
    if (!account) throw new NotFoundException('Account not found');
    if (account.role === Role.ADMIN) {
      throw new ForbiddenException(
        'An admin account cannot delete itself; ask another admin to change your role first',
      );
    }

    if (hasUsablePassword(account.password)) {
      if (
        !dto.password ||
        !(await bcrypt.compare(dto.password, account.password))
      ) {
        throw new UnauthorizedException('Password is incorrect');
      }
    } else if (dto.confirm !== 'DELETE') {
      throw new BadRequestException('Type DELETE to confirm');
    }

    const now = new Date();
    const live = await this.dataSource.getRepository(Subscription).find({
      where: {
        user: { id: user.id },
        isCancelled: false,
        endDate: MoreThan(now),
      },
    });
    await Promise.all(
      live.map((s) => this.stopRenewal(s.stripeSubscriptionId)),
    );

    await this.dataSource.transaction(async (m) => {
      await m.update(
        Users,
        { id: user.id },
        {
          firstName: 'Deleted user',
          lastName: null as unknown as string,
          email: `deleted-${user.id}@deleted.invalid`,
          phone: null as unknown as string,
          dob: null as unknown as Date,
          password: '',
          profileImage: 'profile.png',
          isActive: false,
          isEmailVerified: false,
          isPhoneVerified: false,
          isFaceVerified: false,
          lastLogoutAt: now,
        },
      );
      await m.delete(UserSession, { userId: user.id });
      await m.delete(Verification, { user: { id: user.id } });
      await m.delete(Address, { userId: user.id });
      await m.delete(CartItem, { userId: user.id });
      if (live.length) {
        await m.update(
          Subscription,
          live.map((s) => s.id),
          { isCancelled: true },
        );
      }
    });

    await this.deleteProfileImages(user.id);
    // SEC-04: the private face photo is biometric data; delete it as well
    await this.faceReferences.remove(user.id);
    await this.log(
      user.id,
      ActivityType.USER_DELETE_ACCOUNT,
      `User ${user.id} deleted their account (anonymised; orders and payments kept)`,
    );
  }

  // ---------- helpers ----------

  private async stopRenewal(stripeSubscriptionId: string) {
    if (!this.stripe || !stripeSubscriptionId) return;
    try {
      await this.stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (err) {
      this.logger.warn(
        `Could not stop renewal of ${stripeSubscriptionId}: ${(err as Error).message}`,
      );
    }
  }

  /** Profile + face-login photos live under /user_profile_image/user_<id>/ on ImageKit. */
  private async deleteProfileImages(userId: string) {
    try {
      const files = await imagekit.listFiles({
        path: `/user_profile_image/user_${userId}`,
      });
      await Promise.all(
        files
          .filter(
            (f): f is Extract<typeof f, { fileId: string }> =>
              f.type === 'file',
          )
          .map((f) => imagekit.deleteFile(f.fileId)),
      );
    } catch (err) {
      this.logger.warn(
        `Could not delete ImageKit photos of ${userId}: ${(err as Error).message}`,
      );
    }
  }

  private log(userId: string, activity: ActivityType, description: string) {
    return this.activityLogs.createActivityLog({
      activity,
      description,
      user: { id: userId } as Users,
    });
  }
}
