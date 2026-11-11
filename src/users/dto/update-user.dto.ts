import { IsOptional, IsString, IsPhoneNumber } from 'class-validator';

/**
 * Fields a user may change on their own profile (PATCH /users/updateUser).
 * Role, status, verification flags, password and profile image have their
 * own guarded endpoints and must never be settable here.
 */
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
}
