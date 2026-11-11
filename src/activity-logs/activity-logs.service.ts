import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { ActivityLog } from './entities/activity-logs.entity';
import { Repository } from 'typeorm';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { ActivityType } from './enums/activity-type.enum';

type LogFilters = {
  userId?: string;
  activity?: string;
  fromDate?: string;
  toDate?: string;
};

const isActivityType = (v: string): v is ActivityType =>
  (Object.values(ActivityType) as string[]).includes(v);

function parseDateParam(value: string | undefined, name: string) {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new BadRequestException(
      `Invalid ${name} format. Type of date: YYYY-MM-DD`,
    );
  }
  return date;
}

function fullName(user?: { firstName?: string; lastName?: string } | null) {
  return user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : null;
}

/** RFC 4180 cell: quote when it contains a comma, quote or line break. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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
  async getAllActivityLogs(page = 1, pageSize = 5) {
    const [activityLogs, total] =
      await this.activityLogsRepository.findAndCount({
        order: { id: 'DESC' },
        relations: ['user'],
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

    const logs = activityLogs.map((log) => ({
      id: log.id,
      activity: log.activity,
      description: log.description,
      createdAt: log.createdAt,
      userId: log.user ? log.user.id : null,
      userFullName: log.user
        ? `${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`.trim()
        : null,
    }));

    return {
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // Get activity logs for a specific user
  async getUserActivityLog(userId: string, page = 1, pageSize = 5) {
    if (!isUUID(userId)) {
      throw new BadRequestException(
        'Invalid user ID format. Please provide a valid UUID.',
      );
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
      createdAt: log.createdAt, // true UTC; the frontend formats it locally
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

  /**
   * Shared by the filtered list and the CSV export. Bad input is a 400; any
   * HttpException propagates as-is (the old code wrapped them all in a 500).
   */
  private filteredLogsQuery(filters: LogFilters, order: 'ASC' | 'DESC') {
    const query = this.activityLogsRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.id', order);

    if (filters.userId) {
      if (!isUUID(filters.userId)) {
        throw new BadRequestException(
          'Invalid user ID format. Please provide a valid UUID.',
        );
      }
      query.andWhere('user.id = :userId', { userId: filters.userId });
    }

    if (filters.activity) {
      if (!isActivityType(filters.activity)) {
        throw new BadRequestException(
          `Invalid activity type: ${filters.activity}. Valid activity types are: ${Object.values(ActivityType).join(', ')}`,
        );
      }
      query.andWhere('log.activity = :activity', {
        activity: filters.activity,
      });
    }

    const from = parseDateParam(filters.fromDate, 'fromDate');
    const to = parseDateParam(filters.toDate, 'toDate');
    if (from && to && from > to) {
      throw new BadRequestException('fromDate cannot be greater than toDate.');
    }
    if (from) query.andWhere('log.createdAt >= :fromDate', { fromDate: from });
    if (to) query.andWhere('log.createdAt <= :toDate', { toDate: to });

    return query;
  }

  // Get filtered activity logs (admin). `pageSize` and `limit` are aliases.
  async getFilteredActivityLogs(
    filters: LogFilters & { page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, Math.floor(filters.page || 1));
    const limit = Math.min(
      100,
      Math.max(1, Math.floor(filters.pageSize || 10)),
    );

    const [logs, total] = await this.filteredLogsQuery(filters, 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: logs.map((log) => ({
        id: log.id,
        activity: log.activity,
        description: log.description,
        createdAt: log.createdAt,
        userId: log.user?.id ?? null,
        userFullName: fullName(log.user),
      })),
      page,
      limit,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Export activity logs to CSV (RFC 4180 quoting, so commas/quotes/newlines
  // in descriptions no longer break the columns).
  async exportLogsToCSV(filters: LogFilters) {
    const logs = await this.filteredLogsQuery(filters, 'ASC').getMany();
    if (logs.length === 0) {
      throw new NotFoundException('No logs found for the provided filters.');
    }

    const header = [
      'ID',
      'Activity',
      'Description',
      'CreatedAt',
      'UserID',
      'UserName',
    ];
    const rows = logs.map((log) => [
      log.id,
      log.activity,
      log.description ?? '',
      log.createdAt.toISOString(),
      log.user?.id ?? '',
      fullName(log.user) ?? '',
    ]);
    return [header, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\n');
  }

  async getActivityStats() {
    // 1. Total activity logs
    const totalLogs = await this.activityLogsRepository.count();

    // 2. Count by activity type
    const countByTypeRaw = await this.activityLogsRepository
      .createQueryBuilder('log')
      .select('log.activity', 'activity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.activity')
      .getRawMany();

    const countByType: Record<string, number> = {};
    for (const row of countByTypeRaw) {
      countByType[row.activity] = parseInt(row.count, 10);
    }

    // 3. Count by day (last 7 days)
    const countByDayRaw = await this.activityLogsRepository
      .createQueryBuilder('log')
      .select("TO_CHAR(log.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where("log.createdAt >= NOW() - INTERVAL '7 day'")
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    const countByDay = countByDayRaw.map((row) => ({
      date: row.date,
      count: parseInt(row.count, 10),
    }));

    // 4. Top 5 most active users
    const topUsersRaw = await this.activityLogsRepository
      .createQueryBuilder('log')
      .leftJoin('log.user', 'user')
      .select('user.id', 'userId')
      .addSelect('user.firstName', 'firstName')
      .addSelect('user.lastName', 'lastName')
      .addSelect('COUNT(log.id)', 'activityCount')
      .where('user.id IS NOT NULL')
      .groupBy('user.id')
      .addGroupBy('user.firstName')
      .addGroupBy('user.lastName')
      .orderBy('COUNT(log.id)', 'DESC')
      .limit(5)
      .getRawMany();

    const topUsers = topUsersRaw.map((u) => ({
      userId: u.userId,
      firstName: u.firstName,
      lastName: u.lastName,
      activityCount: Number(u.activityCount),
    }));

    // 5. Recent 10 activities (with user name)
    const recentActivitiesRaw = await this.activityLogsRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const recentActivities = recentActivitiesRaw.map((log) => ({
      id: log.id,
      activity: log.activity,
      description: log.description,
      createdAt: log.createdAt,
      userId: log.user ? log.user.id : null,
      userFullName: log.user
        ? `${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`.trim()
        : null,
    }));

    // 6. Admin and user actions (safe for null users)
    const adminActionsRaw = await this.activityLogsRepository
      .createQueryBuilder('log')
      .leftJoin('log.user', 'user')
      .select('COUNT(*)', 'count')
      .where('user.role = :role', { role: 'ADMIN' })
      .getRawOne();

    const userActionsRaw = await this.activityLogsRepository
      .createQueryBuilder('log')
      .leftJoin('log.user', 'user')
      .select('COUNT(*)', 'count')
      .where('user.role != :role OR user.role IS NULL', { role: 'ADMIN' })
      .getRawOne();

    return {
      totalLogs,
      countByType,
      countByDay,
      topUsers,
      recentActivities,
      adminActions: adminActionsRaw ? Number(adminActionsRaw.count) : 0,
      userActions: userActionsRaw ? Number(userActionsRaw.count) : 0,
    };
  }
}
