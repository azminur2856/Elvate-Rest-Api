import { IsEmail, MinLength } from 'class-validator';

export class RequestOtpDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;
}
