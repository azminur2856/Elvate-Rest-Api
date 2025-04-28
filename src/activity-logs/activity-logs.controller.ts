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

@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private activityLogsService: ActivityLogsService) {}

  @Get('getAllActivityLogs')
  getAllActivityLogs() {
    return this.activityLogsService.getAllActivityLogs();
  }

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

  //Public route for creating unauthorized action logs
  @Post('createUnauthorizedActivityLog')
  async createUnauthorizedActionLog(
    @Body(ValidationPipe) createActivityLogDto: CreateActivityLogDto,
  ) {
    createActivityLogDto.user = null;
    return this.activityLogsService.createActivityLog(createActivityLogDto);
  }
}
