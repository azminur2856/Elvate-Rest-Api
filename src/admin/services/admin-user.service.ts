import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, ILike, FindOptionsWhere } from 'typeorm';
import { Users } from 'src/users/entities/users.entity';
import { Roles } from 'src/users/entities/roles.entity';
import { AdminUpdateUserDto } from '../dto/admin-user.dto';
import { AdminUserQueryDto, PaginatedResponse } from '../dto/admin-user-query.dto';
import { Role } from 'src/users/enums/roles.enum';

/**
 * Service for managing users from the admin perspective.
 * @class AdminUserService
 * @description Handles administrative operations for user management.
 */
@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    @InjectRepository(Roles)
    private readonly rolesRepository: Repository<Roles>,
  ) {}

  /**
   * Retrieves all users with optional filtering and pagination.
   * @param query - Query parameters for filtering and pagination
   * @returns Promise<PaginatedResponse<Users>> - Users and pagination metadata
   */
  async findAll(queryDto: AdminUserQueryDto): Promise<PaginatedResponse<Users>> {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        role,
        isActive,
        isEmailVerified,
        createdAfter,
        createdBefore,
        lastLoginAfter,
        lastLoginBefore,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = queryDto;

      const skip = (page - 1) * limit;
      const queryBuilder = this.userRepository.createQueryBuilder('user');

      // Apply filters
      if (search) {
        queryBuilder.andWhere(
          '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      if (role) {
        queryBuilder.andWhere('user.role = :role', { role });
      }

      if (isActive !== undefined) {
        queryBuilder.andWhere('user.isActive = :isActive', { isActive });
      }

      if (isEmailVerified !== undefined) {
        queryBuilder.andWhere('user.isEmailVerified = :isEmailVerified', { isEmailVerified });
      }

      if (createdAfter || createdBefore) {
        queryBuilder.andWhere('user.createdAt BETWEEN :createdAfter AND :createdBefore', {
          createdAfter: createdAfter || new Date(0),
          createdBefore: createdBefore || new Date(),
        });
      }

      if (lastLoginAfter || lastLoginBefore) {
        queryBuilder.andWhere('user.lastLoginAt BETWEEN :lastLoginAfter AND :lastLoginBefore', {
          lastLoginAfter: lastLoginAfter || new Date(0),
          lastLoginBefore: lastLoginBefore || new Date(),
        });
      }

      // Apply sorting
      const validSortFields = ['createdAt', 'lastLoginAt', 'firstName', 'lastName', 'email', 'role'];
      const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      queryBuilder.orderBy(`user.${finalSortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

      // Apply pagination
      queryBuilder.skip(skip).take(limit);

      const [items, total] = await queryBuilder.getManyAndCount();

      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          message: total === 0 ? 'No users found matching the criteria' : undefined,
        },
      };
    } catch (error) {
      throw new BadRequestException(`Error processing user query: ${error.message}`);
    }
  }

  /**
   * Retrieves a user by ID.
   * @param id - User ID
   * @returns Promise<Users> - The found user
   * @throws NotFoundException - If user is not found
   */
  async findOne(id: string): Promise<Users> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  /**
   * Updates a user's information.
   * @param id - User ID
   * @param updateDto - Data for updating the user
   * @returns Promise<Users> - The updated user
   * @throws NotFoundException - If user is not found
   */
  async update(id: string, updateDto: AdminUpdateUserDto): Promise<Users> {
    const user = await this.findOne(id);

    // Update basic fields
    Object.assign(user, updateDto);

    // Handle role update if provided
    if (updateDto.role) {
      const role = await this.rolesRepository.findOne({
        where: { name: updateDto.role },
      });

      if (!role) {
        throw new BadRequestException(`Role ${updateDto.role} not found`);
      }

      // Set the new role
      user.roles = [role];
    }

    return this.userRepository.save(user);
  }

  /**
   * Toggles a user's active status.
   * @param id - User ID
   * @returns Promise<Users> - The updated user
   * @throws NotFoundException - If user is not found
   */
  async toggleUserStatus(id: string, isActive: boolean): Promise<Users> {
    const user = await this.findOne(id);
    user.isActive = isActive;
    return this.userRepository.save(user);
  }

  async getUserStats(): Promise<any> {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { isActive: true },
    });
    const verifiedUsers = await this.userRepository.count({
      where: { isEmailVerified: true },
    });

    // Count by role
    const roleCounts = {};
    const roles = Object.values(Role);

    for (const role of roles) {
      const roleEntity = await this.rolesRepository.findOne({
        where: { name: role },
        relations: ['users'],
      });

      roleCounts[role] = roleEntity?.users?.length || 0;
    }

    // Get new users in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newUsers = await this.userRepository.count({
      where: {
        createdAt: Between(thirtyDaysAgo, new Date()),
      },
    });

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      newUsers,
      roleCounts,
    };
  }

  async getStats() {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({ where: { isActive: true } });
    const inactiveUsers = await this.userRepository.count({ where: { isActive: false } });
    
    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
    };
  }

  async setStatus(id: string, isActive: boolean) {
    await this.userRepository.update(id, { isActive });
    return this.findOne(id);
  }

  /**
   * Updates a user's role.
   * @param id - User ID
   * @param role - New role
   * @returns Promise<Users> - The updated user
   */
  async updateUserRole(id: string, role: Role): Promise<Users> {
    const user = await this.findOne(id);
    
    const roleEntity = await this.rolesRepository.findOne({
      where: { name: role },
    });

    if (!roleEntity) {
      throw new BadRequestException(`Role ${role} not found`);
    }

    // Update the user's roles
    user.roles = [roleEntity];
    
    // Update email verification status
    user.isEmailVerified = true;

    return this.userRepository.save(user);
  }
}
