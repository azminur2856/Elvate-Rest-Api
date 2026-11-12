import { IsEmail, IsUUID, MaxLength } from 'class-validator';

/** POST /auth/face-login/challenge */
export class FaceChallengeDto {
  @IsEmail()
  @MaxLength(320)
  email: string;
}

/** Text fields of POST /auth/login-with-face (multipart). */
export class FaceLoginDto extends FaceChallengeDto {
  @IsUUID()
  challengeId: string;
}
