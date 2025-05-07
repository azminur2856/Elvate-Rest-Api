import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RequestOtpDto {
  // @IsEmail()
  @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/, {
    message: 'Email must end with .com and contain a valid domain',
  })
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
