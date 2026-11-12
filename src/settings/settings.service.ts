import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from './app-setting.entity';
import {
  SETTINGS,
  SMS_OTP,
  SettingDefinition,
  settingDefinition,
} from './settings.registry';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { Users } from 'src/users/entities/users.entity';
import { AuthUser, actorLabel } from 'src/common/auth-user';

/** How long a switch value is cached in memory. */
export const SETTINGS_CACHE_MS = 30_000;

export const SMS_TURNED_OFF = 'SMS verification is turned off';

/** One row of GET /admin/settings. */
export interface SettingView {
  key: string;
  enabled: boolean;
  label: string;
  description: string;
  updatedAt: Date | null;
  updatedBy: { name: string } | null;
  /** False when the switch cannot work (e.g. SMS credentials missing). */
  available: boolean;
}

@Injectable()
export class SettingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SettingsService.name);
  private readonly cache = new Map<string, { value: boolean; at: number }>();

  constructor(
    @InjectRepository(AppSetting)
    private readonly settings: Repository<AppSetting>,
    private readonly activityLogs: ActivityLogsService,
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

  /** GET /settings/public: no secrets, just what the UI needs. */
  async publicSettings(): Promise<{ smsOtpEnabled: boolean }> {
    return { smsOtpEnabled: await this.isEnabled(SMS_OTP) };
  }

  /** GET /admin/settings */
  async list(): Promise<SettingView[]> {
    const rows = await this.settings.find({ relations: ['updatedBy'] });
    return SETTINGS.map((def) =>
      this.view(
        def,
        rows.find((r) => r.key === def.key),
      ),
    );
  }

  /** PATCH /admin/settings/:key (ADMIN only). */
  async update(
    key: string,
    enabled: boolean,
    admin: AuthUser,
  ): Promise<SettingView> {
    const def = settingDefinition(key);
    if (!def) throw new NotFoundException(`Unknown setting "${key}"`);
    if (enabled && !def.available()) {
      throw new ConflictException(
        `${def.label} cannot be turned on: it is not configured on the server.`,
      );
    }
    const before = await this.isEnabledUncached(key, def.defaultEnabled);
    await this.settings.save({ key, enabled, updatedById: admin.id });
    this.clearCache(key);
    await this.activityLogs.createActivityLog({
      activity: ActivityType.ADMIN_UPDATE_SETTING,
      description: `${actorLabel(admin)} turned ${key} ${enabled ? 'on' : 'off'} (was ${before ? 'on' : 'off'}).`,
      user: { id: admin.id } as Users,
    });
    const row = await this.settings.findOne({
      where: { key },
      relations: ['updatedBy'],
    });
    return this.view(def, row ?? undefined);
  }

  private async isEnabledUncached(key: string, fallback: boolean) {
    const row = await this.settings.findOne({ where: { key } });
    return row?.enabled ?? fallback;
  }

  private view(def: SettingDefinition, row?: AppSetting): SettingView {
    const by = row?.updatedBy;
    return {
      key: def.key,
      enabled: row?.enabled ?? def.defaultEnabled,
      label: def.label,
      description: def.description,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: by
        ? { name: `${by.firstName} ${by.lastName ?? ''}`.trim() }
        : null,
      available: def.available(),
    };
  }

  /** 403 "SMS verification is turned off" unless the admin switched SMS on. */
  async assertSmsEnabled(): Promise<void> {
    if (!(await this.isEnabled(SMS_OTP))) {
      throw new ForbiddenException(SMS_TURNED_OFF);
    }
  }
}
