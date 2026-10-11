/**
 * Fixed-window, in-memory limits.
 *
 * Caveat: on serverless hosts each warm instance keeps its own map, so the
 * effective limit is "per instance". That is acceptable for v1 abuse
 * protection; swap `store` for Redis/Upstash when traffic warrants it.
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

export interface LimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

export function hit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  let w = store.get(key);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + windowMs };
    store.set(key, w);
  }
  const retryAfter = Math.ceil((w.resetAt - now) / 1000);
  if (w.count >= limit) return { ok: false, remaining: 0, retryAfter };
  w.count += 1;

  // Opportunistic cleanup so the map cannot grow without bound.
  if (store.size > 10_000) {
    for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
  }
  return { ok: true, remaining: limit - w.count, retryAfter };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const UPLOADS_PER_HOUR = Number(process.env.UPLOADS_PER_HOUR ?? 5);
export const LLM_CALLS_PER_HOUR_PER_IP = Number(process.env.LLM_CALLS_PER_HOUR_PER_IP ?? 20);
export const LLM_DAILY_CEILING = Number(process.env.LLM_DAILY_CEILING ?? 500);

export const limitUpload = (ip: string) => hit(`upload:${ip}`, UPLOADS_PER_HOUR, HOUR);
export const limitLlmIp = (ip: string) => hit(`llm:${ip}`, LLM_CALLS_PER_HOUR_PER_IP, HOUR);
/** Global across all users: protects the provider's free-tier quota. */
export const limitLlmGlobal = () => hit("llm:global", LLM_DAILY_CEILING, DAY);

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
