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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users with filtering and pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns users list with pagination' })
  async findAll(@Query() queryDto: AdminUserQueryDto) {
    return this.adminUserService.findAll(queryDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns user statistics' })
  async getUserStats() {
    return this.adminUserService.getUserStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns the user' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUserService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns the updated user' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: AdminUpdateUserDto,
  ) {
    return this.adminUserService.update(id, updateDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or deactivate a user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns the updated user' })
  @HttpCode(HttpStatus.OK)
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.adminUserService.toggleUserStatus(id, isActive);
  }
}