import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SHIPPING_ROW_ID, ShippingSetting } from './shipping-setting.entity';
import { ShippingRules, envShippingDefaults } from './shipping-rules';
import { SETTINGS_CACHE_MS } from './settings.service';

const rulesOf = (r: ShippingRules): ShippingRules => ({
  insideDhaka: r.insideDhaka,
  outsideDhaka: r.outsideDhaka,
  freeThreshold: r.freeThreshold,
});

/** BE-30: the delivery fees from `shipping_settings`. */
@Injectable()
export class ShippingSettingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ShippingSettingsService.name);
  private cache: { value: ShippingRules; at: number } | null = null;

  constructor(
    @InjectRepository(ShippingSetting)
    private readonly rows: Repository<ShippingSetting>,
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
}
