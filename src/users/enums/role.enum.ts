export enum Role {
  BUYER = 'BUYER',
  ADMIN = 'ADMIN',
  DELIVERY_MAN = 'DELIVERY_MAN',
  /** Runs the shop day to day: products, categories, orders, review moderation (BE-24). */
  STAFF = 'STAFF',
}

/**
 * Roles allowed on the admin commerce routes (`@Roles(...SHOP_MANAGER_ROLES)`):
 * products, category writes, admin orders, review moderation. Everything else
 * under admin (users, payments, coupons, logs, ...) stays `Role.ADMIN` only.
 */
export const SHOP_MANAGER_ROLES = [Role.ADMIN, Role.STAFF] as const;
