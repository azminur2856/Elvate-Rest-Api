import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createWorker, type Worker } from 'tesseract.js';

/** Free the worker's memory (~100 MB) after this long without a job. */
export const OCR_IDLE_MS = 5 * 60_000;

/**
 * SEC-17: one shared English Tesseract worker instead of a new one per
 * request. Jobs run one at a time (a queue), so parallel uploads cannot
 * spawn several WASM workers on the 512 MB Render box.
 */
@Injectable()
export class TesseractPool implements OnModuleDestroy {
  private readonly logger = new Logger(TesseractPool.name);
  private worker: Promise<Worker> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private idleTimer: NodeJS.Timeout | null = null;

  /** Recognises the image text; waits for earlier jobs to finish first. */
  recognize(image: Buffer): Promise<string> {
    const job = this.queue.then(async () => {
      this.cancelIdle();
      const worker = await this.getWorker();
      try {
        const { data } = await worker.recognize(image);
        return data.text;
      } finally {
        this.scheduleIdle();
      }
    });
    // keep the chain alive even when a job fails
    this.queue = job.catch(() => undefined);
    return job;
  }

  async onModuleDestroy(): Promise<void> {
    this.cancelIdle();
    await this.terminate();
  }

  private getWorker(): Promise<Worker> {
    if (!this.worker) {
      // no logger option: progress used to be console.log'ged per tick
      this.worker = createWorker('eng').catch((err: unknown) => {
        this.worker = null;
        throw err;
      });
    }
    return this.worker;
  }

  private scheduleIdle() {
    this.cancelIdle();
    this.idleTimer = setTimeout(() => void this.terminate(), OCR_IDLE_MS);
    this.idleTimer.unref();
  }

  private cancelIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private async terminate(): Promise<void> {
    const current = this.worker;
    this.worker = null;
    if (!current) return;
    try {
      await (await current).terminate();
    } catch (err) {
      this.logger.warn(`Could not stop the OCR worker: ${String(err)}`);
    }
  }
}
