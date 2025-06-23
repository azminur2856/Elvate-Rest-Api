import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { Payment } from './entities/payment.entity';
import { UsersService } from '../users/users.service';
import { ConfigType } from '@nestjs/config';
import stripeConfig from './config/stripe.config';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';

@Injectable()
export class SubscriptionService {
  private stripe: Stripe;

  constructor(
    private readonly activityLogService: ActivityLogsService,
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
    @InjectRepository(Payment)
    private payRepo: Repository<Payment>,
    private usersService: UsersService,
    @Inject(stripeConfig.KEY)
    private stripeSettings: ConfigType<typeof stripeConfig>,
  ) {
    if (!this.stripeSettings.stripeSecretKey) {
      throw new Error('Stripe secret key is not configured in env');
    }

    this.stripe = new Stripe(this.stripeSettings.stripeSecretKey, {
      apiVersion: '2025-05-28.basil',
    });
  }

  private readonly FRONTEND_URL = process.env.FRONTEND_URL;

  async createCheckoutSession(userId: string, plan: '1m' | '6m' | '12m') {
    const priceMap = {
      '1m': this.stripeSettings.price1m,
      '6m': this.stripeSettings.price6m,
      '12m': this.stripeSettings.price12m,
    };

    const priceId = priceMap[plan];
    if (!priceId) {
      throw new BadRequestException('Invalid plan selected.');
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.FRONTEND_URL}/payment/cancel`,
      metadata: {
        userId,
        plan,
      },
    });

    return { url: session.url };
  }

  async handleWebhook(event: Stripe.Event) {
    if (event.type !== 'checkout.session.completed') return;

    const session = event.data.object as Stripe.Checkout.Session;

    // Validate metadata
    if (
      !session.metadata ||
      !session.metadata.userId ||
      !session.metadata.plan
    ) {
      throw new BadRequestException('Missing metadata in Stripe session.');
    }

    const userId = session.metadata.userId;
    const plan = session.metadata.plan as '1m' | '6m' | '12m';

    const now = new Date();
    const end = new Date(now);

    switch (plan) {
      case '1m':
        end.setMonth(now.getMonth() + 1);
        break;
      case '6m':
        end.setMonth(now.getMonth() + 6);
        break;
      case '12m':
        end.setFullYear(now.getFullYear() + 1);
        break;
      default:
        throw new BadRequestException('Invalid plan metadata.');
    }

    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Retrieve invoice to get the invoice URL
    if (!session.invoice) {
      throw new BadRequestException('Missing invoice in session.');
    }

    const invoice = await this.stripe.invoices.retrieve(
      session.invoice as string,
    );

    if (!invoice.hosted_invoice_url) {
      throw new Error('Stripe invoice missing hosted_invoice_url.');
    }

    // Create subscription
    const subscription = this.subRepo.create({
      user: { id: user.id },
      plan,
      startDate: now,
      endDate: end,
      stripeSubscriptionId: session.subscription as string,
    });
    await this.subRepo.save(subscription);

    // Log activity for subscription creation
    await this.activityLogService.createActivityLog({
      activity: ActivityType[`SUBSCRIPTION${plan.toUpperCase()}`],
      description: `User ${user.id} subscribed to plan ${plan} (Subscription ID: ${subscription.id})`,
      user: user,
    });

    // Create payment
    const payment = this.payRepo.create({
      user: { id: user.id },
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency || 'usd',
      stripeInvoiceId: session.invoice as string,
      invoiceUrl: invoice.hosted_invoice_url,
    });
    await this.payRepo.save(payment);

    // Log activity for payment creation
    await this.activityLogService.createActivityLog({
      activity: ActivityType[`PAYMENT${plan.toUpperCase()}`],
      description: `User ${user.id} made a payment of ${payment.amount} ${payment.currency} (Payment ID: ${payment.id})`,
      user: user,
    });
  }

  async getCheckoutSessionDetails(sessionId: string, userId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['invoice'],
    });

    // Ownership check here!
    if (!session.metadata || session.metadata.userId !== userId) {
      throw new UnauthorizedException(
        'This payment session does not belong to you!',
      );
    }

    return session;
  }

  async getSubscriptionStatus(userId: string) {
    const now = new Date();

    const latestSub = await this.subRepo.findOne({
      where: {
        user: { id: userId },
        endDate: MoreThan(now),
      },
      order: { endDate: 'DESC' },
    });

    if (!latestSub) {
      return {
        isSubscribed: false,
        daysLeft: 0,
        startDate: null,
        endDate: null,
      };
    }

    const diffMs = latestSub.endDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      isSubscribed: true,
      daysLeft,
      startDate: latestSub.startDate,
      endDate: latestSub.endDate,
    };
  }

  async getPaymentsHistory(userId: string) {
    const payments = await this.payRepo.find({
      where: { user: { id: userId } },
      order: { paidAt: 'DESC' },
    });

    return payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
      invoiceUrl: payment.invoiceUrl,
    }));
  }

  async getAllSubscriptions(userId: string) {
    const now = new Date();
    const subscriptions = await this.subRepo.find({
      where: { user: { id: userId } },
      order: { endDate: 'DESC' },
    });

    return subscriptions.map((sub) => {
      const isActive = sub.endDate > now;
      const daysLeft = isActive
        ? Math.ceil(
            (sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0;
      return {
        id: sub.id,
        plan: sub.plan,
        startDate: sub.startDate,
        endDate: sub.endDate,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        status: isActive ? `Active (${daysLeft} days remaining)` : 'Expired',
        daysLeft,
        isActive,
      };
    });
  }

  async getSubscriptionStats() {
    const allSubs = await this.subRepo.find();

    const stats = {
      total: allSubs.length,
      '1m': 0,
      '6m': 0,
      '12m': 0,
      active: 0,
      expired: 0,
      percent: {
        '1m': 0,
        '6m': 0,
        '12m': 0,
        active: 0,
        expired: 0,
      },
    };

    const now = new Date();

    for (const sub of allSubs) {
      if (sub.plan === '1m') stats['1m']++;
      if (sub.plan === '6m') stats['6m']++;
      if (sub.plan === '12m') stats['12m']++;
      if (sub.endDate > now) stats.active++;
      else stats.expired++;
    }

    // Calculate percentages
    if (stats.total > 0) {
      stats.percent['1m'] = Math.round((stats['1m'] / stats.total) * 100);
      stats.percent['6m'] = Math.round((stats['6m'] / stats.total) * 100);
      stats.percent['12m'] = Math.round((stats['12m'] / stats.total) * 100);
      stats.percent.active = Math.round((stats.active / stats.total) * 100);
      stats.percent.expired = Math.round((stats.expired / stats.total) * 100);
    }

    return stats;
  }

  async getPaymentAndPlanStats() {
    const payments = await this.payRepo.find({ relations: ['user'] });
    const plans = await this.subRepo.find({ relations: ['user'] });

    const planStats = {
      '1m': 0,
      '6m': 0,
      '12m': 0,
    };

    let totalAmount = 0;
    let totalPayments = payments.length;

    // Plan-wise payment stats
    const planPaymentStats: Record<'1m' | '6m' | '12m', number> = {
      '1m': 0,
      '6m': 0,
      '12m': 0,
    };

    // Map userId to latest plan
    const userLatestPlan: Record<string, '1m' | '6m' | '12m' | undefined> = {};
    for (const sub of plans) {
      if (
        !userLatestPlan[sub.user.id] ||
        sub.endDate >
          (plans.find(
            (s) =>
              s.user.id === sub.user.id &&
              userLatestPlan[sub.user.id] === s.plan,
          )?.endDate || new Date(0))
      ) {
        userLatestPlan[sub.user.id] = sub.plan as '1m' | '6m' | '12m';
      }
      if (sub.plan === '1m') planStats['1m']++;
      if (sub.plan === '6m') planStats['6m']++;
      if (sub.plan === '12m') planStats['12m']++;
    }

    for (const payment of payments) {
      totalAmount += payment.amount;
      const plan = userLatestPlan[payment.user.id];
      if (plan) {
        planPaymentStats[plan] += payment.amount;
      }
    }

    // Calculate plan percentage
    const planPercent: Record<'1m' | '6m' | '12m', number> = {
      '1m': 0,
      '6m': 0,
      '12m': 0,
    };
    const totalPlans = planStats['1m'] + planStats['6m'] + planStats['12m'];
    if (totalPlans > 0) {
      planPercent['1m'] = Math.round((planStats['1m'] / totalPlans) * 100);
      planPercent['6m'] = Math.round((planStats['6m'] / totalPlans) * 100);
      planPercent['12m'] = Math.round((planStats['12m'] / totalPlans) * 100);
    }

    return {
      totalPayments,
      totalAmount,
      planStats,
      planPercent,
      planPaymentStats,
    };
  }
}
