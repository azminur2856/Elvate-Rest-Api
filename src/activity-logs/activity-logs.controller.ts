import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ActivityLogsService } from './activity-logs.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/users/enums/role.enum';

// Logs are written server-side only (ActivityLogsService.createActivityLog).
// The old public `createUnauthorizedActivityLog` / `createAuthorizedActivityLog`
// endpoints were removed (B-06): unused by the frontend, and they let anyone
// write arbitrary log rows.
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private activityLogsService: ActivityLogsService) {}

  @Roles(Role.ADMIN)
  @Get('stats')
  async getActivityStats() {
    return this.activityLogsService.getActivityStats();
  }

  @Roles(Role.ADMIN)
  @Get('getAllActivityLogs')
  getAllActivityLogs(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '5',
  ) {
    return this.activityLogsService.getAllActivityLogs(
      toPage(page),
      toPageSize(pageSize, 5),
    );
  }

  @Get('user')
  async getUserLogs(
    @Req() req: { user: { id: string } },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '5',
  ) {
    return this.activityLogsService.getUserActivityLog(
      req.user.id,
      toPage(page),
      toPageSize(pageSize, 5),
    );
  }

  @Roles(Role.ADMIN)
  @Get('getUserActivityLogs/:userId')
  getUserActivityLogs(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '5',
  ) {
    return this.activityLogsService.getUserActivityLog(
      userId,
      toPage(page),
      toPageSize(pageSize, 5),
    );
  }

  @Roles(Role.ADMIN)
  @Get('filter')
  async getFilteredActivityLogs(
    @Query('userId') userId?: string,
    @Query('activity') activity?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityLogsService.getFilteredActivityLogs({
      userId,
      activity,
      fromDate,
      toDate,
      page: toPage(page),
      pageSize: toPageSize(pageSize ?? limit, 10),
    });
  }

  @Roles(Role.ADMIN)
  @Get('export')
  async exportLogsToCSV(
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('activity') activity?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const csv = await this.activityLogsService.exportLogsToCSV({
      userId,
      activity,
      fromDate,
      toDate,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=activity_logs.csv',
    );
    res.send(csv);
  }
}

function toPage(value?: string) {
  return Math.max(1, parseInt(value ?? '', 10) || 1);
}

function toPageSize(value: string | undefined, fallback: number) {
  return Math.min(100, Math.max(1, parseInt(value ?? '', 10) || fallback));
}
