import { Test } from '@nestjs/testing';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';

describe('ActivityLogsController', () => {
  const service = {
    getFilteredActivityLogs: jest.fn(),
    getUserActivityLog: jest.fn(),
  };
  let controller: ActivityLogsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ActivityLogsController],
      providers: [{ provide: ActivityLogsService, useValue: service }],
    }).compile();
    controller = moduleRef.get(ActivityLogsController);
  });

  it('filter: pageSize wins over the legacy limit alias, capped at 100', async () => {
    await controller.getFilteredActivityLogs(
      undefined,
      undefined,
      undefined,
      undefined,
      '2',
      '500',
      '7',
    );
    expect(service.getFilteredActivityLogs).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 100 }),
    );
  });

  it('filter: falls back to limit when pageSize is absent', async () => {
    await controller.getFilteredActivityLogs(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '7',
    );
    expect(service.getFilteredActivityLogs).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 7 }),
    );
  });

  it('getUserActivityLogs/:userId passes page + pageSize through', () => {
    controller.getUserActivityLogs('some-id', '3', '20');
    expect(service.getUserActivityLog).toHaveBeenCalledWith('some-id', 3, 20);
  });
});
