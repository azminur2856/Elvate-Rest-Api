import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Users } from './entities/users.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import * as fs from 'fs';
import { deleteTempDirectory } from 'src/auth/utility/delete-directory.util';
import * as path from 'path';
import { clearDirectory } from 'src/auth/utility/clear-direttory.util';
import { MailService } from 'src/auth/services/mail.services';
import { generateVerificationToken } from 'src/auth/utility/token.util';
import { Verification } from 'src/auth/entities/verification.entity';
import { VerificationType } from 'src/auth/enums/verification-type.enum';
import { maskEmail } from 'src/auth/utility/email-mask.util';
import { imagekit } from 'src/auth/utility/imagekit';
import axios from 'axios';
import { PassThrough } from 'stream';

@Injectable()
export class UsersService {
  constructor(
    private activityLogsService: ActivityLogsService,
    @InjectRepository(Users) private userRepository: Repository<Users>,
    @InjectRepository(Verification)
    private verificationRepository: Repository<Verification>,
    private mailService: MailService,
  ) {}

  // Create a new user and send verification email
  async createUser(createUserDto: CreateUserDto) {
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

    //const { password, refreshToken, ...result } = savedUser;
    //return result;
    const maskedEmail = maskEmail(savedUser.email);
    return {
      message: `Registration verification link sent to your email ${maskedEmail}`,
      verificationToken: token,
    };
  }

  //Create google user by Google OAuth
  async createGoogleUser(createUserDto: CreateUserDto) {
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
      if (user.phone !== updateUserDto.phone) {
        updateUserDto.isPhoneVerified = false; // Set isPhoneVerified to false if phone is updated
      }
    }

    const result = await this.userRepository.update(id, updateUserDto);
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
    if (user.role === 'ADMIN') {
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
    if (user.role === 'ADMIN') {
      throw new UnauthorizedException(`Unauthorized to change admin status`);
    }

    const result = await this.userRepository.update(id, { isActive });

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
    if (user.role === 'ADMIN') {
      throw new UnauthorizedException(`Unauthorized to delete admin account`);
    }

    const result = await this.userRepository.delete(id);
    if (!result) {
      throw new BadGatewayException('Failed to delete user');
    }

    if (result.affected) {
      const userImageDirectory = `./assets/user_profile_image/user_${id}`;
      if (fs.existsSync(userImageDirectory)) {
        deleteTempDirectory(userImageDirectory);
      }
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

  // Update user profile image locally
  // async updateProfileImage(userId: string, profileImageFileName: string) {
  //   const user = await this.userRepository.findOne({ where: { id: userId } });

  //   if (!user) {
  //     throw new NotFoundException(`User not found`);
  //   }

  //   const result = await this.userRepository.update(userId, {
  //     profileImage: profileImageFileName,
  //     isFaceVerified: false, // Reset face verification status when profile image is updated
  //   });

  //   const uploadPath = path.join(
  //     '..',
  //     '..',
  //     'assets',
  //     'user_profile_image',
  //     `user_${userId}`,
  //   );

  //   // Something went wrong while updating the user.
  //   if (result.affected === 0) {
  //     clearDirectory(uploadPath, user.profileImage, 'profileImage-');
  //     throw new NotFoundException(`User not found`);
  //   }

  //   clearDirectory(uploadPath, profileImageFileName, 'profileImage-'); // Delete old files starting with "profileImage-" except the new file

  //   // Update Action Log
  //   const activityLog = {
  //     activity: ActivityType.USER_UPDATE_PROFILE,
  //     description: 'User Changed Profile Image',
  //     user: user,
  //   };
  //   await this.activityLogsService.createActivityLog(activityLog);

  //   return {
  //     message: `Profile Image Updated Successfully`,
  //     userAffected: result.affected,
  //   };
  // }

  // Upload profile image to ImageKit
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

    const folder = `/user_profile_image/user_${userId}`;

    // Upload image to ImageKit
    const uploadResponse = await imagekit.upload({
      file: fileBuffer,
      fileName: `${fileName}.jpg`,
      folder: folder,
      useUniqueFileName: false,
      isPrivateFile: false,
    });

    if (user.profileImage && user.profileImage !== 'profile.png') {
      try {
        const files = await imagekit.listFiles({
          // only provide folder, NOT full path
          folder: folder,
        });

        const fileToDelete = files.find(
          (file) => file.name === user.profileImage,
        );

        if (fileToDelete) {
          await imagekit.deleteFile(fileToDelete.fileId);
          try {
            const cleanUrl = fileToDelete.url.split('?')[0];
            await imagekit.purgeCache(cleanUrl);
            console.log('Cache purged for old image:', cleanUrl);
            console.log('Cache purged for old image:', fileToDelete.url);
          } catch (purgeError) {
            console.warn('Failed to purge cache for old image:', purgeError);
          }
        } else {
          console.warn('Old image not found in ImageKit folder');
        }
      } catch (err) {
        console.warn('Failed to fetch or delete old image from ImageKit:', err);
      }
    }

    // Save new image file name
    const result = await this.userRepository.update(userId, {
      profileImage: uploadResponse.name,
      isFaceVerified: false,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Failed to update profile image');
    }

    // Log activity
    const activityLog = {
      activity: ActivityType.USER_UPDATE_PROFILE,
      description: 'User Changed Profile Image',
      user,
    };
    await this.activityLogsService.createActivityLog(activityLog);

    return {
      message: 'Profile Image Updated Successfully',
      imageUrl: uploadResponse.url,
      userAffected: result.affected,
    };
  }

  // Get user profile image from local storage
  // async getUserProfileImage(userId: string, res: any) {
  //   const user = await this.userRepository.findOne({ where: { id: userId } });
  //   if (!user) {
  //     throw new NotFoundException(`User not found`);
  //   }

  //   let imagePath = path.join(
  //     __dirname,
  //     '..',
  //     '..',
  //     'assets',
  //     'user_profile_image',
  //     `user_${userId}`,
  //     `${user.profileImage}`,
  //   );

  //   if (user.profileImage === 'profile.png') {
  //     imagePath = path.join(
  //       __dirname,
  //       '..',
  //       '..',
  //       'assets',
  //       'user_profile_image',
  //       `${user.profileImage}`,
  //     );
  //   }

  //   // Check if the image exists
  //   if (!fs.existsSync(imagePath)) {
  //     throw new NotFoundException(`Image file not found`);
  //   }

  //   // Stream the image file to the client
  //   res.sendFile(imagePath, (err: any) => {
  //     if (err) {
  //       throw new HttpException(
  //         'Unable to retrieve the profile image',
  //         HttpStatus.INTERNAL_SERVER_ERROR,
  //       );
  //     }
  //   });
  //   return {
  //     message: `Profile Image Sent Successfully`,
  //   };
  // }

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
    } catch (err) {
      throw new HttpException(
        'Unable to retrieve the profile image',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Option 2: Send as JSON response (for frontend to handle)
    // return {
    //   message: 'Profile image URL retrieved successfully',
    //   imageUrl: imagePath,
    // };
  }

  async updateHashedRefreshToken(userId: string, hashedRefreshToken: string) {
    return await this.userRepository.update(
      { id: userId },
      { refreshToken: hashedRefreshToken },
    );
  }

  async findByEmail(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    return user;
  }

  async updateLastLogin(id: string) {
    await this.userRepository.update(id, { lastLoginAt: new Date() });
  }

  async setLastLogoutTime(userId: string) {
    await this.userRepository.update(userId, { lastLogoutAt: new Date() });
  }

  async changePassword(id: string, password: string) {
    return await this.userRepository.update(id, {
      password: password,
    });
  }

  async getUserRefreshTokenFromDB(id: string) {
    if (!id) {
      throw new BadRequestException(`Id is required`);
    }

    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'refreshToken'],
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async findOne(id: string) {
    return await this.userRepository.findOne({ where: { id } });
  }

  async verifyPhoneNumber(userId: string) {
    await this.userRepository.update(userId, {
      isPhoneVerified: true,
    });
  }

  async markFaceAsVerified(id: string) {
    await this.userRepository.update(id, { isFaceVerified: true });

    const user = await this.getUserById(id);

    // Update Action Log
    const activityLog = {
      activity: ActivityType.USER_VERIFY_FACE,
      description: 'User verified face successfully',
      user: user,
    };
    await this.activityLogsService.createActivityLog(activityLog);
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
      .getRawMany();

    const roleCounts = {};
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
