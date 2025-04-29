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

  async sendPasswordResetEmail(to: string, fullName: string, token: string) {
    const resetLink = `http://localhost/elvate/reset-password-view.php?resetToken=${token}`;
    const mailOptions = {
      from: '"Elvate Authentication" <no-reply@elvate.com>',
      to: to,
      subject: 'Elvate Password Reset Request',
      html: `
<div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; color: #333;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
    <div style="background-color: #007bff; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff;">Password Reset Request</h1>
    </div>
    <div style="padding: 20px;">
      <p>Hello ${fullName},</p>
      <p>You requested a password reset for your account. Click below to reset:</p>
      <p style="text-align: center;">
        <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none;">Reset Password</a>
      </p>
      <p>If you did not request a reset, you can ignore this email.</p>
      <p>— The Elvate Team</p>
    </div>
    <div style="background-color: #f1f1f1; text-align: center; padding: 10px;">
      <p style="font-size: 12px;">© 2024 Elvate. All rights reserved.</p>
    </div>
  </div>
</div>
      `,
    };

    return await this.transporter.sendMail(mailOptions);
  }

  async sendWelcomeEmail(to: string, fullName: string) {
    const mailOptions = {
      from: '"Elvate Welcome Team" <no-reply@elvate.com>',
      to: to,
      subject: 'Welcome to Elvate!',
      html: `
<div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; color: #333;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
    <div style="background-color: #28a745; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff;">Welcome to Elvate!</h1>
    </div>
    <div style="padding: 20px;">
      <p>Hello ${fullName},</p>
      <p>We're excited to have you at Elvate! Start exploring digital products, manage your profile, and enjoy exclusive offers.</p>
      <p style="text-align: center;">
        <a href="https://elvate.com" style="background-color: #28a745; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none;">Explore Elvate</a>
      </p>
      <p>Happy exploring!</p>
      <p>— The Elvate Team</p>
    </div>
    <div style="background-color: #f1f1f1; text-align: center; padding: 10px;">
      <p style="font-size: 12px;">© 2024 Elvate. All rights reserved.</p>
    </div>
  </div>
</div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
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
<div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; color: #333;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
    <div style="background-color: #007bff; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff;">Notification from Elvate</h1>
    </div>
    <div style="padding: 20px;">
      <p>Hello ${fullName},</p>
      <p>${body}</p>
      <p>If you have any questions, just reply to this email.</p>
      <p>— The Elvate Team</p>
    </div>
    <div style="background-color: #f1f1f1; text-align: center; padding: 10px;">
      <p style="font-size: 12px;">© 2024 Elvate. All rights reserved.</p>
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
