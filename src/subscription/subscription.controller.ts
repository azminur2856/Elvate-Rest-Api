import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Headers,
  Get,
  Param,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { Public } from 'src/auth/decorators/public.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/users/enums/role.enum';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly subService: SubscriptionService,
    private readonly config: ConfigService,
  ) {}

  @Post('checkout')
  createCheckout(@Req() req, @Body('plan') plan: '1m' | '6m' | '12m') {
    return this.subService.createCheckoutSession(req.user.id, plan);
  }

  @Public() // or remove guard for this route
  @Post('webhook')
  async stripeWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') sig: string,
  ) {
    const stripe = new Stripe(this.config.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-05-28.basil',
    });

    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET in .env');
    }

    const rawBody = (req as any).rawBody;

    try {
      const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

      await this.subService.handleWebhook(event);
      res.status(200).send(); // Stripe expects a 2xx response
    } catch (err: any) {
      console.error('Webhook error:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  // @Get('session/:sessionId')
  // async getCheckoutSession(@Param('sessionId') sessionId: string, @Req() req) {
  //   const session = await this.subService.getCheckoutSessionDetails(sessionId);

  //   // Secure: Only allow user to see their session!
  //   if (!session.metadata || session.metadata.userId !== req.user.id) {
  //     throw new UnauthorizedException(
  //       'This payment session does not belong to you!',
  //     );
  //   }

  //   return session;
  // }

  @Get('session/:sessionId')
  async getCheckoutSession(@Param('sessionId') sessionId: string, @Req() req) {
    if (!req.user) throw new UnauthorizedException('User not authenticated');

    return this.subService.getCheckoutSessionDetails(sessionId, req.user.id);
  }

  @Get('status')
  async getSubscriptionStatus(@Req() req) {
    return this.subService.getSubscriptionStatus(req.user.id);
  }

  @Get('paymentsHistory')
  async getPaymentsHistory(@Req() req) {
    return this.subService.getPaymentsHistory(req.user.id);
  }

  @Get('subscriptionDetails')
  async getAllSubscriptions(@Req() req) {
    return this.subService.getAllSubscriptions(req.user.id);
  }

  @Post('cancel')
  async cancelSubscription(
    @Req() req,
    @Body('subscriptionId') subscriptionId: string,
  ) {
    return this.subService.cancelSubscription(req.user.id, subscriptionId);
  }

  @Roles(Role.ADMIN)
  @Get('subStats')
  async getSubscriptionStats() {
    return this.subService.getSubscriptionStats();
  }

  @Roles(Role.ADMIN)
  @Get('paymentStats')
  getPaymentStats() {
    return this.subService.getPaymentStats();
  }

  @Roles(Role.ADMIN)
  @Get('paymentsPlanStats')
  async getPaymentAndPlanStats() {
    return this.subService.getPaymentAndPlanStats();
  }

  @Roles(Role.ADMIN)
  @Get('getAllPayments')
  getAllPayments(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    return this.subService.getAllPayments(
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 10,
    );
  }

  // subscriptions.controller.ts

  @Roles(Role.ADMIN)
  @Get('getAllSubscriptions')
  getAllSubscriptionsAdmin(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    return this.subService.getAllSubscriptionsAdmin(
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 10,
    );
  }
}
