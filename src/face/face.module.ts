import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaceReference } from './face-reference.entity';
import { FaceReferenceService } from './face-reference.service';
import { Users } from 'src/users/entities/users.entity';
import { UserSession } from 'src/auth/entities/user-session.entity';
import { FaceVerificationService } from 'src/users/services/face-verification.service';
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';
import { MailService } from 'src/auth/services/mail.services';
import { SettingsModule } from 'src/settings/settings.module';

/** SEC-04: Face++ checks + the private face reference, shared by users and auth. */
@Module({
  imports: [
    TypeOrmModule.forFeature([FaceReference, Users, UserSession]),
    ActivityLogsModule,
    SettingsModule,
  ],
  providers: [FaceVerificationService, FaceReferenceService, MailService],
  exports: [FaceVerificationService, FaceReferenceService],
})
export class FaceModule {}
