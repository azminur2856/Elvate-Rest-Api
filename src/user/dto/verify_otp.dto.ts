import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class VerifyOtpDto {
  @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/, {
    message: 'Email must end with .com and contain a valid domain',
  })
  email: string;

  @IsNotEmpty()
  otp: string;
}
