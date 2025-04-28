import { IsInt, Min } from 'class-validator';

export class CreateUserCartDto {
  @IsInt()
  user_id: number;

  @IsInt()
  variant_id: number;

  @IsInt()
  @Min(1)
  quantity: number;
}
