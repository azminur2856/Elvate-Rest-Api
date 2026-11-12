import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  Logger,
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

type Plan = '1m' | '6m' | '12m';

const isPlan = (v: unknown): v is Plan =>
  v === '1m' || v === '6m' || v === '12m';

const SUBSCRIBE_ACTIVITY: Record<Plan, ActivityType> = {
  '1m': ActivityType.SUBSCRIPTION1M,
  '6m': ActivityType.SUBSCRIPTION6M,
  '12m': ActivityType.SUBSCRIPTION12M,
};

const PAYMENT_ACTIVITY: Record<Plan, ActivityType> = {
  '1m': ActivityType.PAYMENT1M,
  '6m': ActivityType.PAYMENT6M,
  '12m': ActivityType.PAYMENT12M,
};

/** Fallback period length when Stripe does not report one. */
function addPlanPeriod(from: Date, plan: Plan): Date {
  const end = new Date(from);
  if (plan === '12m') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + (plan === '6m' ? 6 : 1));
  return end;
}

/** Stripe fields are either an id or an expanded object. */
function stripeId(ref: string | { id?: string } | null | undefined) {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : (ref.id ?? null);
}

/** The service period an invoice pays for (its longest-running line). */
function invoicePeriod(invoice: Stripe.Invoice) {
  const lines = invoice.lines?.data ?? [];
  if (lines.length === 0) return null;
  const line = lines.reduce((a, b) => (b.period.end > a.period.end ? b : a));
  if (!line.period.start || !line.period.end) return null;
  return {
    start: new Date(line.period.start * 1000),
    end: new Date(line.period.end * 1000),
  };
}

/** When Stripe marked the invoice paid (late or retried deliveries keep the real date). */
function invoicePaidAt(invoice: Stripe.Invoice): Date | undefined {
  const t = invoice.status_transitions?.paid_at;
  return t ? new Date(t * 1000) : undefined;
}

/** Postgres unique_violation, as surfaced by TypeORM QueryFailedError. */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string } };
  return e?.code === '23505' || e?.driverError?.code === '23505';
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
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

  async createCheckoutSession(userId: string, plan: Plan) {
    const priceMap = {
      '1m': this.stripeSettings.price1m,
      '6m': this.stripeSettings.price6m,
      '12m': this.stripeSettings.price12m,
    };

    const priceId = priceMap[plan];
    if (!priceId) {
      throw new BadRequestException('Invalid plan selected.');
    }

    // SEC-14: one subscription at a time; a second checkout would charge
    // twice for overlapping periods
    const current = await this.getSubscriptionStatus(userId);
    if (current.isSubscribed) {
      throw new ConflictException(
        `You already have an active subscription until ${current.endDate?.toISOString().slice(0, 10)}.`,
      );
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

  /**
   * Stripe webhook entry point for subscription events. Dispatches on the
   * event type *before* any metadata validation, so events that belong to
   * other features (order payments, BE-15) or that we don't act on are
   * acknowledged instead of rejected.
   *
   * Every handler is idempotent: Stripe retries deliveries and may send the
   * same event more than once.
   */
  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') return; // e.g. order payments
        return this.handleSubscriptionCheckout(session);
      }
      case 'invoice.paid':
        return this.handleInvoicePaid(event.data.object);
      case 'customer.subscription.deleted':
        return this.handleSubscriptionDeleted(event.data.object);
      default:
        return;
    }
  }

  /** First payment of a new subscription (Stripe Checkout, mode `subscription`). */
  private async handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan;
    if (!userId || !isPlan(plan)) {
      throw new BadRequestException(
        'Missing or invalid metadata in Stripe session.',
      );
    }
    const invoiceId = stripeId(session.invoice);
    if (!invoiceId) {
      throw new BadRequestException('Missing invoice in session.');
    }
    if (await this.payRepo.exists({ where: { stripeInvoiceId: invoiceId } })) {
      return; // already recorded (retried delivery)
    }

    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const invoice = await this.stripe.invoices.retrieve(invoiceId);
    if (!invoice.hosted_invoice_url) {
      throw new Error('Stripe invoice missing hosted_invoice_url.');
    }

    const now = new Date();
    const period = invoicePeriod(invoice) ?? {
      start: now,
      end: addPlanPeriod(now, plan),
    };

    const saved = await this.recordPaidPeriod({
      userId: user.id,
      plan,
      stripeSubscriptionId: stripeId(session.subscription) ?? '',
      start: period.start,
      end: period.end,
      amount: (session.amount_total ?? invoice.amount_paid) / 100,
      currency: session.currency || invoice.currency || 'usd',
      invoiceId,
      invoiceUrl: invoice.hosted_invoice_url,
      paidAt: invoicePaidAt(invoice),
    });
    if (!saved) return;

    await this.activityLogService.createActivityLog({
      activity: SUBSCRIBE_ACTIVITY[plan],
      description: `User ${user.id} subscribed to plan ${plan} (Subscription ID: ${saved.subscription.id})`,
      user,
    });
    await this.activityLogService.createActivityLog({
      activity: PAYMENT_ACTIVITY[plan],
      description: `User ${user.id} made a payment of ${saved.payment.amount} ${saved.payment.currency} (Payment ID: ${saved.payment.id})`,
      user,
    });
  }

  /**
   * Renewal charge. Only `subscription_cycle` invoices are handled here; the
   * first invoice (`subscription_create`) is recorded by
   * `checkout.session.completed`, which carries the user + plan metadata.
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    if (invoice.billing_reason !== 'subscription_cycle' || !invoice.id) return;

    const stripeSubscriptionId = stripeId(
      invoice.parent?.subscription_details?.subscription,
    );
    if (!stripeSubscriptionId) return;

    if (await this.payRepo.exists({ where: { stripeInvoiceId: invoice.id } })) {
      return; // already recorded (retried delivery)
    }

    const previous = await this.subRepo.findOne({
      where: { stripeSubscriptionId },
      relations: ['user'],
      order: { endDate: 'DESC' },
    });
    if (!previous?.user) {
      this.logger.warn(
        `invoice.paid ${invoice.id}: no local subscription for ${stripeSubscriptionId}, ignored`,
      );
      return;
    }

    const period = invoicePeriod(invoice) ?? {
      start: previous.endDate,
      end: addPlanPeriod(previous.endDate, previous.plan),
    };

    const saved = await this.recordPaidPeriod({
      userId: previous.user.id,
      plan: previous.plan,
      stripeSubscriptionId,
      start: period.start,
      end: period.end,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency || 'usd',
      invoiceId: invoice.id,
      invoiceUrl: invoice.hosted_invoice_url ?? '',
      paidAt: invoicePaidAt(invoice),
    });
    if (!saved) return;

    await this.activityLogService.createActivityLog({
      activity: ActivityType.SUBSCRIPTION_RENEW,
      description: `Subscription ${stripeSubscriptionId} of user ${previous.user.id} renewed (plan ${previous.plan}, Subscription ID: ${saved.subscription.id})`,
      user: previous.user,
    });
    await this.activityLogService.createActivityLog({
      activity: PAYMENT_ACTIVITY[previous.plan],
      description: `User ${previous.user.id} renewal payment of ${saved.payment.amount} ${saved.payment.currency} (Payment ID: ${saved.payment.id})`,
      user: previous.user,
    });
  }

  /**
   * Stripe ended the subscription (at period end after a cancel, after failed
   * renewals, or when cancelled immediately). Marks every local period as
   * cancelled and cuts access at `ended_at` if that is earlier.
   */
  private async handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
    const rows = await this.subRepo.find({
      where: { stripeSubscriptionId: stripeSub.id },
      relations: ['user'],
    });
    if (rows.length === 0) return;

    const endedAt = stripeSub.ended_at
      ? new Date(stripeSub.ended_at * 1000)
      : new Date();
    const changed = rows.filter((s) => !s.isCancelled || s.endDate > endedAt);
    if (changed.length === 0) return; // already processed

    for (const s of changed) {
      s.isCancelled = true;
      if (s.endDate > endedAt) s.endDate = endedAt;
    }
    await this.subRepo.save(changed);

    const user = rows[0].user;
    await this.activityLogService.createActivityLog({
      activity: ActivityType.SUBSCRIPTION_ENDED,
      description: `Stripe ended subscription ${stripeSub.id} of user ${user?.id ?? 'unknown'}`,
      user: user ?? null,
    });
  }

  /**
   * Inserts one paid period (Subscription row + Payment row) atomically.
   * Returns null when the invoice was already recorded by a concurrent
   * delivery of the same event (unique `stripeInvoiceId`).
   */
  private async recordPaidPeriod(p: {
    userId: string;
    plan: Plan;
    stripeSubscriptionId: string;
    start: Date;
    end: Date;
    amount: number;
    currency: string;
    invoiceId: string;
    invoiceUrl: string;
    /** When Stripe charged the invoice; defaults to now. */
    paidAt?: Date;
  }): Promise<{ subscription: Subscription; payment: Payment } | null> {
    try {
      return await this.subRepo.manager.transaction(async (m) => {
        const subscription = await m.save(
          m.create(Subscription, {
            user: { id: p.userId },
            plan: p.plan,
            startDate: p.start,
            endDate: p.end,
            stripeSubscriptionId: p.stripeSubscriptionId,
          }),
        );
        const payment = await m.save(
          m.create(Payment, {
            user: { id: p.userId },
            subscription: { id: subscription.id },
            amount: p.amount,
            currency: p.currency,
            stripeInvoiceId: p.invoiceId,
            invoiceUrl: p.invoiceUrl,
            paidAt: p.paidAt,
          }),
        );
        return { subscription, payment };
      });
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
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

    // paidAt is true UTC; the frontend formats it in the viewer's time zone.
    return payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
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
    } catch {
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

  /**
   * A subscription has one row per paid period (renewals add rows, see
   * B-02), so every count here is per Stripe subscription, not per row.
   */
  async getSubscriptionStats() {
    const now = new Date();
    const counts = await this.subRepo
      .createQueryBuilder('sub')
      .select('COUNT(DISTINCT sub.stripeSubscriptionId)', 'total')
      .addSelect(
        'COUNT(DISTINCT sub.stripeSubscriptionId) FILTER (WHERE sub.isCancelled = false AND sub.endDate > :now)',
        'active',
      )
      .addSelect(
        'COUNT(DISTINCT sub.stripeSubscriptionId) FILTER (WHERE sub.isCancelled = true)',
        'cancelled',
      )
      .setParameter('now', now)
      .getRawOne<{ total: string; active: string; cancelled: string }>();

    const byPlan = await this.subRepo
      .createQueryBuilder('sub')
      .select('sub.plan', 'plan')
      .addSelect('COUNT(DISTINCT sub.stripeSubscriptionId)', 'count')
      .groupBy('sub.plan')
      .getRawMany<{ plan: string; count: string }>();
    const countByPlan: Record<string, number> = {};
    for (const row of byPlan) countByPlan[row.plan] = Number(row.count);

    const recentSubscriptions = await this.subRepo.find({
      relations: ['user'],
      order: { startDate: 'DESC' },
      take: 10,
    });

    return {
      totalSubscriptions: Number(counts?.total ?? 0),
      countByPlan,
      activeCount: Number(counts?.active ?? 0),
      cancelledCount: Number(counts?.cancelled ?? 0),
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
      .getRawOne<{ sum: string | null }>();
    const totalAmount = Number(totalAmountRaw?.sum || 0);

    // Group by currency
    const amountByCurrencyRaw = await this.payRepo
      .createQueryBuilder('p')
      .select('p.currency', 'currency')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(p.amount)', 'sum')
      .groupBy('p.currency')
      .getRawMany<{ currency: string; count: string; sum: string }>();

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
      .getRawMany<{ date: string; count: string; sum: string }>();

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
      byDay: byDay.map((d) => ({
        date: d.date,
        count: Number(d.count),
        sum: Number(d.sum),
      })),
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

  /**
   * Payment totals per plan. Each payment counts towards the plan of the
   * subscription period it paid for (`payment.subscriptionId`, set since
   * B-02). Older rows have no link and fall back to the user's subscription
   * that started most recently at or before `paidAt` (+7 h tolerance: rows
   * written before the process was pinned to UTC have startDate = paidAt + 6 h).
   */
  async getPaymentAndPlanStats() {
    const zero = (): Record<Plan, number> => ({ '1m': 0, '6m': 0, '12m': 0 });

    const totals = await this.payRepo
      .createQueryBuilder('p')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'sum')
      .getRawOne<{ count: string; sum: string }>();

    const planStats = zero();
    const byPlan = await this.subRepo
      .createQueryBuilder('s')
      .select('s.plan', 'plan')
      .addSelect('COUNT(DISTINCT s.stripeSubscriptionId)', 'count')
      .groupBy('s.plan')
      .getRawMany<{ plan: string; count: string }>();
    for (const row of byPlan) {
      if (isPlan(row.plan)) planStats[row.plan] = Number(row.count);
    }

    const planPaymentStats = zero();
    const paidByPlan = (await this.payRepo.query(`
        SELECT COALESCE(s.plan, legacy.plan) AS plan, SUM(p.amount) AS sum
        FROM payment p
        LEFT JOIN subscription s ON s.id = p."subscriptionId"
        LEFT JOIN LATERAL (
          SELECT s2.plan FROM subscription s2
          WHERE p."subscriptionId" IS NULL
            AND s2."userId" = p."userId"
            AND s2."startDate" <= p."paidAt" + INTERVAL '7 hours'
          ORDER BY s2."startDate" DESC
          LIMIT 1
        ) legacy ON TRUE
        GROUP BY 1`)) as { plan: string | null; sum: string }[];
    for (const row of paidByPlan) {
      if (isPlan(row.plan)) planPaymentStats[row.plan] = Number(row.sum);
    }

    const planPercent = zero();
    const totalPlans = planStats['1m'] + planStats['6m'] + planStats['12m'];
    if (totalPlans > 0) {
      for (const plan of ['1m', '6m', '12m'] as const) {
        planPercent[plan] = Math.round((planStats[plan] / totalPlans) * 100);
      }
    }

    return {
      totalPayments: Number(totals?.count ?? 0),
      totalAmount: Number(totals?.sum ?? 0),
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
      amount: Number(p.amount),
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
