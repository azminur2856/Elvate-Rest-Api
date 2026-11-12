import { ApiBody, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { SettingsService } from './settings.service';
import { ShippingSettingsService } from './shipping-settings.service';
import { UpdateShippingDto, shippingBodyPipe } from './shipping-settings.dto';
import type { ShippingRules } from './shipping-rules';
import { Public } from 'src/auth/decorators/public.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/users/enums/role.enum';
import type { AuthRequest } from 'src/common/auth-user';

export class UpdateSettingDto {
  @IsBoolean()
  enabled: boolean;
}

/** BE-25 admin feature switches; BE-30 delivery fees. */
@ApiTags('Settings')
@Controller()
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly shipping: ShippingSettingsService,
  ) {}

  /** What the UI needs to show or hide features (no secrets). */
  @Public()
  @Get('settings/public')
  async publicSettings() {
    return {
      ...(await this.settings.publicSettings()),
      // BE-30: for the free-delivery notes (freeThreshold 0 = off)
      shipping: await this.shipping.rules(),
    };
  }

  /** ADMIN only (not STAFF). */
  @Roles(Role.ADMIN)
  @Get('admin/settings')
  list() {
    return this.settings.list();
  }

  /** The delivery fees and who changed them last. ADMIN only (not STAFF). */
  @Roles(Role.ADMIN)
  @Get('admin/settings/shipping')
  shippingSettings() {
    return this.shipping.view();
  }

  // BE-30: declared before `:key` below, so "shipping" is never taken for a
  // switch key (routes match in the order they are declared).
  /**
   * Change the delivery fees (whole BDT; freeThreshold 0 = free delivery off).
   * New quotes and orders use them; orders already placed keep their fee.
   * ADMIN only (not STAFF).
   */
  @Roles(Role.ADMIN)
  @Patch('admin/settings/shipping')
  @ApiBody({ type: UpdateShippingDto })
  updateShipping(
    @Body(shippingBodyPipe) body: ShippingRules,
    @Req() req: AuthRequest,
  ) {
    return this.shipping.update(body, req.user);
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
