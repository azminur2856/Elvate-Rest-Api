import { Test, TestingModule } from '@nestjs/testing';
import { AdminProductsService } from './admin-products.service';

describe('AdminProductsService', () => {
  let service: AdminProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminProductsService],
    }).compile();

    service = module.get<AdminProductsService>(AdminProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
