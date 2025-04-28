import { Controller, Get, Param } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';

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
}
