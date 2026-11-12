import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('keeps the welcome text and links to the same address', () => {
      const req = {
        protocol: 'http',
        get: () => 'localhost:8000',
      } as unknown as Request;
      expect(appController.root(req)).toMatchObject({
        message: 'Welcome to ELVATE!',
        name: 'Elvate REST API',
        health: 'http://localhost:8000/healthz',
      });
    });
  });
});
