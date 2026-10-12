/**
 * Per-route rate limiting: one policy table (LIMITS), one entry point (rateLimit).
 *
 * Algorithm: fixed windows that start at a client's first request (count +
 * expiry per key). A policy may have several windows (e.g. 8 per 10 min AND
 * 30 per day); every window is counted on every request and the request is
 * refused when ANY window is over its limit. Refused requests still count, so
 * a client that keeps hammering stays blocked until its windows expire instead
 * of being let back in the moment one window rolls over.
 *
 * Stores:
 * - In-memory (default). On serverless hosts (Vercel) every warm instance has
 *   its own Map and instances come and go, so the effective limit is "per
 *   instance": N instances allow up to N× the configured numbers, and a cold
 *   start resets the counters. Fine for development and as a fallback, not a
 *   real global limit.
 * - Upstash Redis over its REST API (plain fetch, no SDK), used automatically
 *   when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or the Vercel KV
 *   names KV_REST_API_URL + KV_REST_API_TOKEN) are set. Counters are then
 *   shared by every instance, which is what makes the limits (and the global
 *   LLM ceiling) actually global.
 *   If Redis fails, each policy decides: "open" (cheap routes: allow the
 *   request) or "memory" (expensive routes: fall back to the per-instance
 *   in-memory limiter, never unlimited).
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

interface Window {
  /** Counter name. Two policies that list the same bucket share one counter (e.g. llm-day). */
  bucket: string;
  limit: number;
  ms: number;
  /** Used in the user-facing message: "… 8 resume checks in 10 minutes". */
  label: string;
}

interface Policy {
  windows: readonly Window[];
  /** What to do when the shared store (Redis) is unreachable. */
  onStoreError: "open" | "memory";
  /** One counter for everyone instead of one per client IP. */
  global?: boolean;
  /** Plural noun for messages. */
  noun: string;
}

const w = (bucket: string, limit: number, ms: number, label: string): Window => ({ bucket, limit, ms, label });

/**
 * Provider quotas the whole site must stay under (all visitors combined). Set them
 * to ~90% of what your accounts allow:
 * - Gemini: AI Studio → your project → Rate limits (per project; RPD resets at
 *   midnight Pacific). Defaults are deliberately conservative free-tier values.
 * - OpenRouter free models: 20/min, and 50/day with < 10 credits purchased
 *   (1,000/day with ≥ 10); the day resets at midnight UTC.
 */
export const PROVIDER_QUOTAS = {
  gemini: {
    rpm: positiveInt(process.env.GEMINI_RPM, 13),
    rpd: positiveInt(process.env.GEMINI_RPD, 450),
    dayZone: "America/Los_Angeles",
  },
  openrouter: {
    rpm: positiveInt(process.env.OPENROUTER_RPM, 16),
    rpd: positiveInt(process.env.OPENROUTER_RPD, 45),
    dayZone: "UTC",
  },
} as const;

/**
 * Global LLM calls per day across all users. Defaults to what the providers can
 * serve together; set LLM_DAILY_CEILING lower to cap spend further.
 */
export const LLM_DAILY_CEILING = positiveInt(
  process.env.LLM_DAILY_CEILING,
  PROVIDER_QUOTAS.gemini.rpd + PROVIDER_QUOTAS.openrouter.rpd,
);

/**
 * THE rate-limit policy. Every API route uses exactly one entry per check.
 * Numbers are per client IP (see clientIp) unless `global` is set.
 */
export const LIMITS = {
  /**
   * POST /api/analyze — the CPU-heavy path: pdf.js / mammoth parsing of a file
   * up to 4 MB plus every check (~0.2–2.5 s of CPU each). A person fixing a
   * resume re-checks it a few times in a sitting (the builder's "check again"
   * also lands here), so 8 per 10 minutes never gets in their way while a
   * script is held to < 1 request/minute; 30 a day caps the long tail.
   */
  analyze: {
    windows: [w("analyze-10m", 8, 10 * MIN, "in 10 minutes"), w("analyze-day", 30, DAY, "today")],
    onStoreError: "memory",
    noun: "resume checks",
  },
  /** POST /api/linkedin/analyze — same parser and cost profile as analyze, separate budget. */
  linkedin: {
    windows: [w("linkedin-10m", 8, 10 * MIN, "in 10 minutes"), w("linkedin-day", 30, DAY, "today")],
    onStoreError: "memory",
    noun: "profile checks",
  },
  /**
   * POST /api/match — re-scores keyword match from the result the client already
   * holds: pure string work, a few ms. Generous because people paste several job
   * descriptions in a row; fails open because blocking it protects little.
   */
  match: {
    windows: [w("match-1h", 60, HOUR, "in an hour")],
    onStoreError: "open",
    noun: "job description comparisons",
  },
  /**
   * POST /api/llm, light tasks (explain, rewrite-bullet, rewrite-summary): one
   * short completion (≤400 output tokens). 30/hour is far above what a person
   * clicks through while still bounding paid usage per visitor.
   */
  llmLight: {
    windows: [w("llm-light-1h", 30, HOUR, "in an hour"), w("llm-day", 40, DAY, "today")],
    onStoreError: "memory",
    noun: "AI requests",
  },
  /**
   * POST /api/llm, heavy tasks (rewrite-bullets, linkedin-review,
   * generate-resume): long structured JSON (up to LLM_STRUCTURED_MAX_TOKENS
   * output tokens) and up to 60 s of function time each. The UI sends at most
   * 2–3 of these per click (bullet batches of 15), so 8/hour covers real use.
   * Shares the 40/day per-IP AI budget with the light tasks.
   */
  llmHeavy: {
    windows: [w("llm-heavy-1h", 8, HOUR, "in an hour"), w("llm-day", 40, DAY, "today")],
    onStoreError: "memory",
    noun: "AI requests",
  },
  /**
   * All AI calls from everyone, per day (LLM_DAILY_CEILING, default 500). Only
   * charged for valid requests that are about to call a configured provider.
   */
  llmGlobal: {
    windows: [w("llm-global-day", LLM_DAILY_CEILING, DAY, "today")],
    onStoreError: "memory",
    global: true,
    noun: "AI requests",
  },
  /**
   * POST /api/export — renders a DOCX/PDF (pdf-lib/docx, ~50–300 ms CPU). The
   * builder's preview, download and "check again" each call it, so an editing
   * session can use a dozen or two an hour.
   */
  export: {
    windows: [w("export-1h", 30, HOUR, "in an hour")],
    onStoreError: "memory",
    noun: "file exports",
  },
  /**
   * GET /api/export?template=… — sample templates; the bytes come from the
   * "use cache" store, so a request costs almost nothing. The limit only stops
   * bulk scraping; fails open.
   */
  exportSample: {
    windows: [w("sample-1h", 60, HOUR, "in an hour")],
    onStoreError: "open",
    noun: "template downloads",
  },
} as const satisfies Record<string, Policy>;

export type PolicyName = keyof typeof LIMITS;

/**
 * Clients whose IP can't be determined share ONE bucket per window with half
 * the normal limit: stricter than a single client, never unlimited. On Vercel
 * this should not happen (the platform always sets the client IP header).
 */
const UNKNOWN_IP = "unknown";
const unknownLimit = (limit: number) => Math.max(1, Math.floor(limit / 2));

/* ------------------------------------------------------------------ */
/* Client IP                                                           */
/* ------------------------------------------------------------------ */

/**
 * The client's IP, normalised into a rate-limit key.
 *
 * Header order: x-vercel-forwarded-for (set by Vercel's edge, cannot be
 * forged through it), then x-real-ip, then the FIRST x-forwarded-for entry
 * (the original client; later entries are proxies). These headers are only
 * trustworthy behind a proxy that overwrites them (Vercel does). If the app
 * is ever exposed directly, a client could pick its own key; put it behind a
 * proxy that sets them.
 *
 * IPv6 addresses are grouped by /64 (one subscriber usually gets a whole /64,
 * so rotating through it must not mint new buckets). IPv4-mapped IPv6 becomes
 * plain IPv4. Anything unparseable becomes "unknown".
 */
export function clientIp(req: Request | Headers): string {
  const h = req instanceof Headers ? req : req.headers;
  const candidates = [
    h.get("x-vercel-forwarded-for")?.split(",")[0],
    h.get("x-real-ip"),
    h.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const c of candidates) {
    const ip = normaliseIp(c);
    if (ip) return ip;
  }
  return UNKNOWN_IP;
}

/** Exported for tests. Returns null when `raw` isn't an IP address. */
export function normaliseIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s || s.length > 100) return null;

  // "[v6]:port" / "[v6]"
  const bracket = /^\[([^\]]+)\](?::\d+)?$/.exec(s);
  if (bracket) s = bracket[1];
  // "v4:port"
  const v4port = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(s);
  if (v4port) s = v4port[1];

  if (isIPv4(s)) return s.split(".").map(Number).join(".");
  s = s.replace(/%.*$/, ""); // zone id
  const groups = expandIPv6(s);
  if (!groups) return null;
  // ::ffff:a.b.c.d (IPv4-mapped)
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join(".");
  }
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
}

function isIPv4(s: string): boolean {
  const parts = s.split(".");
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/** Eight 16-bit groups, or null when `s` isn't a valid IPv6 address. */
function expandIPv6(s: string): number[] | null {
  if (!/^[0-9a-fA-F:.]+$/.test(s) || !s.includes(":")) return null;
  // Trailing embedded IPv4 (::ffff:1.2.3.4) -> two groups.
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (v4) {
    if (!isIPv4(v4[1])) return null;
    const [a, b, c, d] = v4[1].split(".").map(Number);
    s = s.slice(0, -v4[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part ? part.split(":") : []);
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : fill < 1) return null;
  const all = [...head, ...Array(halves.length === 2 ? fill : 0).fill("0"), ...tail];
  if (all.length !== 8 || all.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return null;
  return all.map((g) => parseInt(g, 16));
}

/* ------------------------------------------------------------------ */
/* Stores                                                              */
/* ------------------------------------------------------------------ */

interface Counted {
  count: number;
  /** ms until this window resets. */
  resetMs: number;
}

interface Store {
  /** Increment every key once (creating it with its window if missing). */
  incr(keys: { key: string; ms: number }[]): Promise<Counted[]>;
}

const KEY_PREFIX = "rl:v1";
const memory = new Map<string, { count: number; resetAt: number }>();

const memoryStore: Store = {
  async incr(keys) {
    const now = Date.now();
    const out = keys.map(({ key, ms }) => {
      let e = memory.get(key);
      if (!e || e.resetAt <= now) {
        e = { count: 0, resetAt: now + ms };
        memory.set(key, e);
      }
      e.count += 1;
      return { count: e.count, resetMs: e.resetAt - now };
    });
    // Opportunistic cleanup so the map cannot grow without bound.
    if (memory.size > 20_000) for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    return out;
  },
};

function redisConfig(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)?.trim();
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

const REDIS_TIMEOUT_MS = 1000;
/** After a Redis failure, skip it for this long instead of paying the timeout on every request. */
const REDIS_COOLDOWN_MS = 30_000;
let redisDownUntil = 0;

class StoreError extends Error {}

/**
 * Upstash REST, one round trip, one MULTI/EXEC transaction. Per key:
 *   SET key 0 PX <window> NX   -> starts the window (with its expiry) only if absent
 *   INCR key                   -> atomic count; keeps the TTL set above
 *   PTTL key                   -> time left in the window
 * Equivalent to INCR + EXPIRE-on-first-hit, but a key can never end up
 * without a TTL and it needs no Redis 7 "EXPIRE … NX".
 */
function redisStore(cfg: { url: string; token: string }): Store {
  return {
    async incr(keys) {
      const cmds = keys.flatMap(({ key, ms }) => [
        ["SET", key, "0", "PX", String(ms), "NX"],
        ["INCR", key],
        ["PTTL", key],
      ]);
      let res: Response;
      try {
        res = await fetch(`${cfg.url}/multi-exec`, {
          method: "POST",
          headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
          body: JSON.stringify(cmds),
          signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
          cache: "no-store",
        });
      } catch (e) {
        throw new StoreError((e as Error)?.name === "TimeoutError" ? "timeout" : "network");
      }
      if (!res.ok) throw new StoreError(`http ${res.status}`);
      const data = (await res.json().catch(() => null)) as { result?: unknown; error?: unknown }[] | null;
      if (!Array.isArray(data) || data.length !== cmds.length) throw new StoreError("bad response");
      return keys.map(({ ms }, i) => {
        const count = data[i * 3 + 1]?.result;
        const pttl = data[i * 3 + 2]?.result;
        if (typeof count !== "number") throw new StoreError("bad response");
        return { count, resetMs: typeof pttl === "number" && pttl > 0 ? pttl : ms };
      });
    },
  };
}

/** Test seam: force a store ("memory" or a Redis config); null restores env-based selection. */
let storeOverride: Store | null = null;
export function setRateLimitStoreForTesting(s: "memory" | { url: string; token: string } | null): void {
  storeOverride = s === null ? null : s === "memory" ? memoryStore : redisStore(s);
  redisDownUntil = 0;
}
export function resetMemoryStoreForTesting(): void {
  memory.clear();
}
/** Test seam: end one in-memory window early (simulates time passing for that bucket only). */
export function expireMemoryWindowForTesting(bucket: string, who: string): void {
  memory.delete(`${KEY_PREFIX}:${bucket}:${who}`);
}

/** Which backend is active; for diagnostics only (never exposes the URL or token). */
export function rateLimitBackend(): "redis" | "memory" {
  if (storeOverride) return storeOverride === memoryStore ? "memory" : "redis";
  return redisConfig() ? "redis" : "memory";
}

async function incrWithFallback(
  keys: { key: string; ms: number }[],
  onStoreError: Policy["onStoreError"],
): Promise<Counted[] | "open"> {
  const cfg = storeOverride ? null : redisConfig();
  const primary = storeOverride ?? (cfg ? redisStore(cfg) : memoryStore);
  if (primary === memoryStore) return memoryStore.incr(keys);

  if (Date.now() >= redisDownUntil) {
    try {
      return await primary.incr(keys);
    } catch (e) {
      redisDownUntil = Date.now() + REDIS_COOLDOWN_MS;
      // Error class only: never the URL, token or keys (keys contain IPs).
      console.error(`[rate-limit] redis unavailable (${e instanceof StoreError ? e.message : "error"}); using ${onStoreError === "open" ? "fail-open" : "in-memory"} for ${REDIS_COOLDOWN_MS / 1000}s`);
    }
  }
  return onStoreError === "open" ? "open" : memoryStore.incr(keys);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Spend one unit from site-wide budgets (no client IP): used for provider
 * quotas. Each window is a fixed bucket name chosen by the caller (e.g. one per
 * calendar day in the provider's reset time zone), so windows line up with the
 * provider's own resets. Returns the first window that is over its limit.
 */
export async function spendGlobalBudget(
  windows: { bucket: string; limit: number; ms: number }[],
): Promise<{ ok: true } | { ok: false; bucket: string; retryAfter: number }> {
  const keys = windows.map((win) => ({ key: `${KEY_PREFIX}:budget:${win.bucket}`, ms: win.ms }));
  const counted = await incrWithFallback(keys, "memory");
  if (counted === "open") return { ok: true };
  for (let i = 0; i < windows.length; i++) {
    if (counted[i].count > windows[i].limit) {
      return { ok: false, bucket: windows[i].bucket, retryAfter: Math.max(1, Math.ceil(counted[i].resetMs / 1000)) };
    }
  }
  return { ok: true };
}

export interface RateDecision {
  ok: boolean;
  /** The window that decides the headers: the one that blocked, else the one with the fewest requests left. */
  limit: number;
  remaining: number;
  /** Seconds until that window resets. */
  reset: number;
  /** Seconds until a refused client may retry (0 when ok). */
  retryAfter: number;
  /** Label of the window that blocked ("in 10 minutes", "today"); null when ok. */
  blockedLabel: string | null;
  /** RateLimit-* (+ Retry-After when refused) headers to send back. */
  headers: Record<string, string>;
}

/** Count one request against `policy` for this client and decide. */
export async function rateLimit(policy: PolicyName, ip: string): Promise<RateDecision> {
  const p: Policy = LIMITS[policy];
  const who = p.global ? "global" : ip;
  const unknown = !p.global && ip === UNKNOWN_IP;
  const windows = p.windows.map((win) => ({ ...win, limit: unknown ? unknownLimit(win.limit) : win.limit }));
  const keys = windows.map((win) => ({ key: `${KEY_PREFIX}:${win.bucket}:${who}`, ms: win.ms }));

  const counted = await incrWithFallback(keys, p.onStoreError);
  const policyHeader = windows.map((win) => `${win.limit};w=${Math.round(win.ms / 1000)}`).join(", ");

  if (counted === "open") {
    const first = windows[0];
    return {
      ok: true,
      limit: first.limit,
      remaining: first.limit,
      reset: Math.round(first.ms / 1000),
      retryAfter: 0,
      blockedLabel: null,
      headers: {},
    };
  }

  const state = windows.map((win, i) => ({
    win,
    count: counted[i].count,
    remaining: Math.max(0, win.limit - counted[i].count),
    reset: Math.max(1, Math.ceil(counted[i].resetMs / 1000)),
  }));
  const over = state.filter((s) => s.count > s.win.limit);
  // Refused: retry only once every exceeded window has reset. Allowed: report the tightest window.
  const binding = over.length
    ? over.reduce((a, b) => (b.reset > a.reset ? b : a))
    : state.reduce((a, b) => (b.remaining < a.remaining || (b.remaining === a.remaining && b.reset > a.reset) ? b : a));

  const headers: Record<string, string> = {
    "RateLimit-Limit": String(binding.win.limit),
    "RateLimit-Remaining": String(binding.remaining),
    "RateLimit-Reset": String(binding.reset),
    "RateLimit-Policy": policyHeader,
  };
  if (over.length) headers["Retry-After"] = String(binding.reset);

  return {
    ok: over.length === 0,
    limit: binding.win.limit,
    remaining: binding.remaining,
    reset: binding.reset,
    retryAfter: over.length ? binding.reset : 0,
    blockedLabel: over.length ? binding.win.label : null,
    headers,
  };
}

/** "about 7 minutes" / "about 3 hours". */
export function waitText(seconds: number): string {
  const mins = Math.max(1, Math.ceil(seconds / 60));
  if (mins < 60) return `about ${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.round(mins / 60);
  return `about ${hours} hour${hours === 1 ? "" : "s"}`;
}

/** Friendly 429 text for a refused decision, e.g. "You've reached the limit of 8 resume checks in 10 minutes. You can try again in about 7 minutes." */
export function limitMessage(policy: PolicyName, d: RateDecision): string {
  return `You've reached the limit of ${d.limit} ${LIMITS[policy].noun} ${d.blockedLabel ?? ""}`.trimEnd() +
    `. You can try again in ${waitText(d.retryAfter)}.`;
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}
