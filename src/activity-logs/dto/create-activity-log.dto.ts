import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { Users } from 'src/users/entities/users.entity';

export class CreateActivityLogDto {
  @IsEnum(ActivityType, { message: 'Invalid action type.' })
  @IsNotEmpty({ message: 'Activity type is required.' })
  activity: ActivityType;

  @IsOptional()
  @IsString({ message: 'Description must be a string.' })
  description?: string;

  @IsOptional()
  user?: Users | null;
}
