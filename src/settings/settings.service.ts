import {
  ForbiddenException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from './app-setting.entity';
import { SETTINGS, SMS_OTP, settingDefinition } from './settings.registry';

/** How long a switch value is cached in memory. */
export const SETTINGS_CACHE_MS = 30_000;

export const SMS_TURNED_OFF = 'SMS verification is turned off';

@Injectable()
export class SettingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SettingsService.name);
  private readonly cache = new Map<string, { value: boolean; at: number }>();

  constructor(
    @InjectRepository(AppSetting)
    private readonly settings: Repository<AppSetting>,
  ) {}

  /** Creates missing switches with their default (never changes existing ones). */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureDefaults();
    } catch (err) {
      this.logger.error(`Could not create default settings: ${String(err)}`);
    }
  }

  async ensureDefaults(): Promise<void> {
    await this.settings
      .createQueryBuilder()
      .insert()
      .values(SETTINGS.map((s) => ({ key: s.key, enabled: s.defaultEnabled })))
      .orIgnore()
      .execute();
  }

  /** Cached for 30 s; an unknown or missing switch counts as its default. */
  async isEnabled(key: string): Promise<boolean> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < SETTINGS_CACHE_MS) return hit.value;
    const row = await this.settings.findOne({ where: { key } });
    const value =
      row?.enabled ?? settingDefinition(key)?.defaultEnabled ?? false;
    this.cache.set(key, { value, at: Date.now() });
    return value;
  }

  /** Forget cached values (after an admin change). */
  clearCache(key?: string): void {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }

  /** 403 "SMS verification is turned off" unless the admin switched SMS on. */
  async assertSmsEnabled(): Promise<void> {
    if (!(await this.isEnabled(SMS_OTP))) {
      throw new ForbiddenException(SMS_TURNED_OFF);
    }
  }
}
