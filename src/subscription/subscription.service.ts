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

    return payments.map((payment) => {
      // Add 6 hours to paidAt
      const paidAtWithOffset = new Date(payment.paidAt);
      paidAtWithOffset.setHours(paidAtWithOffset.getHours() + 6);

      return {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: paidAtWithOffset,
        invoiceUrl: payment.invoiceUrl,
      };
    });
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
        isCancelled: sub.isCancelled,
        status: isActive ? `Active (${daysLeft} days remaining)` : 'Expired',
        daysLeft,
        isActive,
        autoRenewal: !sub.isCancelled && isActive, // Show autoRenewal true if not cancelled and active
      };
    });
  }

  async cancelSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.subRepo.findOne({
      where: { id: subscriptionId, user: { id: userId } },
    });

    if (!subscription) {
      throw new BadRequestException(
        'Subscription not found or does not belong to user.',
      );
    }

    if (subscription.endDate <= new Date()) {
      throw new BadRequestException(
        'Cannot cancel an already expired subscription.',
      );
    }

    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Stop auto-renewal in Stripe
    try {
      await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        },
      );
    } catch (error) {
      throw new BadRequestException('Failed to cancel subscription in Stripe.');
    }

    // Update local subscription record
    subscription.isCancelled = true;
    await this.subRepo.update(subscription.id, { isCancelled: true });

    // Log activity for cancellation
    await this.activityLogService.createActivityLog({
      activity: ActivityType.SUBSCRIPTION_CANCEL,
      description: `User ${userId} cancelled subscription (ID: ${subscription.id})`,
      user: user,
    });

    return { message: 'Subscription cancelled successfully.' };
  }

  async getSubscriptionStats() {
    // 1. Total subscriptions
    const totalSubscriptions = await this.subRepo.count();

    // 2. Count by plan
    const countByPlanRaw = await this.subRepo
      .createQueryBuilder('sub')
      .select('sub.plan', 'plan')
      .addSelect('COUNT(*)', 'count')
      .groupBy('sub.plan')
      .getRawMany();
    const countByPlan: Record<string, number> = {};
    for (const row of countByPlanRaw) {
      countByPlan[row.plan] = Number(row.count);
    }

    // 3. Active vs Cancelled
    const activeCount = await this.subRepo.count({
      where: { isCancelled: false },
    });
    const cancelledCount = await this.subRepo.count({
      where: { isCancelled: true },
    });

    // 4. Recent subscriptions (last 7 days)
    const recentSubscriptions = await this.subRepo.find({
      relations: ['user'],
      order: { startDate: 'DESC' },
      take: 10,
    });

    return {
      totalSubscriptions,
      countByPlan,
      activeCount,
      cancelledCount,
      recentSubscriptions: recentSubscriptions.map((sub) => ({
        id: sub.id,
        plan: sub.plan,
        isCancelled: sub.isCancelled,
        startDate: sub.startDate,
        endDate: sub.endDate,
        userId: sub.user?.id,
        userName: sub.user
          ? `${sub.user.firstName ?? ''} ${sub.user.lastName ?? ''}`.trim()
          : null,
      })),
    };
  }

  // payment.service.ts

  async getPaymentStats() {
    // Total payments & total amount
    const totalPayments = await this.payRepo.count();
    const totalAmountRaw = await this.payRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'sum')
      .getRawOne();
    const totalAmount = Number(totalAmountRaw?.sum || 0);

    // Group by currency
    const amountByCurrencyRaw = await this.payRepo
      .createQueryBuilder('p')
      .select('p.currency', 'currency')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(p.amount)', 'sum')
      .groupBy('p.currency')
      .getRawMany();

    const amountByCurrency = amountByCurrencyRaw.map((x) => ({
      currency: x.currency,
      count: Number(x.count),
      sum: Number(x.sum),
    }));

    // Payments by day (last 7 days)
    const byDay = await this.payRepo
      .createQueryBuilder('p')
      .select("TO_CHAR(p.paidAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(p.amount)', 'sum')
      .where("p.paidAt >= NOW() - INTERVAL '7 days'")
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Recent 10 payments
    const recentPayments = await this.payRepo.find({
      relations: ['user'],
      order: { paidAt: 'DESC' },
      take: 10,
    });

    return {
      totalPayments,
      totalAmount,
      amountByCurrency,
      byDay,
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        userId: p.user?.id,
        userName: p.user ? `${p.user.firstName} ${p.user.lastName || ''}` : '',
        amount: Number(p.amount),
        currency: p.currency,
        invoiceUrl: p.invoiceUrl,
        paidAt: p.paidAt,
      })),
    };
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

  async getAllPayments(page = 1, pageSize = 10) {
    const [payments, total] = await this.payRepo.findAndCount({
      order: { paidAt: 'DESC' },
      relations: ['user'],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const list = payments.map((p) => ({
      id: p.id,
      userId: p.user ? p.user.id : null,
      userName: p.user
        ? `${p.user.firstName ?? ''} ${p.user.lastName ?? ''}`.trim()
        : null,
      amount: p.amount,
      currency: p.currency,
      invoiceUrl: p.invoiceUrl,
      paidAt: p.paidAt,
    }));

    return {
      payments: list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // subscriptions.service.ts

  async getAllSubscriptionsAdmin(page = 1, pageSize = 10) {
    const [subs, total] = await this.subRepo.findAndCount({
      order: { startDate: 'DESC' },
      relations: ['user'],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const list = subs.map((s) => ({
      id: s.id,
      userId: s.user ? s.user.id : null,
      userName: s.user
        ? `${s.user.firstName ?? ''} ${s.user.lastName ?? ''}`.trim()
        : null,
      plan: s.plan,
      isCancelled: s.isCancelled,
      startDate: s.startDate,
      endDate: s.endDate,
    }));

    return {
      subscriptions: list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
