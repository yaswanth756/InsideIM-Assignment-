const cache = new Map();
const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  console.log(`[cache] HIT: ${key}`);
  return entry.value;
}

export function setCache(key, value, ttl = DEFAULT_TTL) {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  console.log(`[cache] SET: ${key} (TTL: ${ttl / 1000}s)`);
}

export function clearExpired() {
  const now = Date.now();
  let cleared = 0;
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
      cleared++;
    }
  }
  if (cleared > 0) console.log(`[cache] Cleared ${cleared} expired entries`);
}

export function getCacheStats() {
  return { size: cache.size, keys: [...cache.keys()] };
}

setInterval(clearExpired, 5 * 60 * 1000);
