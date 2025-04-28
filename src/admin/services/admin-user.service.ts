import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, FindOptionsWhere } from 'typeorm';
import { Users } from 'src/users/entities/users.entity';
import { Roles } from 'src/users/entities/roles.entity';
import { AdminUpdateUserDto } from '../dto/admin-user.dto';
import { AdminUserQueryDto } from '../dto/admin-user-query.dto';
import { Role } from 'src/users/enums/roles.enum';
import { PaginatedResponse } from '../interfaces/paginated-response.interface';

@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    @InjectRepository(Roles)
    private readonly rolesRepository: Repository<Roles>,
  ) {}

  async findAll(queryDto: AdminUserQueryDto): Promise<PaginatedResponse<Users>> {
    const { 
      page, 
      limit, 
      search, 
      order_by, 
      order_direction, 
      role, 
      isActive,
      isEmailVerified,
      createdAfter,
      createdBefore,
      lastLoginAfter,
      lastLoginBefore
    } = queryDto;

    const skip = (page - 1) * limit;
    
    // Build where conditions
    const whereConditions: FindOptionsWhere<Users> = {};

    if (search) {
      whereConditions.firstName = Like(`%${search}%`);
      // Add more search fields if needed
    }

    if (isActive !== undefined) {
      whereConditions.isActive = isActive;
    }

    if (isEmailVerified !== undefined) {
      whereConditions.isEmailVerified = isEmailVerified;
    }

    // Date range filters
    if (createdAfter || createdBefore) {
      whereConditions.createdAt = Between(
        createdAfter ? new Date(createdAfter) : new Date(0),
        createdBefore ? new Date(createdBefore) : new Date(),
      );
    }

    if (lastLoginAfter || lastLoginBefore) {
      whereConditions.lastLoginAt = Between(
        lastLoginAfter ? new Date(lastLoginAfter) : new Date(0),
        lastLoginBefore ? new Date(lastLoginBefore) : new Date(),
      );
    }

    const [users, total] = await this.usersRepository.findAndCount({
      where: whereConditions,
      relations: ['roles'],
      order: { [order_by]: order_direction },
      skip,
      take: limit,
    });

    // If role filter is specified, filter results after retrieval
    let filteredUsers = users;
    if (role) {
      filteredUsers = users.filter(user => 
        user.roles.some(userRole => userRole.name === role)
      );
    }

    return {
      data: filteredUsers,
      meta: {
        page,
        limit,
        total: filteredUsers.length === users.length ? total : filteredUsers.length,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Users> {
    const user = await this.usersRepository.findOne({ 
      where: { id },
      relations: ['roles'] 
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, updateDto: AdminUpdateUserDto): Promise<Users> {
    const user = await this.findOne(id);
    
    // Update basic fields
    Object.assign(user, updateDto);

    // Handle role update if provided
    if (updateDto.role) {
      const role = await this.rolesRepository.findOne({
        where: { name: updateDto.role }
      });
      
      if (!role) {
        throw new BadRequestException(`Role ${updateDto.role} not found`);
      }
      
      // Set the new role
      user.roles = [role];
    }

    return this.usersRepository.save(user);
  }

  async toggleUserStatus(id: string, isActive: boolean): Promise<Users> {
    const user = await this.findOne(id);
    user.isActive = isActive;
    return this.usersRepository.save(user);
  }

  async getUserStats(): Promise<any> {
    const totalUsers = await this.usersRepository.count();
    const activeUsers = await this.usersRepository.count({ where: { isActive: true } });
    const verifiedUsers = await this.usersRepository.count({ where: { isEmailVerified: true } });
    
    // Count by role
    const roleCounts = {};
    const roles = Object.values(Role);
    
    for (const role of roles) {
      const roleEntity = await this.rolesRepository.findOne({
        where: { name: role },
        relations: ['users']
      });
      
      roleCounts[role] = roleEntity?.users?.length || 0;
    }
    
    // Get new users in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const newUsers = await this.usersRepository.count({
      where: {
        createdAt: Between(thirtyDaysAgo, new Date())
      }
    });
    
    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      newUsers,
      roleCounts
    };
  }
}