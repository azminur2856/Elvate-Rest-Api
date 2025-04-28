import { IsInt, Min, IsOptional } from 'class-validator';

export class UpdateUserCartDto {
  @IsOptional()
  @IsInt()
  variant_id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity: number;
}
