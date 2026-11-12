import { Injectable } from '@nestjs/common';
import { swaggerEnabled } from './swagger';

export const WELCOME_MESSAGE = 'Welcome to ELVATE!';
export const API_NAME = 'Elvate REST API';

/** GET / : what a visitor of the API's address sees. */
export interface RootInfo {
  message: string;
  name: string;
  status: 'ok';
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
  /**
   * Worked out on every request, from the address the visitor used and the
   * server's own settings. Public, so no secrets and no environment details.
   */
  info(baseUrl: string, env: NodeJS.ProcessEnv = process.env): RootInfo {
    const base = baseUrl.replace(/\/+$/, '');
    return {
      message: WELCOME_MESSAGE,
      name: API_NAME,
      status: 'ok',
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
}
