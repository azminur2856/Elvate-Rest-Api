import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import {
  FaceAnalysis,
  FaceCheckFailure,
  FaceMatch,
  MatchLevel,
} from './face-check';

const FACEPP = 'https://api-us.faceplusplus.com/facepp/v3';
/** Waits (ms) before retrying a CONCURRENCY_LIMIT_EXCEEDED answer. */
const RETRIES = [600, 1200, 2400];

interface FppEye {
  no_glass_eye_open?: number;
  no_glass_eye_close?: number;
  normal_glass_eye_open?: number;
  normal_glass_eye_close?: number;
}
interface FppFace {
  face_token: string;
  attributes?: {
    headpose?: { yaw_angle?: number };
    eyestatus?: { left_eye_status?: FppEye; right_eye_status?: FppEye };
    facequality?: { value?: number; threshold?: number };
  };
}
interface FppDetect {
  face_num?: number;
  faces?: FppFace[];
}
interface FppCompare {
  confidence?: number;
  thresholds?: Partial<Record<MatchLevel, number>>;
}

/** Either side of a comparison. */
export type FaceSource =
  | { faceToken: string }
  | { imageUrl: string }
  | { imageBase64: string };

const eyeOpen = (e?: FppEye) =>
  (e?.no_glass_eye_open ?? 0) + (e?.normal_glass_eye_open ?? 0);
const eyeClosed = (e?: FppEye) =>
  (e?.no_glass_eye_close ?? 0) + (e?.normal_glass_eye_close ?? 0);

@Injectable()
export class FaceVerificationService {
  private readonly logger = new Logger(FaceVerificationService.name);
  private readonly API_KEY = process.env.FACEPP_API_KEY;
  private readonly API_SECRET = process.env.FACEPP_API_SECRET;

  isConfigured(): boolean {
    return !!this.API_KEY && !!this.API_SECRET;
  }

  /**
   * SEC-04: one face, good quality, plus head pose and eye state for the
   * liveness check. Throws FaceCheckFailure for photo problems.
   */
  async analyze(imageBase64: string): Promise<FaceAnalysis> {
    const res = await this.call<FppDetect>('detect', {
      image_base64: imageBase64,
      return_attributes: 'headpose,eyestatus,facequality',
    });
    const faces = res.faces ?? [];
    if (!faces.length) throw new FaceCheckFailure('NO_FACE');
    if ((res.face_num ?? faces.length) > 1) {
      throw new FaceCheckFailure('MANY_FACES');
    }
    const a = faces[0].attributes ?? {};
    const q = a.facequality;
    if (
      typeof q?.value !== 'number' ||
      typeof q.threshold !== 'number' ||
      q.value < q.threshold
    ) {
      throw new FaceCheckFailure('LOW_QUALITY');
    }
    const left = a.eyestatus?.left_eye_status;
    const right = a.eyestatus?.right_eye_status;
    return {
      faceToken: faces[0].face_token,
      yaw: a.headpose?.yaw_angle ?? 0,
      eyesOpen: Math.min(eyeOpen(left), eyeOpen(right)),
      eyesClosed: Math.min(eyeClosed(left), eyeClosed(right)),
    };
  }

  /** Face++ compare; decide with `isMatch()` from face-check.ts. */
  async compare(a: FaceSource, b: FaceSource): Promise<FaceMatch> {
    const res = await this.call<FppCompare>('compare', {
      ...this.side(a, '1'),
      ...this.side(b, '2'),
    });
    return { confidence: res.confidence, thresholds: res.thresholds };
  }

  private side(s: FaceSource, n: '1' | '2'): Record<string, string> {
    if ('faceToken' in s) return { [`face_token${n}`]: s.faceToken };
    if ('imageUrl' in s) return { [`image_url${n}`]: s.imageUrl };
    return { [`image_base64_${n}`]: s.imageBase64 };
  }

  /** POST to Face++; never logs images or full responses. */
  private async call<T>(
    endpoint: 'detect' | 'compare',
    fields: Record<string, string>,
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Face login is not available right now.',
      );
    }
    const form = new URLSearchParams({
      api_key: this.API_KEY!,
      api_secret: this.API_SECRET!,
      ...fields,
    }).toString();
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await axios.post<T>(`${FACEPP}/${endpoint}`, form, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 20_000,
        });
        return res.data;
      } catch (err) {
        const data = (
          err as { response?: { data?: { error_message?: string } } }
        ).response?.data;
        const code = String(data?.error_message ?? (err as Error).message);
        // the free key allows very few parallel calls: wait and retry
        if (code.startsWith('CONCURRENCY_LIMIT') && attempt < RETRIES.length) {
          await new Promise((r) => setTimeout(r, RETRIES[attempt]));
          continue;
        }
        this.logger.warn(`Face++ ${endpoint} failed: ${code.slice(0, 120)}`);
        if (/^(IMAGE_|INVALID_IMAGE)/.test(code)) {
          throw new FaceCheckFailure('BAD_IMAGE');
        }
        throw new ServiceUnavailableException(
          code.startsWith('CONCURRENCY_LIMIT')
            ? 'Face check is busy. Try again in a moment.'
            : 'Face login is not available right now.',
        );
      }
    }
  }
}
