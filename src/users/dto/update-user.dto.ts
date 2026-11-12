import {
  IsOptional,
  IsString,
  IsPhoneNumber,
  MaxLength,
} from 'class-validator';
import { MAX_NAME_LENGTH } from './create-user.dto';

/**
 * Fields a user may change on their own profile (PATCH /users/updateUser).
 * Role, status, verification flags, password and profile image have their
 * own guarded endpoints and must never be settable here.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  lastName?: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber('BD', {
    message: 'Phone number must be a valid Bangladeshi phone number',
  })
  phone?: string;
}
