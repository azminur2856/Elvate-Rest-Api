import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Users } from './users.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users) private userRepositery: Repository<Users>,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
    if (
      await this.userRepositery.findOne({
        where: { email: createUserDto.email },
      })
    ) {
      throw new NotFoundException(
        `User with this email ${createUserDto.email} already exists`,
      );
    }
    if (
      await this.userRepositery.findOne({
        where: { phone: createUserDto.phone },
      })
    ) {
      throw new NotFoundException(
        `User with this phone ${createUserDto.phone} already exists`,
      );
    }
    const user = await this.userRepositery.create(createUserDto);
    const savedUser = await this.userRepositery.save(user);
    if (!savedUser) {
      throw new NotFoundException('Faild to created user try again!');
    }

    const { password, ...result } = user;
    const name = result.firstName + ' ' + result.lastName;

    return {
      message: 'Welcome ' + name,
      data: result,
    };
  }

  async getAllUsers() {
    const users = await this.userRepositery.find({
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
    if (!id) throw new NotFoundException('User ID is required');
    const user = await this.userRepositery.findOne({
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

  async updateLastLogin(id: string) {
    await this.userRepositery.update(id, { lastLoginAt: new Date() });
  }

  async changePassword(id: string, password: string) {
    return await this.userRepositery.update(id, {
      password: password,
    });
  }
}
