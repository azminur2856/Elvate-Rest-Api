import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { OrdersService } from 'src/orders/orders.service';

describe('SubscriptionController', () => {
  it('should be defined', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [
        { provide: SubscriptionService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: OrdersService, useValue: {} },
      ],
    }).compile();
    expect(moduleRef.get(SubscriptionController)).toBeDefined();
  });
});
