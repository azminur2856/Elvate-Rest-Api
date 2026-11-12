import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: { isInitialized: true, query: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('keeps the welcome text and links to the same address', async () => {
      const req = {
        protocol: 'http',
        get: () => 'localhost:8000',
      } as unknown as Request;
      await expect(appController.root(req)).resolves.toMatchObject({
        message: 'Welcome to ELVATE!',
        name: 'Elvate REST API',
        database: 'ok',
        health: 'http://localhost:8000/healthz',
      });
    });
  });
});
