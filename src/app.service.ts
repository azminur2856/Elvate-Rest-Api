import { Injectable } from '@nestjs/common';

/**
 * Main application service.
 * @class AppService
 * @description Handles core application functionality and health checks.
 */
@Injectable()
export class AppService {
  /**
   * Returns a greeting message.
   * @returns {string} A welcome message
   */
  getHello(): string {
    return 'Welcome to Elvate REST API';
  }
}
