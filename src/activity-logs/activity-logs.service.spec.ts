import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLog } from './entities/activity-logs.entity';
import { ActivityType } from './enums/activity-type.enum';

const USER_ID = '7f6d4585-c888-4629-b85e-6563e0173402';
const createdAt = new Date('2026-11-11T10:00:00.000Z');
const log = (description: string) => ({
  id: 1,
  activity: ActivityType.USER_LOGIN,
  description,
  createdAt,
  user: { id: USER_ID, firstName: 'Test', lastName: 'Buyer' },
});

describe('ActivityLogsService', () => {
  let service: ActivityLogsService;
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    findAndCount: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ActivityLogsService,
        { provide: getRepositoryToken(ActivityLog), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(ActivityLogsService);
  });

  describe('getFilteredActivityLogs', () => {
    it('rejects a malformed userId with 400 (not 500)', async () => {
      await expect(
        service.getFilteredActivityLogs({ userId: 'nope' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown activity type and an inverted date range with 400', async () => {
      await expect(
        service.getFilteredActivityLogs({ activity: 'NOT_A_TYPE' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.getFilteredActivityLogs({
          fromDate: '2026-11-12',
          toDate: '2026-11-11',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('pages with pageSize and returns userFullName', async () => {
      qb.getManyAndCount.mockResolvedValue([[log('hi')], 21]);
      const res = await service.getFilteredActivityLogs({
        userId: USER_ID,
        page: 3,
        pageSize: 10,
      });
      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(res).toMatchObject({
        page: 3,
        pageSize: 10,
        limit: 10,
        total: 21,
        totalPages: 3,
      });
      expect(res.data[0]).toMatchObject({
        userId: USER_ID,
        userFullName: 'Test Buyer',
        createdAt,
      });
    });
  });

  describe('exportLogsToCSV', () => {
    it('quotes cells that contain commas, quotes or line breaks', async () => {
      qb.getMany.mockResolvedValue([log('a, "b"\nc')]);
      const csv = await service.exportLogsToCSV({});
      const [header, row] = csv.split(/\n(?=1,)/);
      expect(header).toBe('ID,Activity,Description,CreatedAt,UserID,UserName');
      expect(row).toBe(
        `1,USER_LOGIN,"a, ""b""\nc",2026-11-11T10:00:00.000Z,${USER_ID},Test Buyer`,
      );
    });

    it('returns 404 when nothing matches', async () => {
      qb.getMany.mockResolvedValue([]);
      await expect(service.exportLogsToCSV({})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getUserActivityLog', () => {
    it('returns createdAt unchanged (true UTC, no +6 h)', async () => {
      repo.findAndCount.mockResolvedValue([[log('x')], 1]);
      const res = await service.getUserActivityLog(USER_ID, 1, 5);
      expect(res.logs[0].createdAt).toEqual(createdAt);
      expect(res).toMatchObject({ total: 1, page: 1, pageSize: 5 });
    });

    it('rejects a malformed user id with 400', async () => {
      await expect(service.getUserActivityLog('bad')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
