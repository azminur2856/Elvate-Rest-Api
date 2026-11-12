import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Swap point for another provider (e.g. a self-hosted model) without touching the route. */
export interface BackgroundRemover {
  /** false → the route answers 503 with a clear message. */
  isConfigured(): boolean;
  /** Returns a PNG with a transparent background. */
  remove(image: Buffer, mimetype: string, filename: string): Promise<Buffer>;
}

export const BACKGROUND_REMOVER = Symbol('BACKGROUND_REMOVER');

const SIZES = [
  'preview',
  'small',
  'regular',
  'medium',
  'hd',
  'full',
  '4k',
  'auto',
];

/**
 * remove.bg API (https://www.remove.bg/api). `REMOVE_BG_API_KEY` enables it;
 * `REMOVE_BG_SIZE` defaults to `preview` (≤ 0.25 MP, covered by the free
 * tier). A local ONNX model would not fit Render's 512 MB free instance.
 */
@Injectable()
export class RemoveBgProvider implements BackgroundRemover {
  private readonly logger = new Logger(RemoveBgProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey() {
    return this.config.get<string>('REMOVE_BG_API_KEY')?.trim() || null;
  }

  private get size() {
    const s = this.config.get<string>('REMOVE_BG_SIZE')?.trim();
    return s && SIZES.includes(s) ? s : 'preview';
  }

  isConfigured() {
    return this.apiKey !== null;
  }

  async remove(
    image: Buffer,
    mimetype: string,
    filename: string,
  ): Promise<Buffer> {
    const key = this.apiKey;
    if (!key) throw unavailable();

    const form = new FormData();
    form.append(
      'image_file',
      new Blob([new Uint8Array(image)], { type: mimetype }),
      filename,
    );
    form.append('size', this.size);
    form.append('format', 'png');

    let res: Response;
    try {
      res = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': key },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      this.logger.error('remove.bg request failed', err as Error);
      throw new ServiceUnavailableException(
        'The background removal service could not be reached, please try again',
      );
    }

    if (res.ok) return Buffer.from(await res.arrayBuffer());

    const body = (await res.json().catch(() => null)) as {
      errors?: { title?: string }[];
    } | null;
    const title = body?.errors?.[0]?.title ?? `HTTP ${res.status}`;
    this.logger.warn(`remove.bg answered ${res.status}: ${title}`);
    switch (res.status) {
      case 400:
        // e.g. "Could not identify foreground in image"
        throw new BadRequestException(`Background removal failed: ${title}`);
      case 402:
        throw new ServiceUnavailableException(
          'Background removal is used up for this month, please try again later',
        );
      case 403:
        throw unavailable();
      case 429:
        throw new HttpException(
          'Too many background removals right now, please wait a minute',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      default:
        throw new ServiceUnavailableException(
          'The background removal service is having problems, please try again',
        );
    }
  }
}

function unavailable() {
  return new ServiceUnavailableException({
    statusCode: 503,
    error: 'Service Unavailable',
    message:
      'Background removal is not available right now (the provider is not configured)',
  });
}
