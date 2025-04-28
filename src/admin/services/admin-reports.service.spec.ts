import { Test, TestingModule } from '@nestjs/testing';
import { AdminReportsService } from './admin-reports.service';

describe('AdminReportsService', () => {
  let service: AdminReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminReportsService],
    }).compile();

    service = module.get<AdminReportsService>(AdminReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
