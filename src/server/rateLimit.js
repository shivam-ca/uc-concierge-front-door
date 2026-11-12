// Best-effort, per function instance. Vercel may run several instances; this only blunts casual abuse of the API key.
export function createRateLimiter({ limit = 20, windowMs = 60000, now = Date.now } = {}) {
  const hits = new Map();
  return {
    hit(key) {
      const t = now();
      const recent = (hits.get(key) || []).filter(x => t - x < windowMs);
      if (recent.length >= limit) { hits.set(key, recent); return false; }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 5000) hits.clear(); // bound memory
      return true;
    },
  };
}
