import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsPhoneNumber,
} from 'class-validator';

export class CreateGoogleUserDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsDateString(
    {},
    { message: 'Date of Birth must be in ISO format (YYYY-MM-DD)' },
  )
  dob?: Date;

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

  @IsNotEmpty()
  isActive: boolean;

  @IsNotEmpty()
  isEmailVerified: boolean;
}
