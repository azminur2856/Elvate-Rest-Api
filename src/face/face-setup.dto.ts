import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Text fields of the face setup (multipart, BE-26). */
export class FaceSetupDto {
  /** Current password; omit for Google-only accounts. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;
}
