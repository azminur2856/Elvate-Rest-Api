import { Test, TestingModule } from '@nestjs/testing';
import { AdminProductsController } from './admin-products.controller';

describe('AdminProductsController', () => {
  let controller: AdminProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminProductsController],
    }).compile();

    controller = module.get<AdminProductsController>(AdminProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
