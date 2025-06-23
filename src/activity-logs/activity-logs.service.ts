import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActivityLog } from './entities/activity-logs.entity';
import { Repository } from 'typeorm';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { ActivityType } from './enums/activity-type.enum';

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
  async getUserActivityLog(userId: string, page = 1, pageSize = 5) {
    if (userId.length !== 36) {
      return {
        message: 'Invalid user ID format. Please provide a valid UUID.',
      };
    }
    const [activityLogs, total] =
      await this.activityLogsRepository.findAndCount({
        where: { user: { id: userId } },
        order: { id: 'DESC' },
        relations: ['user'],
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

    const logs = activityLogs.map((log) => ({
      id: log.id,
      activity: log.activity,
      description: log.description,
      createdAt: new Date(
        new Date(log.createdAt).getTime() + 6 * 60 * 60 * 1000,
      ),
      userId: log.user ? log.user.id : null,
    }));

    return {
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // Get filtered activity logs with pagination
  async getFilteredActivityLogs(filters: {
    userId?: string;
    activity?: ActivityType;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const query = this.activityLogsRepository
        .createQueryBuilder('log')
        .leftJoinAndSelect('log.user', 'user')
        .orderBy('log.id', 'DESC');

      if (filters.userId) {
        if (filters.userId.length !== 36) {
          throw new BadRequestException(
            'Invalid user ID format. Please provide a valid UUID.',
          );
        }
        query.andWhere('user.id = :userId', { userId: filters.userId });
      }

      if (filters.activity) {
        if (!Object.values(ActivityType).includes(filters.activity)) {
          throw new BadRequestException(
            `Invalid activity type: ${filters.activity}. Valid activity types are: ${Object.values(ActivityType).join(', ')}`,
          );
        }
        query.andWhere('log.activity = :activity', {
          activity: filters.activity,
        });
      }

      if (filters.fromDate) {
        const date = new Date(filters.fromDate);
        if (isNaN(date.getTime())) {
          throw new BadRequestException(
            'Invalid fromDate format. Type of date: YYYY-MM-DD',
          );
        }
        query.andWhere('log.createdAt >= :fromDate', { fromDate: date });
      }

      if (filters.toDate) {
        const date = new Date(filters.toDate);
        if (isNaN(date.getTime())) {
          throw new BadRequestException(
            'Invalid toDate format. Type of date: YYYY-MM-DD',
          );
        }
        query.andWhere('log.createdAt <= :toDate', { toDate: date });
      }

      if (filters.fromDate && filters.toDate) {
        const fromDate = new Date(filters.fromDate);
        const toDate = new Date(filters.toDate);
        if (fromDate > toDate) {
          throw new BadRequestException(
            'fromDate cannot be greater than toDate.',
          );
        }
      }

      if (filters.limit && !filters.page) {
        throw new BadRequestException(
          'Page number is required when limit is provided. Please provide a valid page number. Page number starts from 1.',
        );
      }

      const page = filters.page ?? 1;
      const limit = filters.limit ?? 10;
      const skip = (page - 1) * limit;

      query.skip(skip).take(limit);

      const [logs, total] = await query.getManyAndCount();

      return {
        data: logs.map((log) => ({
          id: log.id,
          activity: log.activity,
          description: log.description,
          createdAt: log.createdAt,
          userId: log.user?.id ?? null,
        })),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    } catch (err) {
      throw new InternalServerErrorException(
        err.message || 'Unexpected error occurred',
      );
    }
  }

  // Export activity logs to CSV
  async exportLogsToCSV(filters: {
    userId?: string;
    activity?: ActivityType;
    fromDate?: string;
    toDate?: string;
  }) {
    try {
      const query = this.activityLogsRepository
        .createQueryBuilder('log')
        .leftJoinAndSelect('log.user', 'user')
        .orderBy('log.id', 'ASC');

      if (filters.userId) {
        if (filters.userId.length !== 36) {
          throw new BadRequestException(
            'Invalid user ID format. Please provide a valid UUID.',
          );
        }
        query.andWhere('user.id = :userId', { userId: filters.userId });
      }

      if (filters.activity) {
        if (!Object.values(ActivityType).includes(filters.activity)) {
          throw new BadRequestException(
            `Invalid activity type: ${filters.activity}. Valid activity types are: ${Object.values(ActivityType).join(', ')}`,
          );
        }
        query.andWhere('log.activity = :activity', {
          activity: filters.activity,
        });
      }

      if (filters.fromDate) {
        const date = new Date(filters.fromDate);
        if (isNaN(date.getTime())) {
          throw new BadRequestException(
            'Invalid fromDate format. Type of date: YYYY-MM-DD',
          );
        }
        query.andWhere('log.createdAt >= :fromDate', { fromDate: date });
      }

      if (filters.toDate) {
        const date = new Date(filters.toDate);
        if (isNaN(date.getTime())) {
          throw new BadRequestException(
            'Invalid toDate format. Type of date: YYYY-MM-DD',
          );
        }
        query.andWhere('log.createdAt <= :toDate', { toDate: date });
      }

      const logs = await query.getMany();

      if (!logs.length) {
        throw new NotFoundException('No logs found for the provided filters.');
      }

      const header = ['ID', 'Activity', 'Description', 'CreatedAt', 'UserID'];
      const rows = logs.map((log) => [
        log.id,
        log.activity,
        log.description ?? '',
        log.createdAt.toISOString(),
        log.user?.id ?? '',
      ]);

      const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
      return csv;
    } catch (err) {
      throw new InternalServerErrorException(
        err.message || 'Unexpected error occurred',
      );
    }
  }
}
