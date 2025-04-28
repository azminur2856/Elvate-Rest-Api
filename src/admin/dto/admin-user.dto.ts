import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Role } from 'src/users/enums/roles.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate } from 'class-validator';

/**
 * Data Transfer Object for updating user information by admin.
 * @class AdminUpdateUserDto
 * @description Defines the structure and validation rules for admin user updates.
 */
export class AdminUpdateUserDto {
  /**
   * User's first name.
   * @type {string}
   */
  @ApiPropertyOptional({ description: 'User first name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  /**
   * User's last name.
   * @type {string}
   */
  @ApiPropertyOptional({ description: 'User last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  /**
   * User's date of birth.
   * @type {Date}
   */
  @ApiPropertyOptional({ description: 'User date of birth' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dob?: Date;

  /**
   * User's email address.
   * @type {string}
   */
  @ApiPropertyOptional({ description: 'User email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  /**
   * User's phone number.
   * @type {string}
   */
  @ApiPropertyOptional({ description: 'User phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  /**
   * User's role.
   * @type {Role}
   */
  @ApiPropertyOptional({ description: 'User role', enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  /**
   * User's active status.
   * @type {boolean}
   */
  @ApiPropertyOptional({ description: 'User active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * User's email verification status.
   * @type {boolean}
   */
  @ApiPropertyOptional({ description: 'User email verification status' })
  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @ApiProperty({
    description: 'User phone verification status',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  isPhoneVerified?: boolean;
}

