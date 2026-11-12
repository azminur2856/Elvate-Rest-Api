import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from './app-setting.entity';
import { SettingsService } from './settings.service';

/** BE-25: admin feature switches (SMS on/off, ...). */
@Module({
  imports: [TypeOrmModule.forFeature([AppSetting])],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
