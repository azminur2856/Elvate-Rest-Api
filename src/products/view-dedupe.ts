/** A product view counts once per visitor (user or IP) per hour (SEC-23). */
export const VIEW_WINDOW_MS = 60 * 60_000;
/** Memory guard: above this many entries expired ones are dropped. */
const MAX_ENTRIES = 20_000;

/**
 * In-memory "seen recently" set for viewCount. Render runs one instance, so
 * process memory is enough; a restart only means a few extra counts.
 */
export class ViewDedupe {
  private readonly seen = new Map<string, number>();

  /** True when this visitor has not viewed this product within the window. */
  shouldCount(productId: string, visitor: string, now = Date.now()): boolean {
    const key = `${productId}|${visitor}`;
    const until = this.seen.get(key);
    if (until !== undefined && until > now) return false;
    if (this.seen.size >= MAX_ENTRIES) this.prune(now);
    this.seen.set(key, now + VIEW_WINDOW_MS);
    return true;
  }

  get size() {
    return this.seen.size;
  }

  private prune(now: number) {
    for (const [key, until] of this.seen) {
      if (until <= now) this.seen.delete(key);
    }
    // still full: forget everything rather than grow without bound
    if (this.seen.size >= MAX_ENTRIES) this.seen.clear();
  }
}
