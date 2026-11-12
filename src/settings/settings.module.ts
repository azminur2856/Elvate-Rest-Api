import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from './app-setting.entity';
import { ShippingSetting } from './shipping-setting.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';

/** BE-25: admin feature switches (SMS on/off, ...); BE-30: delivery fees. */
@Module({
  imports: [
    TypeOrmModule.forFeature([AppSetting, ShippingSetting]),
    ActivityLogsModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
