// Small in-process TTL cache with in-flight de-duplication. Protects the free public
// OpenStreetMap / Wikipedia services from repeated identical requests.

type Entry = { expires: number; value: Promise<unknown> };

const MAX_ENTRIES = 600;
const g = globalThis as unknown as { __ofCache?: Map<string, Entry> };
const store: Map<string, Entry> = (g.__ofCache ??= new Map());

export function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    // refresh LRU position
    store.delete(key);
    store.set(key, hit);
    return hit.value as Promise<T>;
  }
  const value = fn();
  store.set(key, { expires: now + ttlMs, value });
  value.catch(() => {
    // never cache failures
    if (store.get(key)?.value === value) store.delete(key);
  });
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
  return value;
}

/** Serialises calls so at most one starts per `intervalMs` (e.g. Nominatim's 1 req/s policy). */
export function createThrottle(intervalMs: number) {
  let chain: Promise<void> = Promise.resolve();
  return function throttle<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(() => fn());
    chain = run.then(
      () => new Promise<void>((r) => setTimeout(r, intervalMs)),
      () => new Promise<void>((r) => setTimeout(r, intervalMs)),
    );
    return run;
  };
}

/** Limits how many calls run at the same time. */
export function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

const hits: Map<string, number[]> = ((g as { __ofRate?: Map<string, number[]> }).__ofRate ??= new Map());

/** Fixed-window-ish per-key rate limit. Returns true when the call is allowed. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return true;
}
