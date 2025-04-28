import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActivityLog } from './entities/activity-logs.entity';
import { Repository } from 'typeorm';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogsRepository: Repository<ActivityLog>,
  ) {}

  // Create activity log
  async createActivityLog(createActivityLogDto: CreateActivityLogDto) {
    const dataToCreate = {
      ...createActivityLogDto,
      user: createActivityLogDto.user ?? undefined,
    };
    const activityLog = this.activityLogsRepository.create(dataToCreate);
    await this.activityLogsRepository.save(activityLog);
    return {
      id: activityLog.id,
      activity: activityLog.activity,
      description: activityLog.description,
      createAt: activityLog.createdAt,
      userId: activityLog.user ? activityLog.user.id : null,
    };
  }

  // Get all activity logs
  async getAllActivityLogs() {
    const activityLogs = await this.activityLogsRepository.find({
      order: { id: 'DESC' },
      relations: ['user'], // Include the user relation to get user details
    });
    const actionLogsFiltered = activityLogs.map((log) => {
      return {
        id: log.id,
        activity: log.activity,
        description: log.description,
        createdAt: log.createdAt,
        userId: log.user ? log.user.id : null,
      };
    });
    return actionLogsFiltered;
  }

  // Get activity logs for a specific user
  async getUserActivityLog(userId: string) {
    if (userId.length !== 36) {
      return {
        message: 'Invalid user ID format. Please provide a valid UUID.',
      };
    }
    const activityLogs = await this.activityLogsRepository.find({
      where: { user: { id: userId } },
      order: { id: 'DESC' },
      relations: ['user'], // Include the user relation to get user details
    });

    const activityLogsFiltered = activityLogs.map((log) => {
      return {
        id: log.id,
        activity: log.activity,
        description: log.description,
        createdAt: log.createdAt,
        userId: log.user ? log.user.id : null,
      };
    });
    if (activityLogsFiltered.length === 0) {
      throw new NotFoundException(`No activity logs found for user ${userId}`);
    }
    return activityLogsFiltered;
  }
}
