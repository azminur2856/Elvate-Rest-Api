import { IsEnum, IsString } from 'class-validator';
import { Role } from '../../auth/enums/role.enum';

export class UpdateUserRoleDto {
  @IsString()
  @IsEnum(Role)
  role: Role;
}
