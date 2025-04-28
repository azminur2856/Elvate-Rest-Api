import {
  IsEmail,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsPhoneNumber,
} from 'class-validator';
import { Role } from 'src/users/enums/role.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber('BD', {
    message: 'Phone number must be a valid Bangladeshi phone number',
  })
  phone?: string;

  @IsOptional()
  isPhoneVerified?: boolean;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  profileImage?: string;
}
