import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsPhoneNumber,
  MaxLength,
} from 'class-validator';
import { NewPassword } from 'src/common/password';

/** SEC-15: names appear in e-mails and on reviews. */
export const MAX_NAME_LENGTH = 50;

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  firstName: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
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
  @NewPassword() // SEC-21
  password: string;
}
