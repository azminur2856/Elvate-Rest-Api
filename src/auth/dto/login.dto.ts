import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator"
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for user login.
 * @class LoginDto
 * @description Defines the structure and validation rules for login requests.
 */
export class LoginDto {
  /**
   * User's email address.
   * @type {string}
   */
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com'
  })
  @IsEmail()
  email: string;

  /**
   * User's password.
   * @type {string}
   */
  @ApiProperty({
    description: 'User password',
    example: 'password123'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
