import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ActivityType } from 'src/auth/enums/activity-type.enum';
import { Users } from 'src/users/users.entity';

export class CreateActionLogDto {
  @IsEnum(ActivityType, { message: 'Invalid action type.' })
  @IsNotEmpty({ message: 'Activity type is required.' })
  activity: ActivityType;

  @IsOptional()
  @IsString({ message: 'Description must be a string.' })
  description?: string;

  @IsOptional()
  user?: Users | null;
}
