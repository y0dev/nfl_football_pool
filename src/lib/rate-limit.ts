type Entry = { count: number; resetAt: number };
const _store = new Map<string, Entry>();

// Prune expired entries every 5 minutes to prevent unbounded memory growth
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, e] of _store) {
      if (now > e.resetAt) _store.delete(key);
    }
  }, 5 * 60 * 1000);
  // Don't hold the process open in non-server environments
  timer.unref?.();
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * State is in-memory per server instance — good enough for this app's threat model.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = _store.get(key);
  if (!entry || now > entry.resetAt) {
    _store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
