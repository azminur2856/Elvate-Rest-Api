import { Test, TestingModule } from '@nestjs/testing';
import { AdminReportsController } from './admin-reports.controller';

describe('AdminReportsController', () => {
  let controller: AdminReportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminReportsController],
    }).compile();

    controller = module.get<AdminReportsController>(AdminReportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
