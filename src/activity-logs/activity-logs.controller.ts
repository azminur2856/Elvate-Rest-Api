import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { ActivityLogsService } from './activity-logs.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/users/enums/role.enum';
import { ActivityType } from './enums/activity-type.enum';

@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private activityLogsService: ActivityLogsService) {}

  @Roles(Role.ADMIN)
  @Get('getAllActivityLogs')
  getAllActivityLogs() {
    return this.activityLogsService.getAllActivityLogs();
  }

  //@Roles(Role.ADMIN)
  @Public()
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

  @Public()
  @Get('filter')
  async getFilteredActivityLogs(
    @Query('userId') userId?: string,
    @Query('activity') activity?: ActivityType,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.activityLogsService.getFilteredActivityLogs({
      userId,
      activity,
      fromDate,
      toDate,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Public()
  @Get('export')
  async exportLogsToCSV(
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('activity') activity?: ActivityType,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const csv = await this.activityLogsService.exportLogsToCSV({
      userId,
      activity,
      fromDate,
      toDate,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=activity_logs.csv',
    );
    res.send(csv);
  }
}
