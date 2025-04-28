import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/users/enums/role.enum';

@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private activityLogsService: ActivityLogsService) {}

  @Roles(Role.ADMIN)
  @Get('getAllActivityLogs')
  getAllActivityLogs() {
    return this.activityLogsService.getAllActivityLogs();
  }

  @Roles(Role.ADMIN)
  @Get('getUserActivityLogs/:userId')
  getUserActivityLogs(@Param('userId') userId: string) {
    return this.activityLogsService.getUserActivityLog(userId);
  }

  @Post('createAuthorizedActivityLog')
  createAuthorizedActivityLog(
    @Req() req: any,
    @Body(ValidationPipe) createActivityLogDto: CreateActivityLogDto,
  ) {
    createActivityLogDto.user = req.user;
    return this.activityLogsService.createActivityLog(createActivityLogDto);
  }

  @Public()
  @Post('createUnauthorizedActivityLog')
  async createUnauthorizedActionLog(
    @Body(ValidationPipe) createActivityLogDto: CreateActivityLogDto,
  ) {
    createActivityLogDto.user = null;
    return this.activityLogsService.createActivityLog(createActivityLogDto);
  }
}
