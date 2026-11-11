import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Password accounts send `{ password }`; Google-only accounts send `{ confirm: "DELETE" }`. */
export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  confirm?: string;
}
