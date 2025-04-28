import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsDateString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '../../users/enums/roles.enum';

/**
 * Interface for pagination metadata.
 * @interface PaginationMeta
 * @description Contains information about the current page and total results.
 */
export interface PaginationMeta {
  /**
   * Total number of items
   * @type {number}
   */
  total: number;

  /**
   * Current page number
   * @type {number}
   */
  page: number;

  /**
   * Number of items per page
   * @type {number}
   */
  limit: number;

  /**
   * Total number of pages
   * @type {number}
   */
  totalPages: number;

  /**
   * Optional message associated with the pagination metadata
   * @type {string}
   */
  message?: string;
}

/**
 * Interface for paginated response data.
 * @interface PaginatedResponse
 * @description Generic interface for paginated API responses.
 * @template T - The type of items in the response
 */
export interface PaginatedResponse<T> {
  /**
   * Array of items for the current page
   * @type {T[]}
   */
  items: T[];

  /**
   * Pagination metadata
   * @type {PaginationMeta}
   */
  meta: PaginationMeta;
}

/**
 * Data Transfer Object for admin user queries.
 * @class AdminUserQueryDto
 * @description Defines the structure and validation rules for admin user queries.
 */
export class AdminUserQueryDto {
  /**
   * Page number for pagination.
   * @type {number}
   * @default 1
   */
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * Number of items per page.
   * @type {number}
   * @default 10
   */
  @ApiPropertyOptional({ description: 'Number of items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  /**
   * Search term for filtering users.
   * @type {string}
   */
  @ApiPropertyOptional({ description: 'Search term for firstName, lastName, or email' })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Role filter for users.
   * @type {Role}
   */
  @ApiPropertyOptional({ enum: Role, description: 'Filter by user role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  /**
   * Active status filter.
   * @type {boolean}
   */
  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by email verification status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isEmailVerified?: boolean;

  @ApiPropertyOptional({ description: 'Filter by creation date (after)' })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiPropertyOptional({ description: 'Filter by creation date (before)' })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @ApiPropertyOptional({ description: 'Filter by last login date (after)' })
  @IsOptional()
  @IsDateString()
  lastLoginAfter?: string;

  @ApiPropertyOptional({ description: 'Filter by last login date (before)' })
  @IsOptional()
  @IsDateString()
  lastLoginBefore?: string;

  @ApiPropertyOptional({ 
    description: 'Sort by field',
    enum: ['createdAt', 'lastLoginAt', 'firstName', 'lastName', 'email', 'role']
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ 
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc'
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
