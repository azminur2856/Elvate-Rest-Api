import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsPhoneNumber,
} from 'class-validator';
import { Role } from 'src/users/enums/role.enum';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsNotEmpty()
  @IsDateString(
    {},
    { message: 'Date of Birth must be in ISO format (YYYY-MM-DD)' },
  )
  dob: Date;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber('BD', {
    message: 'Phone number must be a valid Bangladeshi phone number',
  })
  phone?: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  profileImage?: string;
}
