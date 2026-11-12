import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { swaggerEnabled } from './swagger';

export const WELCOME_MESSAGE = 'Welcome to ELVATE!';
export const API_NAME = 'Elvate REST API';
/** The database check is reused this long, so refreshing `/` cannot load the DB. */
export const DB_CHECK_CACHE_MS = 30_000;
/** A check slower than this counts as down. */
export const DB_CHECK_TIMEOUT_MS = 3_000;

/** GET / : what a visitor of the API's address sees. */
export interface RootInfo {
  message: string;
  name: string;
  /** `degraded` while the database cannot be reached. */
  status: 'ok' | 'degraded';
  database: 'ok' | 'down';
  /** Short commit ID of the deploy (Render), `local` elsewhere. */
  version: string;
  time: string;
  /** Only while Swagger is switched on. */
  docs?: string;
  health: string;
  app: string;
}

/** Render sets RENDER_GIT_COMMIT to the deployed commit. */
export function deployedVersion(env: NodeJS.ProcessEnv = process.env): string {
  const commit = env.RENDER_GIT_COMMIT?.trim() ?? '';
  return /^[0-9a-f]{7,40}$/i.test(commit) ? commit.slice(0, 7) : 'local';
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private dbCheck: { up: boolean; at: number } | null = null;
  /** One check at a time: requests arriving meanwhile wait for it. */
  private dbPending: Promise<boolean> | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Worked out on every request, from the address the visitor used and the
   * server's own settings. Public, so no secrets and no environment details.
   */
  async info(
    baseUrl: string,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<RootInfo> {
    const base = baseUrl.replace(/\/+$/, '');
    const up = await this.databaseUp();
    return {
      message: WELCOME_MESSAGE,
      name: API_NAME,
      status: up ? 'ok' : 'degraded',
      database: up ? 'ok' : 'down',
      version: deployedVersion(env),
      time: new Date().toISOString(),
      ...(swaggerEnabled(env) ? { docs: `${base}/docs` } : {}),
      health: `${base}/healthz`,
      app: (env.FRONTEND_URL?.trim() || 'http://localhost:3000').replace(
        /\/+$/,
        '',
      ),
    };
  }

  /** Cached for 30 s; never throws. */
  async databaseUp(): Promise<boolean> {
    const hit = this.dbCheck;
    if (hit && Date.now() - hit.at < DB_CHECK_CACHE_MS) return hit.up;
    this.dbPending ??= this.checkDatabase()
      .then((up) => {
        this.dbCheck = { up, at: Date.now() };
        return up;
      })
      .finally(() => {
        this.dbPending = null;
      });
    return this.dbPending;
  }

  private async checkDatabase(): Promise<boolean> {
    if (!this.dataSource.isInitialized) return false;
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`no answer in ${DB_CHECK_TIMEOUT_MS} ms`)),
            DB_CHECK_TIMEOUT_MS,
          );
        }),
      ]);
      return true;
    } catch (err) {
      this.logger.warn(`Database check failed: ${String(err)}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
