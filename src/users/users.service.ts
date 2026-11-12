import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Users } from './entities/users.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateGoogleUserDto } from './dto/create-google-user.dto';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { MailService } from 'src/auth/services/mail.services';
import { generateVerificationToken } from 'src/auth/utility/token.util';
import { Verification } from 'src/auth/entities/verification.entity';
import { UserSession } from 'src/auth/entities/user-session.entity';
import { VerificationType } from 'src/auth/enums/verification-type.enum';
import { maskEmail } from 'src/auth/utility/email-mask.util';
import { imagekit } from 'src/auth/utility/imagekit';
import { newAvatarKey, ownAvatarUrl } from 'src/common/media';
import type { FileObject } from 'imagekit/dist/libs/interfaces';
import { Role } from './enums/role.enum';
import axios from 'axios';

/** ImageKit folder of a user's profile pictures. */
export const profileImageFolder = (userId: string) =>
  `/user_profile_image/user_${userId}`;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private activityLogsService: ActivityLogsService,
    @InjectRepository(Users) private userRepository: Repository<Users>,
    @InjectRepository(Verification)
    private verificationRepository: Repository<Verification>,
    private mailService: MailService,
  ) {}

  // Create a new user and send verification email
  async createUser(createUserDto: CreateUserDto) {
    // phone is unique but nullable: store a missing/blank phone as NULL, never ''.
    createUserDto.phone = createUserDto.phone?.trim() || undefined;
    const { email, phone } = createUserDto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      const isUnverified = existingUser.isEmailVerified === false;
      const hasExpired =
        existingUser.createdAt &&
        new Date().getTime() - new Date(existingUser.createdAt).getTime() >
          3600000;

      if (!isUnverified) {
        throw new BadRequestException(
          `User with email ${email} already exists.`,
        );
      }

      if (isUnverified && !hasExpired) {
        throw new BadRequestException(
          `User with email ${email} is pending verification.`,
        );
      }

      await this.userRepository.delete({ id: existingUser.id });
    }

    if (phone) {
      const phoneExists = await this.userRepository.findOne({
        where: { phone },
      });
      if (phoneExists) {
        throw new BadRequestException(
          `User with phone ${phone} already exists`,
        );
      }
    }

    // Copy only the sign-up fields: role, status and verification flags
    // must never come from the request body.
    const user = this.userRepository.create({
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      dob: createUserDto.dob,
      email: createUserDto.email,
      phone: createUserDto.phone,
      password: createUserDto.password,
    });
    const savedUser = await this.userRepository.save(user);

    const token = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expires in 1 hour

    const verification = this.verificationRepository.create({
      type: VerificationType.USER_REGISTRATION_VERIFICATION,
      tokenOrOtp: token,
      user: savedUser,
      expiresAt: expiresAt,
    });

    await this.verificationRepository.save(verification);

    const fullName = `${savedUser.firstName} ${savedUser.lastName || ''}`;

    await this.mailService.sendRegistrationVerificationEmail(
      savedUser.email,
      fullName,
      token,
    );

    //Log activity
    await this.activityLogsService.createActivityLog({
      activity: ActivityType.USER_REGISTER,
      description: `New user registered: ${savedUser.id}`,
      user: savedUser,
    });

    const maskedEmail = maskEmail(savedUser.email);
    return {
      message: `Registration verification link sent to your email ${maskedEmail}`,
      // never return the token: it would let anyone verify an e-mail they do not own
    };
  }

  //Create google user by Google OAuth
  async createGoogleUser(createUserDto: CreateUserDto) {
    // phone is unique but nullable: store a missing/blank phone as NULL, never ''.
    createUserDto.phone = createUserDto.phone?.trim() || undefined;
    const { email, phone } = createUserDto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      const isUnverified = existingUser.isEmailVerified === false;
      const hasExpired =
        existingUser.createdAt &&
        new Date().getTime() - new Date(existingUser.createdAt).getTime() >
          3600000;

      if (!isUnverified) {
        throw new BadRequestException(
          `User with email ${email} already exists.`,
        );
      }

      if (isUnverified && !hasExpired) {
        throw new BadRequestException(
          `User with email ${email} is pending verification.`,
        );
      }

      await this.userRepository.delete({ id: existingUser.id });
    }

    if (phone) {
      const phoneExists = await this.userRepository.findOne({
        where: { phone },
      });
      if (phoneExists) {
        throw new BadRequestException(
          `User with phone ${phone} already exists`,
        );
      }
    }

    const user = this.userRepository.create(createUserDto);
    const savedUser = await this.userRepository.save(user);

    const fullName = `${savedUser.firstName} ${savedUser.lastName || ''}`;

    await this.mailService.sendWelcomeEmail(savedUser.email, fullName);

    //Log activity
    await this.activityLogsService.createActivityLog({
      activity: ActivityType.USER_REGISTER,
      description: `New user registered by Google OAuth: ${savedUser.id}`,
      user: savedUser,
    });

    return savedUser;
  }

  // Verify user registration
  async verifyRegistrationUpdate(userId: string) {
    const result = await this.userRepository.update(userId, {
      isEmailVerified: true,
      isActive: true,
    });

    if (result.affected === 0) {
      throw new NotFoundException('User not found or already verified');
    } else {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'email', 'firstName', 'lastName'],
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      const fullName = `${user.firstName} ${user.lastName || ''}`;
      this.mailService.sendWelcomeEmail(user.email, fullName);
      const activityLog = {
        activity: ActivityType.USER_REGISTER_VERIFICATION,
        description: `Registration verified with id ${user.id}`,
        user: user,
      };
      await this.activityLogsService.createActivityLog(activityLog);
      return {
        message:
          'Your account has been verified successfully! Redirecting to login...',
        result,
      };
    }
  }

  async getAllUsers() {
    const users = await this.userRepository.find({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dob: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        profileImage: true,
      },
    });
    if (!users) {
      return 'No users found';
    }
    return {
      message: 'Users fetched successfully',
      data: users,
    };
  }

  async getPaginatedUsersWithTotalPaid(
    page: number = 1,
    pageSize: number = 10,
    sortBy: 'createdAt' | 'firstName' = 'firstName',
    search?: string,
  ) {
    const skip = (page - 1) * pageSize;

    let qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.payments', 'payment')
      .select([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.dob',
        'user.email',
        'user.phone',
        'user.role',
        'user.isActive',
        'user.isEmailVerified',
        'user.isPhoneVerified',
        'user.profileImage',
        'user.createdAt',
      ])
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'totalPaid')
      .groupBy('user.id');

    // Search filter (case-insensitive)
    if (search) {
      qb = qb.where(
        'LOWER(user.firstName) LIKE :search OR LOWER(user.lastName) LIKE :search OR LOWER(user.email) LIKE :search',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    // Sorting
    if (sortBy === 'createdAt') {
      qb = qb
        .orderBy('user.createdAt', 'ASC')
        .addOrderBy('user.firstName', 'ASC')
        .addOrderBy('user.lastName', 'ASC');
    } else {
      // Default: firstName (A-Z)
      qb = qb
        .orderBy('user.firstName', 'ASC')
        .addOrderBy('user.lastName', 'ASC');
    }

    // Pagination
    qb = qb.skip(skip).take(pageSize);

    // Fetch data and count in parallel
    const [usersRaw, total] = await Promise.all([
      qb.getRawAndEntities(),
      this.userRepository
        .createQueryBuilder('user')
        .where(
          search
            ? `LOWER(user.firstName) LIKE :search OR LOWER(user.lastName) LIKE :search OR LOWER(user.email) LIKE :search`
            : '1=1',
          search ? { search: `%${search.toLowerCase()}%` } : {},
        )
        .getCount(),
    ]);

    const userList = usersRaw.entities.map((user, idx) => ({
      ...user,
      totalPaid: Number(usersRaw.raw[idx]?.totalPaid) || 0,
      createdAt: user.createdAt,
    }));

    return {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      users: userList,
    };
  }

  async getUserById(id: string) {
    if (!id) throw new BadRequestException('User ID is required');
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'firstName',
        'lastName',
        'dob',
        'email',
        'phone',
        'role',
        'isActive',
        'isEmailVerified',
        'isPhoneVerified',
        'profileImage',
        'createdAt',
        'updatedAt',
        'lastLoginAt',
        'lastLogoutAt',
        'isFaceVerified',
      ],
    });
    if (!user) throw new NotFoundException(`No data found for user ${id}`);
    return user;
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    if (!id) {
      throw new BadRequestException('User ID is required');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (updateUserDto.phone) {
      const checkPhone = await this.userRepository.findOne({
        where: { phone: updateUserDto.phone },
      });

      if (checkPhone && checkPhone.id !== id) {
        throw new BadRequestException(
          `User with this phone ${updateUserDto.phone} already exists`,
        );
      }
    }

    // Copy only the profile fields (never role / flags / password).
    const changes: Partial<Users> = {};
    if (updateUserDto.firstName !== undefined)
      changes.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName !== undefined)
      changes.lastName = updateUserDto.lastName;
    if (updateUserDto.phone !== undefined) {
      changes.phone = updateUserDto.phone;
      // A new number has to be verified again.
      if (user.phone !== updateUserDto.phone) changes.isPhoneVerified = false;
    }
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    const result = await this.userRepository.update(id, changes);
    if (!result) {
      throw new BadGatewayException('Failed to update user');
    }

    const activityLog = {
      activity: ActivityType.USER_UPDATE_PROFILE,
      description: 'User Profile Information Updated',
      user: user,
    };

    await this.activityLogsService.createActivityLog(activityLog);
    return result;
  }

  async updateUserRole(
    id: string,
    updateUserRoleDto: UpdateUserRoleDto,
    adminId: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    if (user.role === Role.ADMIN) {
      throw new UnauthorizedException(`Unauthorized to change admin role`);
    }

    const result = await this.userRepository.update(id, {
      role: updateUserRoleDto.role,
    });

    const activityLog = {
      activity: ActivityType.ADMIN_UPDATE_USER_ROLE,
      description: `Admin ${adminId} updated user ${id} role to ${updateUserRoleDto.role}`,
      user: await this.userRepository.findOne({ where: { id: adminId } }),
    };
    await this.activityLogsService.createActivityLog(activityLog);

    return {
      message: 'User role updated successfully',
      userAffected: result.affected,
    };
  }

  async updateUserStatus(id: string, isActive: boolean, adminId: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    if (user.role === Role.ADMIN) {
      throw new UnauthorizedException(`Unauthorized to change admin status`);
    }

    // SEC-07: blocking ends every session; unblocking does not revive them
    const result = await this.userRepository.manager.transaction(async (m) => {
      const updated = await m.update(
        Users,
        id,
        isActive ? { isActive } : { isActive, lastLogoutAt: new Date() },
      );
      if (!isActive) await m.delete(UserSession, { userId: id });
      return updated;
    });

    const activityLog = {
      activity: ActivityType.ADMIN_UPDATE_USER_STATUS,
      description: `Admin ${adminId} updated user ${id} status to ${isActive}`,
      user: await this.userRepository.findOne({ where: { id: adminId } }),
    };
    await this.activityLogsService.createActivityLog(activityLog);

    return {
      message: 'User status updated successfully',
      userAffected: result.affected,
    };
  }

  async deteteUser(id: string, adminId: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    if (user.role === Role.ADMIN) {
      throw new UnauthorizedException(`Unauthorized to delete admin account`);
    }

    const result = await this.userRepository.delete(id);
    if (!result) {
      throw new BadGatewayException('Failed to delete user');
    }

    const activityLog = {
      activity: ActivityType.ADMIN_DELETE_USER,
      description: `Admin ${adminId} deleted user ${id}`,
      user: await this.userRepository.findOne({ where: { id: adminId } }),
    };
    await this.activityLogsService.createActivityLog(activityLog);

    return {
      message: 'User deleted successfully',
      userDeleted: result.affected,
    };
  }

  //   clearDirectory(uploadPath, profileImageFileName, 'profileImage-'); // Delete old files starting with "profileImage-" except the new file

  // Upload profile image to ImageKit
  /**
   * BE-28: profile pictures are private ImageKit files. Each upload gets a
   * new avatarKey (so old review-photo links stop working) and the previous
   * file is deleted. The reply carries our own path, never an ImageKit URL.
   */
  async uploadProfileImage(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const upload = await imagekit.upload({
      file: fileBuffer,
      fileName: `${fileName}.jpg`,
      folder: profileImageFolder(userId),
      useUniqueFileName: true,
      isPrivateFile: true,
    });
    const avatarKey = newAvatarKey();
    // BE-26: face login compares with its own private reference, so a new
    // profile picture does not switch it off
    const result = await this.userRepository.update(userId, {
      profileImage: upload.name,
      profileImageFileId: upload.fileId,
      profileImagePath: upload.filePath,
      avatarKey,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Failed to update profile image');
    }
    await this.deleteProfilePictureFile(user);

    await this.activityLogsService.createActivityLog({
      activity: ActivityType.USER_UPDATE_PROFILE,
      description: 'User Changed Profile Image',
      user,
    });

    return {
      message: 'Profile Image Updated Successfully',
      avatarUrl: ownAvatarUrl({
        id: userId,
        avatarKey,
        profileImagePath: upload.filePath,
      }),
      userAffected: result.affected,
    };
  }

  /** Deletes the user's current picture file (private by id, legacy by name). */
  private async deleteProfilePictureFile(user: Users): Promise<void> {
    try {
      if (user.profileImageFileId) {
        await imagekit.deleteFile(user.profileImageFileId);
        return;
      }
      if (!user.profileImage || user.profileImage === 'profile.png') return;
      // legacy public file: find it by name in the user's folder
      const files = await imagekit.listFiles({
        path: profileImageFolder(user.id),
      });
      const old = files.find(
        (f): f is FileObject =>
          f.type === 'file' && f.name === user.profileImage,
      );
      if (old) await imagekit.deleteFile(old.fileId);
    } catch (err) {
      this.logger.warn(
        `Could not delete the old profile picture of ${user.id}: ${String(err)}`,
      );
    }
  }

  //Get user profile image from ImageKit
  async getUserProfileImage(userId: string, res: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    let imagePath: string;

    if (!user.profileImage || user.profileImage === 'profile.png') {
      // Serve default profile image from a public fallback location
      imagePath = `${process.env.IMAGEKIT_URL_ENDPOINT}/user_profile_image/profile.png`;
    } else {
      imagePath = `${process.env.IMAGEKIT_URL_ENDPOINT}/user_profile_image/user_${userId}/${user.profileImage}`;
    }

    // Option 1: Stream the image file directly (for local files only)
    // For remote URLs (like ImageKit), you need to proxy the request or redirect.
    // If you want to fetch the image from ImageKit and stream it, use a request library.
    // Here is an example using axios and stream:

    try {
      const response = await axios.get(imagePath, { responseType: 'stream' });
      res.setHeader('Content-Type', response.headers['content-type']);
      (response.data as NodeJS.ReadableStream).pipe(res);
    } catch {
      throw new HttpException(
        'Unable to retrieve the profile image',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findByEmail(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    return user;
  }

  async updateLastLogin(id: string) {
    await this.userRepository.update(id, { lastLoginAt: new Date() });
  }

  /**
   * SEC-08: someone signed up with this address but never verified it, and
   * now its owner signs in with Google. Linking would hand the owner an
   * account whose password (and phone) the first person chose ("account
   * pre-hijacking"). Instead the pending registration is discarded: the row
   * is reset to a fresh Google-only account owned by the verified address.
   */
  async claimPendingSignupForGoogle(
    id: string,
    google: CreateGoogleUserDto,
  ): Promise<Users> {
    await this.userRepository.manager.transaction(async (m) => {
      await m.update(Users, id, {
        firstName: google.firstName,
        lastName: (google.lastName ?? null) as unknown as string,
        password: '', // Google-only until the owner sets one
        phone: null as unknown as string,
        dob: null as unknown as Date,
        isPhoneVerified: false,
        isFaceVerified: false,
        isEmailVerified: true,
        profileImage: 'profile.png',
        lastLogoutAt: new Date(),
      });
      await m.delete(Verification, { userId: id });
      await m.delete(UserSession, { userId: id });
    });
    const user = await this.userRepository.findOne({ where: { id } });
    await this.activityLogsService.createActivityLog({
      activity: ActivityType.USER_REGISTER,
      description: `Unverified sign-up ${id} discarded: its address signed in with Google and now owns the account.`,
      user,
    });
    return user!;
  }

  async setLastLogoutTime(userId: string) {
    await this.userRepository.update(userId, { lastLogoutAt: new Date() });
  }

  async changePassword(id: string, password: string) {
    return await this.userRepository.update(id, {
      password: password,
    });
  }

  async findOne(id: string) {
    return await this.userRepository.findOne({ where: { id } });
  }

  async verifyPhoneNumber(userId: string) {
    await this.userRepository.update(userId, {
      isPhoneVerified: true,
    });
  }

  async getUserStats() {
    // Total users
    const total = await this.userRepository.count();

    // Active users
    const active = await this.userRepository.count({
      where: { isActive: true },
    });

    // Email-verified users
    const emailVerified = await this.userRepository.count({
      where: { isEmailVerified: true },
    });

    // Phone-verified users
    const phoneVerified = await this.userRepository.count({
      where: { isPhoneVerified: true },
    });

    // Face-verified users
    const faceVerified = await this.userRepository.count({
      where: { isFaceVerified: true },
    });

    // Role breakdown (count by role)
    const roleCountsRaw = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany<{ role: Role; count: string }>();

    // Every role is present (0 when nobody has it yet, e.g. STAFF).
    const roleCounts = Object.fromEntries(
      Object.values(Role).map((r) => [r, 0]),
    ) as Record<Role, number>;
    for (const row of roleCountsRaw) {
      roleCounts[row.role] = Number(row.count);
    }

    // User registration trend (last 7 days)
    const regTrend = await this.userRepository
      .createQueryBuilder('user')
      .select("TO_CHAR(user.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where("user.createdAt >= NOW() - INTERVAL '7 days'")
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      total,
      active,
      emailVerified,
      phoneVerified,
      faceVerified,
      roleCounts,
      registrationTrend: regTrend, // [{ date, count }]
    };
  }
}
