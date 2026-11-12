import { IsNotEmpty, IsString } from 'class-validator';
import { NewPassword } from 'src/common/password';

export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  oldPassword: string;

  @IsNotEmpty()
  @NewPassword() // SEC-21
  newPassword: string;
}
