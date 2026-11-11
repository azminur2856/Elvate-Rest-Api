import { Injectable, Logger } from '@nestjs/common';
import { MailService } from 'src/auth/services/mail.services';
import type { Order } from './entities/order.entity';
import type { OrderItem } from './entities/order-item.entity';
import { PaymentMethod, PaymentStatus } from './order.enums';

export type OrderMailKind = 'placed' | 'shipped' | 'delivered' | 'cancelled';

/** RFC 2606/6761 names that can never receive mail (test accounts, seed demo users). */
const UNDELIVERABLE =
  /(\.(test|invalid|example|localhost)|@example\.(com|net|org))$/i;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const taka = (n: number) =>
  `৳${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/**
 * Customer e-mails for the order lifecycle (BE-15). Never throws: a mail
 * failure must not fail the request that changed the order.
 */
@Injectable()
export class OrderMailer {
  private readonly logger = new Logger(OrderMailer.name);

  constructor(private readonly mail: MailService) {}

  async send(
    kind: OrderMailKind,
    order: Pick<
      Order,
      'id' | 'orderNumber' | 'total' | 'paymentMethod' | 'paymentStatus'
    >,
    to: { email: string; name: string } | null,
    items: Pick<
      OrderItem,
      'productName' | 'variantLabel' | 'quantity' | 'lineTotal'
    >[] = [],
    note?: string | null,
  ): Promise<void> {
    if (!to?.email || UNDELIVERABLE.test(to.email)) return;
    const number = esc(order.orderNumber);
    const { subject, heading, body } = this.content(
      kind,
      order,
      number,
      items,
      note,
    );
    try {
      await this.mail.sendOrderEmail(
        to.email,
        esc(to.name),
        subject,
        heading,
        body,
        order.id,
      );
    } catch (err) {
      this.logger.warn(
        `Order e-mail (${kind}) for ${order.orderNumber} failed: ${(err as Error).message}`,
      );
    }
  }

  private content(
    kind: OrderMailKind,
    order: Pick<Order, 'total' | 'paymentMethod' | 'paymentStatus'>,
    number: string,
    items: Pick<
      OrderItem,
      'productName' | 'variantLabel' | 'quantity' | 'lineTotal'
    >[],
    note?: string | null,
  ) {
    const list = items.length
      ? `<ul>${items
          .map(
            (i) =>
              `<li>${i.quantity} × ${esc(i.productName)}${i.variantLabel ? ` (${esc(i.variantLabel)})` : ''}: ${taka(i.lineTotal)}</li>`,
          )
          .join('')}</ul>`
      : '';
    const reason = note ? `<p>Reason: ${esc(note)}</p>` : '';

    switch (kind) {
      case 'placed':
        return {
          subject: `Order ${number} received`,
          heading: 'Thank you for your order!',
          body: `<p>We have received your order <strong>${number}</strong>.</p>${list}
                 <p>Total: <strong>${taka(order.total)}</strong> (${order.paymentMethod === PaymentMethod.COD ? 'cash on delivery' : 'card'}).</p>`,
        };
      case 'shipped':
        return {
          subject: `Order ${number} has shipped`,
          heading: 'Your order is on its way',
          body: `<p>Good news: order <strong>${number}</strong> has been handed to our delivery team.</p>`,
        };
      case 'delivered':
        return {
          subject: `Order ${number} delivered`,
          heading: 'Delivered!',
          body: `<p>Order <strong>${number}</strong> was delivered. We hope you love it, and you can now review the products you bought.</p>`,
        };
      case 'cancelled':
        return {
          subject: `Order ${number} cancelled`,
          heading: 'Your order was cancelled',
          body: `<p>Order <strong>${number}</strong> has been cancelled.</p>${reason}${
            order.paymentStatus === PaymentStatus.REFUNDED
              ? `<p>Your card payment of ${taka(order.total)} has been refunded; it can take a few days to appear.</p>`
              : ''
          }`,
        };
    }
  }
}
