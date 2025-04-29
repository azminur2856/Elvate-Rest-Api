import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
} from 'class-validator';
import { VerificationMethod } from '../enums/verification-method.enum';

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  resetTokenOrOTP: string;

  @IsNotEmpty()
  @IsString()
  @IsStrongPassword()
  newPassword: string;

  @IsOptional()
  @IsEnum(VerificationMethod, {
    message: 'Verification Method must be either EMAIL or SMS',
  })
  verificationMethod?: VerificationMethod = VerificationMethod.EMAIL; // Default to EMAIL
}
