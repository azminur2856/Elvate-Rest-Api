import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionController', () => {
  it('should be defined', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [
        { provide: SubscriptionService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    expect(moduleRef.get(SubscriptionController)).toBeDefined();
  });
});
