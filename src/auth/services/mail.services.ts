import * as nodemailer from 'nodemailer';
import axios from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import emailConfig from '../config/email.config';

/** Normalised result so callers don't depend on the transport. */
export interface MailSendResult {
  accepted: string[];
  rejected: string[];
}

/**
 * Sends transactional email.
 *
 * Transport is chosen at boot (first match wins). Render's free tier blocks
 * outbound SMTP ports (25/465/587), so production must use one of the HTTPS
 * options:
 *  1. `MAIL_WEBHOOK_URL` set -> POST {to, subject, html, fromName} to an n8n
 *     Webhook (see /n8n/elvate-mail-sender.json) whose Gmail node sends the
 *     mail. `MAIL_WEBHOOK_SECRET` is sent as the `x-mail-secret` header and
 *     checked by the workflow. No phone/domain/card needed.
 *  2. `BREVO_API_KEY` set   -> Brevo HTTP API; `EMAIL_SENDER` must be a sender
 *     verified in Brevo.
 *  3. otherwise             -> SMTP via nodemailer (EMAIL_HOST/PORT/SENDER/
 *     PASSWORD). Fine for local development.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly webhookUrl = process.env.MAIL_WEBHOOK_URL?.trim() || null;
  private readonly webhookSecret =
    process.env.MAIL_WEBHOOK_SECRET?.trim() || null;
  private readonly brevoApiKey = process.env.BREVO_API_KEY?.trim() || null;
  private readonly senderEmail: string;
  private transporter: nodemailer.Transporter | null = null;

  private readonly FRONTEND_URL = process.env.FRONTEND_URL;
  private readonly currentYear = new Date().getFullYear();

  constructor() {
    if (this.webhookUrl) {
      if (!this.webhookSecret) {
        throw new Error(
          'MAIL_WEBHOOK_SECRET must be set when MAIL_WEBHOOK_URL is used',
        );
      }
      // Sender identity is decided by the Gmail account connected in n8n.
      this.senderEmail = process.env.EMAIL_SENDER ?? 'n8n';
      this.logger.log(`Mail transport: n8n webhook (${this.webhookUrl})`);
    } else if (this.brevoApiKey) {
      const sender = process.env.EMAIL_SENDER;
      if (!sender) {
        throw new Error(
          'EMAIL_SENDER must be set (a sender verified in Brevo) when BREVO_API_KEY is used',
        );
      }
      this.senderEmail = sender;
      this.logger.log(`Mail transport: Brevo HTTP API (sender ${sender})`);
    } else {
      const config = emailConfig();
      this.senderEmail = config.emailSender;
      this.transporter = nodemailer.createTransport({
        host: config.emailHost,
        port: config.emailPort,
        secure: false, // true for 465, false for others (TLS usually 587)
        auth: {
          user: config.emailSender,
          pass: config.emailPassword,
        },
        // Fail fast instead of hanging a request for 2 minutes if the
        // SMTP port is unreachable (e.g. blocked by the hosting provider).
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
      this.logger.log(
        `Mail transport: SMTP ${config.emailHost}:${config.emailPort} (sender ${config.emailSender})`,
      );
    }
  }

  /**
   * Low-level send. Never throws for delivery problems: returns the address in
   * `rejected` so callers can report "failed to send" without a 500.
   */
  private async send(
    fromName: string,
    to: string,
    subject: string,
    html: string,
  ): Promise<MailSendResult> {
    try {
      if (this.webhookUrl) {
        const res = await axios.post<{ ok?: boolean; error?: string }>(
          this.webhookUrl,
          { to, subject, html, fromName },
          {
            headers: {
              'x-mail-secret': this.webhookSecret!,
              'content-type': 'application/json',
            },
            timeout: 25_000,
          },
        );
        if (res.data && res.data.ok === false) {
          throw new Error(
            `mail webhook refused: ${JSON.stringify(res.data).slice(0, 200)}`,
          );
        }
        return { accepted: [to], rejected: [] };
      }

      if (this.brevoApiKey) {
        await axios.post(
          'https://api.brevo.com/v3/smtp/email',
          {
            sender: { name: fromName, email: this.senderEmail },
            to: [{ email: to }],
            subject,
            htmlContent: html,
          },
          {
            headers: {
              'api-key': this.brevoApiKey,
              'content-type': 'application/json',
              accept: 'application/json',
            },
            timeout: 15_000,
          },
        );
        return { accepted: [to], rejected: [] };
      }

      const info = await this.transporter!.sendMail({
        from: `"${fromName}" <${this.senderEmail}>`,
        to,
        subject,
        html,
      });
      return {
        accepted: (info.accepted ?? []).map(String),
        rejected: (info.rejected ?? []).map(String),
      };
    } catch (err: any) {
      const detail =
        err?.response?.data?.message ?? err?.response?.data ?? err?.message;
      this.logger.error(
        `Failed to send "${subject}" to ${to}: ${JSON.stringify(detail)}`,
      );
      return { accepted: [], rejected: [to] };
    }
  }

  private layout(headerColor: string, title: string, body: string): string {
    return `
      <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 20px; color: #212529;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background-color: ${headerColor}; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff;">${title}</h1>
          </div>
          <div style="padding: 20px;">
            ${body}
          </div>
          <div style="background-color: #f8f9fa; text-align: center; padding: 10px; font-size: 12px; color: #6c757d;">
            © ${this.currentYear} Elvate. All rights reserved.
          </div>
        </div>
      </div>
    `;
  }

  async sendRegistrationVerificationEmail(
    email: string,
    fullName: string,
    token: string,
  ): Promise<MailSendResult> {
    const verificationLink = `${this.FRONTEND_URL}/verifyRegistration?token=${token}`;
    const html = this.layout(
      '#212529',
      'Verify Your Email',
      `
            <p>Hello ${fullName},</p>
            <p>Thank you for registering at <strong>Elvate</strong>! Please verify your email by clicking the button below. This link will expire in <strong>1 hour</strong>.</p>
            <p style="text-align: center;">
              <a href="${verificationLink}" style="background-color: #0d6efd; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold;">Verify Email</a>
            </p>
            <p>If you didn’t create this account, you can ignore this email.</p>
            <p style="margin-top: 40px;">Welcome aboard,<br><strong>The Elvate Team</strong></p>
      `,
    );
    return this.send(
      'Elvate Verification Team',
      email,
      'Verify your email address',
      html,
    );
  }

  async sendWelcomeEmail(to: string, fullName: string): Promise<MailSendResult> {
    const html = this.layout(
      '#0d6efd',
      'Welcome to Elvate!',
      `
            <p>Hello ${fullName},</p>
            <p>We're excited to have you at Elvate! Start exploring digital products, manage your profile, and enjoy exclusive offers.</p>
            <p style="text-align: center;">
              <a href="${this.FRONTEND_URL}" style="background-color: #0d6efd; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none;">Explore Elvate</a>
            </p>
            <p>Happy exploring!<br><strong>The Elvate Team</strong></p>
      `,
    );
    return this.send('Elvate Welcome Team', to, 'Welcome to Elvate!', html);
  }

  async sendPasswordResetEmail(
    to: string,
    fullName: string,
    token: string,
  ): Promise<MailSendResult> {
    const resetLink = `${this.FRONTEND_URL}/resetPassword?token=${token}`;
    const html = this.layout(
      '#20c997',
      'Password Reset Request',
      `
            <p>Hello ${fullName},</p>
            <p>You requested a password reset for your account. Click the button below to reset your password. This link will expire in <strong>5 minutes</strong>.</p>
            <p style="text-align: center;">
              <a href="${resetLink}" style="background-color: #20c997; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none;">Reset Password</a>
            </p>
            <p>If you did not request a reset, please ignore this email.</p>
            <p><strong>The Elvate Team</strong></p>
      `,
    );
    return this.send(
      'Elvate Authentication',
      to,
      'Elvate Password Reset Request',
      html,
    );
  }

  async sendNotificationEmail(
    to: string,
    fullName: string,
    subject: string,
    body: string,
  ) {
    const html = this.layout(
      '#dc3545',
      'Notification from Elvate',
      `
            <p>Hello ${fullName},</p>
            <p>${body}</p>
            <p>If you have any questions, feel free to reply to this email.</p>
            <p><strong>The Elvate Team</strong></p>
      `,
    );
    const result = await this.send('Elvate Notifications', to, subject, html);

    if (result.rejected.length > 0) {
      return {
        success: false,
        message: `Failed to send email notification to ${to}`,
      };
    }
    return {
      success: true,
      message: `Email notification sent to ${to} successfully`,
    };
  }
}
