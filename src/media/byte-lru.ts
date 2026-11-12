/** Small in-memory LRU for image bytes, bounded by total size and age. */
export class ByteLru<V extends { body: Buffer }> {
  private readonly items = new Map<string, { value: V; until: number }>();
  private bytes = 0;

  constructor(
    private readonly maxBytes: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string, now = Date.now()): V | undefined {
    const hit = this.items.get(key);
    if (!hit) return undefined;
    this.items.delete(key);
    if (hit.until <= now) {
      this.bytes -= hit.value.body.length;
      return undefined;
    }
    this.items.set(key, hit); // most recently used goes last
    return hit.value;
  }

  set(key: string, value: V, now = Date.now()): void {
    if (value.body.length > this.maxBytes) return;
    const old = this.items.get(key);
    if (old) {
      this.items.delete(key);
      this.bytes -= old.value.body.length;
    }
    this.items.set(key, { value, until: now + this.ttlMs });
    this.bytes += value.body.length;
    // evict least recently used until under budget
    for (const [k, v] of this.items) {
      if (this.bytes <= this.maxBytes) break;
      this.items.delete(k);
      this.bytes -= v.value.body.length;
    }
  }

  get size() {
    return this.items.size;
  }

  get totalBytes() {
    return this.bytes;
  }
}
