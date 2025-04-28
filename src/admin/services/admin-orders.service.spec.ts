import { Test, TestingModule } from '@nestjs/testing';
import { AdminOrdersService } from './admin-orders.service';

describe('AdminOrdersService', () => {
  let service: AdminOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminOrdersService],
    }).compile();

    service = module.get<AdminOrdersService>(AdminOrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
