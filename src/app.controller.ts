import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppService, RootInfo } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Welcome message, database status, deployed version, server time and useful links. */
  @Public()
  @Get()
  root(@Req() req: Request): Promise<RootInfo> {
    // trust proxy is on (main.ts), so Render's https shows as https here
    return this.appService.info(`${req.protocol}://${req.get('host')}`);
  }
}
