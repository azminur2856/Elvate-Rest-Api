// admin-user.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdminUserService } from '../services/admin-user.service';
import { AdminUpdateUserDto } from '../dto/admin-user.dto';
import { AdminUserQueryDto } from '../dto/admin-user-query.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard'; 
import { Roles } from 'src/auth/decorators/roles.decorator'; 
import { Role } from 'src/users/enums/roles.enum';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiParam, ApiBody, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';

/**
 * Controller handling admin user management operations.
 */
@ApiTags('E. Admin - User Management')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  /**
   * Retrieves all users with optional filtering and pagination.
   * @param query - Query parameters for filtering and pagination
   * @returns Promise<PaginatedResponse<Users>> - Users and pagination metadata
   */
  @Get()
  @ApiOperation({ summary: 'Get all users with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of users retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  async findAll(@Query() queryDto: AdminUserQueryDto) {
    return this.adminUserService.findAll(queryDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User statistics retrieved successfully' })
  async getStats() {
    return this.adminUserService.getStats();
  }

  /**
   * Retrieves a user by ID.
   * @param id - User ID
   * @returns Promise<Users> - The found user
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUserService.findOne(id);
  }

  /**
   * Updates a user's information.
   * @param id - User ID
   * @param updateUserDto - Data for updating the user
   * @returns Promise<Users> - The updated user
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User updated successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: AdminUpdateUserDto,
  ) {
    return this.adminUserService.update(id, updateDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Set user active status' })
  @ApiParam({ name: 'id', description: 'User ID', type: 'string', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        isActive: {
          type: 'boolean',
          description: 'Set to true to activate the user, false to deactivate',
          example: true
        }
      },
      required: ['isActive']
    }
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'User status updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @HttpCode(HttpStatus.OK)
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.adminUserService.setStatus(id, isActive);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiParam({ name: 'id', description: 'User ID', type: 'string', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: Object.values(Role),
          description: 'New role for the user',
          example: 'ADMIN'
        }
      },
      required: ['role']
    }
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'User role updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @HttpCode(HttpStatus.OK)
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role') role: Role,
  ) {
    return this.adminUserService.updateUserRole(id, role);
  }
}