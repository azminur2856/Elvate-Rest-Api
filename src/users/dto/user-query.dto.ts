import { IsOptional, IsEnum, IsInt, Min, IsString } from 'class-validator';
import { OrderDirection } from 'src/users/enums/order-direction.enum';

export class UserQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Page number must be greater than or equal to 1' })
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Limit must be greater than or equal to 1' })
  limit: number = 10;

  @IsOptional()
  @IsString()
  order_by: string = 'created_at';

  @IsOptional()
  @IsEnum(OrderDirection) 
  order_direction: OrderDirection = OrderDirection.DESC; 
}
