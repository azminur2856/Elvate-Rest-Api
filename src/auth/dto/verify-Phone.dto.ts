import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPhoneDto {
  @IsNotEmpty()
  @IsString()
  otp: string;
}
