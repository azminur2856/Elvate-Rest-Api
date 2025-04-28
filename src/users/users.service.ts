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
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users) private userRepository: Repository<Users>,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
    if (
      await this.userRepository.findOne({
        where: { email: createUserDto.email },
      })
    ) {
      throw new BadRequestException(
        `User with this email ${createUserDto.email} already exists`,
      );
    }
    if (
      await this.userRepository.findOne({
        where: { phone: createUserDto.phone },
      })
    ) {
      throw new BadRequestException(
        `User with this phone ${createUserDto.phone} already exists`,
      );
    }
    const user = await this.userRepository.create(createUserDto);
    const savedUser = await this.userRepository.save(user);
    if (!savedUser) {
      throw new NotFoundException('Faild to created user try again!');
    }

    const { password, refreshToken, ...result } = user;

    return result;
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
      ],
    });
    if (!user) throw new NotFoundException(`No data found for user ${id}`);
    return {
      message: 'User found!',
      data: user,
    };
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    if (!id) {
      throw new BadRequestException('User ID is required');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    if (
      await this.userRepository.findOne({
        where: { phone: updateUserDto.phone },
      })
    ) {
      throw new BadRequestException(
        `User with this phone ${updateUserDto.phone} already exists`,
      );
    }

    const result = await this.userRepository.update(id, updateUserDto);
    if (!result) {
      throw new BadGatewayException('Failed to update user');
    }

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

    return {
      message: 'User deleted successfully',
      userDeleted: result.affected,
    };
  }

  async updateProfileImage(userId: string, profileImageFileName: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    const result = await this.userRepository.update(userId, {
      profileImage: profileImageFileName,
    });

    const uploadPath = path.join(
      '..',
      '..',
      'assets',
      'user_profile_image',
      `user_${userId}`,
    );
  }

  async getUserProfileImage(userId: string, res: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    let imagePath = path.join(
      __dirname,
      '..',
      '..',
      'assets',
      'user_profile_image',
      `user_${userId}`,
      `${user.profileImage}`,
    );

    if (user.profileImage === 'avatar.jpg') {
      imagePath = path.join(
        __dirname,
        '..',
        '..',
        'assets',
        'user_profile_image',
        `${user.profileImage}`,
      );
    }

    // Check if the image exists
    if (!fs.existsSync(imagePath)) {
      throw new NotFoundException(`Image file not found`);
    }

    // Stream the image file to the client
    res.sendFile(imagePath, (err: any) => {
      if (err) {
        throw new HttpException(
          'Unable to retrieve the profile image',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
    return {
      message: `Profile Image Sent Successfully`,
    };
  }

  async updateHashedRefreshToken(userId: string, hashedRefreshToken: string) {
    return await this.userRepository.update(
      { id: userId },
      { refreshToken: hashedRefreshToken },
    );
  }

  async updateLastLogin(id: string) {
    await this.userRepository.update(id, { lastLoginAt: new Date() });
  }

  async changePassword(id: string, password: string) {
    return await this.userRepository.update(id, {
      password: password,
    });
  }
}
