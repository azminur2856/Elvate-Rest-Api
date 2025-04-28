import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Users } from './entities/users.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { UserQueryDto } from './dto/user-query.dto';
import { Roles } from './entities/roles.entity';
import { Role } from './enums/roles.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,

    @InjectRepository(Roles)
    private rolesRepository: Repository<Roles>,
  ) {}

  // Create a new user
  async create(createUserDto: CreateUserDto): Promise<Users> {
    const { email, phone } = createUserDto;

    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { phone }],
    });

    if (existingUser) {
      throw new BadRequestException('Email or Phone number already in use.');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Fetch the 'CUSTOMER' role by default
    const customerRole = await this.rolesRepository.findOne({
      where: { name: Role.CUSTOMER },
    });
    if (!customerRole) {
      throw new InternalServerErrorException('Customer role not found.');
    }

    const newUser = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      profileImage: createUserDto.profileImage || 'profile.jpg',
      roles: [customerRole], // Assign the default 'CUSTOMER' role
    });

    try {
      return await this.usersRepository.save(newUser);
    } catch (error) {
      throw new InternalServerErrorException('Failed to create user.');
    }
  }

  // Get a list of users
  async getAllUsers(userQueryDto: UserQueryDto): Promise<Users[]> {
    const {
      search,
      page = 1,
      limit = 10,
      order_by = 'id',
      order_direction = 'ASC',
    } = userQueryDto;

    const whereCondition = search
      ? [
          { email: Like(`%${search}%`) },
          { phone: Like(`%${search}%`) },
          { firstName: Like(`%${search}%`) },
          { lastName: Like(`%${search}%`) },
        ]
      : undefined;

    const [users, total] = await this.usersRepository.findAndCount({
      where: whereCondition,
      order: {
        [order_by]: order_direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    if (total === 0) {
      throw new NotFoundException('No users found.');
    }

    return users;
  }

  // Get user by ID
  async getUserById(id: string): Promise<Users> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    return user;
  }

  // Update user
  async update(id: number, updateUserDto: UpdateUserDto): Promise<Users> {
    const user = await this.findOne(id);
    await this.usersRepository.update(id.toString(), updateUserDto);
    return this.findOne(id);
  }

  // Update profile image
  async updateProfileImage(id: string, profileImage: string): Promise<Users> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(
        `Cannot update image: User with ID ${id} not found.`,
      );
    }

    user.profileImage = profileImage;

    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      throw new InternalServerErrorException('Failed to update profile image.');
    }
  }

  // Change user password
  async changePassword(id: string, password: string): Promise<Users> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(
        `Cannot change password: User with ID ${id} not found.`,
      );
    }

    user.password = await bcrypt.hash(password, 10);

    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      throw new InternalServerErrorException('Failed to change password.');
    }
  }

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await this.usersRepository.findAndCount({
      skip,
      take: limit,
      relations: ['roles'],
    });

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async findOne(id: number): Promise<Users> {
    const user = await this.usersRepository.findOne({
      where: { id: id.toString() },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }
}
