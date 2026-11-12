import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { VerificationMethod } from '../enums/verification-method.enum';
import { NewPassword } from 'src/common/password';

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  resetTokenOrOTP: string;

  @IsNotEmpty()
  @NewPassword() // SEC-21
  newPassword: string;

  @IsOptional()
  @IsEnum(VerificationMethod, {
    message: 'Verification Method must be either EMAIL or SMS',
  })
  verificationMethod?: VerificationMethod = VerificationMethod.EMAIL; // Default to EMAIL

  /**
   * SEC-05: required with SMS, so a 6-digit code only works for the account
   * it was sent to (not "any user's code"). Ignored for e-mail links.
   */
  @ValidateIf(
    (o: ResetPasswordDto) => o.verificationMethod === VerificationMethod.SMS,
  )
  @IsEmail({}, { message: 'email is required to reset with an SMS code' })
  email?: string;
}
