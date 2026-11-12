import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { SettingsService } from './settings.service';
import { Public } from 'src/auth/decorators/public.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/users/enums/role.enum';
import type { AuthRequest } from 'src/common/auth-user';

export class UpdateSettingDto {
  @IsBoolean()
  enabled: boolean;
}

/** BE-25 admin feature switches. */
@ApiTags('Settings')
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** What the UI needs to show or hide features (no secrets). */
  @Public()
  @Get('settings/public')
  publicSettings() {
    return this.settings.publicSettings();
  }

  /** ADMIN only (not STAFF). */
  @Roles(Role.ADMIN)
  @Get('admin/settings')
  list() {
    return this.settings.list();
  }

  /** ADMIN only. 409 when turning on a switch that is not available. */
  @Roles(Role.ADMIN)
  @Patch('admin/settings/:key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @Req() req: AuthRequest,
  ) {
    return this.settings.update(key, dto.enabled, req.user);
  }
}
