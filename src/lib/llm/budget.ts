import { PROVIDER_QUOTAS, spendGlobalBudget } from "@/lib/security/rate-limit";

/**
 * Site-wide quota guard for each AI provider, checked BEFORE every call so the
 * site never sends a provider more than its account allows. When a provider's
 * budget for this minute or day is spent, the chain skips straight to the next
 * provider instead of collecting an over-quota error.
 *
 * Windows line up with the providers' own resets: one bucket per calendar
 * minute, and one per calendar day in the provider's reset time zone (Gemini:
 * midnight Pacific; OpenRouter: midnight UTC). A rolling 24 h window could
 * straddle two provider days and allow up to twice the daily quota in one.
 *
 * Accuracy: with Upstash configured the counters are shared by every server
 * instance; without it each instance counts on its own (the provider's own 429
 * still triggers the fallback, so the worst case is a slower answer).
 */

export type BudgetedProvider = keyof typeof PROVIDER_QUOTAS;

export type BudgetDecision = { ok: true } | { ok: false; scope: "minute" | "day"; retryAfter: number };

const MINUTE = 60_000;

function dayStamp(zone: string, now: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function msUntilMidnight(zone: string, now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsed = (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000;
  return Math.max(MINUTE, 86_400_000 - elapsed);
}

export async function spendProviderBudget(provider: BudgetedProvider, now = new Date()): Promise<BudgetDecision> {
  const q = PROVIDER_QUOTAS[provider];
  const minuteBucket = `${provider}-min:${Math.floor(now.getTime() / MINUTE)}`;
  const dayBucket = `${provider}-day:${dayStamp(q.dayZone, now)}`;
  // Minute first, then day: a request refused by the per-minute limit never reaches the
  // provider, so it must not use up the (scarcer) daily allowance.
  const minute = await spendGlobalBudget([{ bucket: minuteBucket, limit: q.rpm, ms: 2 * MINUTE }]);
  if (!minute.ok) return { ok: false, scope: "minute", retryAfter: 60 - (Math.floor(now.getTime() / 1000) % 60) };
  // TTL outlives the day slightly; the bucket name (the provider's calendar day), not the TTL, defines the window.
  const day = await spendGlobalBudget([{ bucket: dayBucket, limit: q.rpd, ms: msUntilMidnight(q.dayZone, now) + 60 * MINUTE }]);
  if (!day.ok) return { ok: false, scope: "day", retryAfter: Math.ceil(msUntilMidnight(q.dayZone, now) / 1000) };
  return { ok: true };
}
