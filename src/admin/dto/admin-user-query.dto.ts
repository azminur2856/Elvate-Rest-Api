import { IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { UserQueryDto } from 'src/users/dto/user-query.dto';
import { Role } from 'src/users/enums/roles.enum';

export class AdminUserQueryDto extends UserQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @IsOptional()
  @IsDateString()
  lastLoginAfter?: string;

  @IsOptional()
  @IsDateString()
  lastLoginBefore?: string;
}