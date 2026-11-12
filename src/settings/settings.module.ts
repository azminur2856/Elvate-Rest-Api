import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from './app-setting.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';

/** BE-25: admin feature switches (SMS on/off, ...). */
@Module({
  imports: [TypeOrmModule.forFeature([AppSetting]), ActivityLogsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
