import * as nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';
import emailConfig, { EmailConfig } from '../config/email.config';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const config: EmailConfig = emailConfig();
    this.transporter = nodemailer.createTransport({
      host: config.emailHost,
      port: config.emailPort,
      secure: false, // true for 465, false for others (TLS usually 587)
      auth: {
        user: config.emailSender,
        pass: config.emailPassword,
      },
    });
  }

  private readonly FRONTEND_URL = process.env.FRONTEND_URL;

  async sendRegistrationVerificationEmail(
    email: string,
    fullName: string,
    token: string,
  ) {
    const verificationLink = `${this.FRONTEND_URL}/auth/verifyRegistration?token=${token}`;
    const mailOptions = {
      from: '"Elvate Verification Team" <no-reply@elvate.com>',
      to: email,
      subject: 'Verify your email address',
      html: `
      <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 20px; color: #212529;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background-color: #212529; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff;">Verify Your Email</h1>
          </div>
          <div style="padding: 20px;">
            <p>Hello ${fullName},</p>
            <p>Thank you for registering at <strong>Elvate</strong>! Please verify your email by clicking the button below. This link will expire in <strong>1 hour</strong>.</p>
            <p style="text-align: center;">
              <a href="${verificationLink}" style="background-color: #0d6efd; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold;">Verify Email</a>
            </p>
            <p>If you didn’t create this account, you can ignore this email.</p>
            <p style="margin-top: 40px;">Welcome aboard,<br><strong>The Elvate Team</strong></p>
          </div>
          <div style="background-color: #f8f9fa; text-align: center; padding: 10px; font-size: 12px; color: #6c757d;">
            © 2024 Elvate. All rights reserved.
          </div>
        </div>
      </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendWelcomeEmail(to: string, fullName: string) {
    const mailOptions = {
      from: '"Elvate Welcome Team" <no-reply@elvate.com>',
      to: to,
      subject: 'Welcome to Elvate!',
      html: `
      <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 20px; color: #212529;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background-color: #0d6efd; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff;">Welcome to Elvate!</h1>
          </div>
          <div style="padding: 20px;">
            <p>Hello ${fullName},</p>
            <p>We're excited to have you at Elvate! Start exploring digital products, manage your profile, and enjoy exclusive offers.</p>
            <p style="text-align: center;">
              <a href=${this.FRONTEND_URL} style="background-color: #0d6efd; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none;">Explore Elvate</a>
            </p>
            <p>Happy exploring!<br><strong>The Elvate Team</strong></p>
          </div>
          <div style="background-color: #f8f9fa; text-align: center; padding: 10px; font-size: 12px; color: #6c757d;">
            © 2024 Elvate. All rights reserved.
          </div>
        </div>
      </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendPasswordResetEmail(to: string, fullName: string, token: string) {
    const resetLink = `${this.FRONTEND_URL}/auth/reset-password?token=${token}`;
    const mailOptions = {
      from: '"Elvate Authentication" <no-reply@elvate.com>',
      to: to,
      subject: 'Elvate Password Reset Request',
      html: `
      <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 20px; color: #212529;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background-color: #20c997; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff;">Password Reset Request</h1>
          </div>
          <div style="padding: 20px;">
            <p>Hello ${fullName},</p>
            <p>You requested a password reset for your account. Click the button below to reset your password. This link will expire in <strong>5 minutes</strong>.</p>
            <p style="text-align: center;">
              <a href="${resetLink}" style="background-color: #20c997; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none;">Reset Password</a>
            </p>
            <p>If you did not request a reset, please ignore this email.</p>
            <p><strong>The Elvate Team</strong></p>
          </div>
          <div style="background-color: #f8f9fa; text-align: center; padding: 10px; font-size: 12px; color: #6c757d;">
            © 2025 Elvate. All rights reserved.
          </div>
        </div>
      </div>
      `,
    };

    return await this.transporter.sendMail(mailOptions);
  }

  async sendNotificationEmail(
    to: string,
    fullName: string,
    subject: string,
    body: string,
  ) {
    const mailOptions = {
      from: '"Elvate Notifications" <no-reply@elvate.com>',
      to: to,
      subject: subject,
      html: `
      <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 20px; color: #212529;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background-color: #dc3545; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff;">Notification from Elvate</h1>
          </div>
          <div style="padding: 20px;">
            <p>Hello ${fullName},</p>
            <p>${body}</p>
            <p>If you have any questions, feel free to reply to this email.</p>
            <p><strong>The Elvate Team</strong></p>
          </div>
          <div style="background-color: #f8f9fa; text-align: center; padding: 10px; font-size: 12px; color: #6c757d;">
            © 2024 Elvate. All rights reserved.
          </div>
        </div>
      </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);

    return {
      success: true,
      message: `Email notification sent to ${to} successfully`,
    };
  }
}
