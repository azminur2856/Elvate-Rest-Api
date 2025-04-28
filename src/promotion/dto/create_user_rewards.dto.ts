import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateUserRewardsDto {
  @IsNumber()
  user_id: number;

  @IsNumber()
  balance: number;

  @IsNumber()
  points: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsNumber()
  order_id?: number;
}
