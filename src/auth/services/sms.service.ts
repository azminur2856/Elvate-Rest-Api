import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

interface SmsApiResponse {
  response_code: number;
  error_message?: string;
  success_message?: string;
}

@Injectable()
export class SmsService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {
    this.apiUrl = this.getEnv('SMS_API_URL');
    this.apiKey = this.getEnv('SMS_API_KEY');
    this.senderId = this.getEnv('SMS_SENDER_ID');
  }

  private getEnv(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new NotFoundException(`Missing environment variable: ${key}`);
    }
    return value;
  }

  async sendOtp(
    phoneNumber: string,
    fullName: string,
    otp: string,
  ): Promise<any> {
    const message = `Dear ${fullName},\nYour Elvate Reset Password OTP is ${otp}.\nThis code will expire in 2 minutes.\n\nPlease do not share this OTP with anyone.`;

    const params = {
      api_key: this.apiKey,
      senderid: this.senderId,
      number: phoneNumber,
      message,
    };

    try {
      const response = await axios.post(this.apiUrl, null, { params });
      const data = response.data as SmsApiResponse;

      if (data.response_code === 202) {
        this.logger.log('OTP SMS sent successfully');
        return { success: true, message: 'OTP sent successfully' };
      } else {
        this.logger.error(
          `Failed to send OTP SMS. Error: ${data.error_message}`,
        );
        return { success: false, error: data.error_message };
      }
    } catch (error: any) {
      this.logger.error(`Failed to send OTP SMS. Error: ${error.message}`);
      throw new Error('Unable to send OTP SMS at this time');
    }
  }

  async sendOtpPhoneVerification(
    phoneNumber: string,
    fullName: string,
    otp: string,
  ): Promise<any> {
    const message = `Dear ${fullName},\nYour Elvate Phone Verification OTP is ${otp}.\nThis code will expire in 2 minutes.\n\nPlease do not share this OTP with anyone.`;

    const params = {
      api_key: this.apiKey,
      senderid: this.senderId,
      number: phoneNumber,
      message,
    };

    try {
      const response = await axios.post(this.apiUrl, null, { params });
      const data = response.data as SmsApiResponse;

      if (data.response_code === 202) {
        this.logger.log('OTP SMS sent successfully');
        return { success: true, message: 'OTP sent successfully' };
      } else {
        this.logger.error(
          `Failed to send OTP SMS. Error: ${data.error_message}`,
        );
        return { success: false, error: data.error_message };
      }
    } catch (error: any) {
      this.logger.error(`Failed to send OTP SMS. Error: ${error.message}`);
      throw new Error('Unable to send OTP SMS at this time');
    }
  }

  async sendNotificationSMS(
    phoneNumber: string,
    fullName: string,
    body: string,
  ): Promise<any> {
    const message = `Dear ${fullName},\n${body}\n\nElvate`;

    const params = {
      api_key: this.apiKey,
      senderid: this.senderId,
      number: phoneNumber,
      message,
    };

    try {
      const response = await axios.post(this.apiUrl, null, { params });
      const data = response.data as SmsApiResponse;

      if (data.response_code === 202) {
        this.logger.log('Notification SMS sent successfully');
        return {
          success: true,
          message: `Notification SMS sent successfully to ${fullName}`,
        };
      } else {
        this.logger.error(
          `Failed to send Notification SMS. Error: ${data.error_message}`,
        );
        return { success: false, error: data.error_message };
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send Notification SMS. Error: ${error.message}`,
      );
      throw new Error('Unable to send Notification SMS at this time');
    }
  }
}
