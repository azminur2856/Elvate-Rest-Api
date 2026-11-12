import {
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SHIPPING_ROW_ID, ShippingSetting } from './shipping-setting.entity';
import {
  ShippingRules,
  envShippingDefaults,
  shippingRulesProblem,
} from './shipping-rules';
import { SETTINGS_CACHE_MS } from './settings.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { Users } from 'src/users/entities/users.entity';
import { AuthUser, actorLabel } from 'src/common/auth-user';

/** GET / PATCH /admin/settings/shipping (contract `ShippingSettings`). */
export interface ShippingSettingsView extends ShippingRules {
  updatedAt: Date | null;
  updatedBy: { name: string } | null;
}

const rulesOf = (r: ShippingRules): ShippingRules => ({
  insideDhaka: r.insideDhaka,
  outsideDhaka: r.outsideDhaka,
  freeThreshold: r.freeThreshold,
});

/** "inside Dhaka 60 → 80, outside Dhaka 120 → 120, free from 3000 → off" */
export function describeShippingChange(
  before: ShippingRules,
  after: ShippingRules,
): string {
  const free = (v: number) => (v > 0 ? String(v) : 'off');
  return [
    `inside Dhaka ${before.insideDhaka} → ${after.insideDhaka}`,
    `outside Dhaka ${before.outsideDhaka} → ${after.outsideDhaka}`,
    `free from ${free(before.freeThreshold)} → ${free(after.freeThreshold)}`,
  ].join(', ');
}

/** BE-30: the delivery fees from `shipping_settings`. */
@Injectable()
export class ShippingSettingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ShippingSettingsService.name);
  private cache: { value: ShippingRules; at: number } | null = null;

  constructor(
    @InjectRepository(ShippingSetting)
    private readonly rows: Repository<ShippingSetting>,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureRow();
    } catch (err) {
      this.logger.error(`Could not create the delivery fees: ${String(err)}`);
    }
  }

  /** Creates the row from env / 60 · 120 · 3000 only if it is missing. */
  async ensureRow(): Promise<void> {
    if (await this.rows.findOne({ where: { id: SHIPPING_ROW_ID } })) return;
    const { rules, ignored } = envShippingDefaults();
    for (const name of ignored) {
      this.logger.warn(`${name} is outside the delivery fee limits; ignored`);
    }
    // orIgnore: another instance may have created it in the meantime
    await this.rows
      .createQueryBuilder()
      .insert()
      .values({ id: SHIPPING_ROW_ID, ...rules })
      .orIgnore()
      .execute();
  }

  /**
   * The fees new quotes and orders use. Cached for 30 s like the switches;
   * without a row (first start failed) the first-start defaults.
   */
  async rules(): Promise<ShippingRules> {
    const hit = this.cache;
    if (hit && Date.now() - hit.at < SETTINGS_CACHE_MS) return { ...hit.value };
    const row = await this.rows.findOne({ where: { id: SHIPPING_ROW_ID } });
    const value = row ? rulesOf(row) : envShippingDefaults().rules;
    this.cache = { value, at: Date.now() };
    return { ...value };
  }

  /** Forget the cached fees (after an admin change). */
  clearCache(): void {
    this.cache = null;
  }

  /** GET /admin/settings/shipping (always fresh, with who changed it last). */
  async view(): Promise<ShippingSettingsView> {
    const row = await this.rows.findOne({
      where: { id: SHIPPING_ROW_ID },
      relations: ['updatedBy'],
    });
    const by = row?.updatedBy;
    return {
      ...(row ? rulesOf(row) : envShippingDefaults().rules),
      updatedAt: row?.updatedAt ?? null,
      updatedBy: by
        ? { name: `${by.firstName} ${by.lastName ?? ''}`.trim() }
        : null,
    };
  }

  /**
   * PATCH /admin/settings/shipping (ADMIN only). New quotes and orders use
   * the fees at once; orders already placed keep their saved fee.
   */
  async update(
    input: ShippingRules,
    admin: AuthUser,
  ): Promise<ShippingSettingsView> {
    const problem = shippingRulesProblem(input);
    if (problem) throw new BadRequestException(problem);
    const next = rulesOf(input);
    const row = await this.rows.findOne({ where: { id: SHIPPING_ROW_ID } });
    const before = row ? rulesOf(row) : envShippingDefaults().rules;

    const values = { ...next, updatedById: admin.id };
    const res = await this.rows.update({ id: SHIPPING_ROW_ID }, values);
    if (!res.affected)
      await this.rows.insert({ id: SHIPPING_ROW_ID, ...values });
    this.clearCache();

    // the change is saved: a failing log must not turn it into an error
    try {
      await this.activityLogs.createActivityLog({
        activity: ActivityType.ADMIN_UPDATE_SHIPPING,
        description: `${actorLabel(admin)} changed delivery fees: ${describeShippingChange(before, next)}.`,
        user: { id: admin.id } as Users,
      });
    } catch (err) {
      this.logger.warn(
        `Activity log ADMIN_UPDATE_SHIPPING failed: ${String(err)}`,
      );
    }
    return this.view();
  }
}
