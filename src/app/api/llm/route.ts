/**
 * POST /api/llm
 * Body: LLMTask JSON. Response: LLMResponse JSON.
 *
 * Optional AI help: bullet/summary rewrites, check explanations, batch
 * bullet rewrites (rewrite-bullets), the LinkedIn review (linkedin-review)
 * and the resume generator (generate-resume). Every request, batch or not,
 * is ONE provider call. Scoring never depends on this route. User text is
 * never logged.
 *
 * Limits (see LIMITS in rate-limit.ts): per IP, light and heavy tasks have
 * separate hourly buckets plus a shared daily one; the global daily ceiling is
 * charged only for valid requests with a configured provider.
 */
import type { LLMResponse } from "@/lib/types";
import { clientIp, limitMessage, rateLimit, waitText } from "@/lib/security/rate-limit";
import { declaresTooLarge, isCrossSite, isJsonContentType, parseJson, readBodyCapped } from "@/lib/security/request";
import { getProvider, LLMBudgetError, LLMUnavailableError, parseLLMTask, runTask, type LLMProvider } from "@/lib/llm";
import { LLM_LIMITS } from "@/lib/llm/validate";

// Structured tasks write long JSON; the provider timeout is 45 s.
export const maxDuration = 60;

/** Long structured outputs: charged to the smaller "heavy" bucket. Everything else (incl. unknown tasks) is "light". */
const HEAVY_TASKS = new Set(["rewrite-bullets", "linkedin-review", "generate-resume"]);

const MESSAGES = {
  bad_request: "That request couldn't be processed.",
  rate_limited: "You've made a lot of AI requests. Please try again a little later.",
  daily_limit:
    "Today's free AI rewrites are used up. They reset daily. Every check and score still works without them.",
  unavailable:
    "AI rewrites aren't available right now. Every check and score still works without them.",
} as const;

function reply(body: LLMResponse, status: number, extra?: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });
}

const fail = (code: Exclude<LLMResponse, { ok: true }>["code"], status: number, error?: string, extra?: Record<string, string>) =>
  reply({ ok: false, code, error: error ?? MESSAGES[code] }, status, extra);

/**
 * Order: cross-site / content-type / declared size (free) -> read the body
 * (capped at 128 KB) -> per-IP limit -> validation -> provider check ->
 * global daily ceiling -> provider call.
 *
 * The body is read before the per-IP limit because the bucket depends on the
 * task name inside it; reading and JSON-parsing ≤ 128 KB is cheap and bounded.
 * Malformed bodies are still charged to the per-IP light bucket, so they
 * can't be used to probe for free, but never to the global ceiling.
 */
export async function POST(request: Request): Promise<Response> {
  if (isCrossSite(request)) return fail("bad_request", 403, "Cross-site requests aren't allowed.");
  if (!isJsonContentType(request)) return fail("bad_request", 400, "Send the request as JSON.");
  if (declaresTooLarge(request, LLM_LIMITS.bodyBytes)) return fail("bad_request", 413, "Request is too large.");

  const raw = await readBodyCapped(request, LLM_LIMITS.bodyBytes);
  if (!raw.ok) return fail("bad_request", raw.reason === "too_large" ? 413 : 400, raw.reason === "too_large" ? "Request is too large." : undefined);
  const body = parseJson(raw.bytes);

  // ---- per-IP limit (bucket by task weight) ----
  const taskName = body && typeof body === "object" ? (body as { task?: unknown }).task : undefined;
  const policy = typeof taskName === "string" && HEAVY_TASKS.has(taskName) ? "llmHeavy" : "llmLight";
  const ipLimit = await rateLimit(policy, clientIp(request));
  if (!ipLimit.ok) return fail("rate_limited", 429, limitMessage(policy, ipLimit), ipLimit.headers);
  const rl = ipLimit.headers;

  // ---- validate (keeps lib/llm/validate.ts as the single source of truth) ----
  if (body === undefined) return fail("bad_request", 400, "Request body isn't valid JSON.", rl);
  let parsed: ReturnType<typeof parseLLMTask>;
  try {
    parsed = parseLLMTask(body);
  } catch {
    return fail("bad_request", 400, undefined, rl);
  }
  if (!parsed.ok) return fail("bad_request", 400, parsed.error, rl);

  // ---- provider availability (don't burn the global ceiling when unconfigured) ----
  let provider: LLMProvider;
  try {
    provider = getProvider();
  } catch (err) {
    if (!(err instanceof LLMUnavailableError)) console.error("[llm] provider init failed");
    return fail("unavailable", 503, undefined, rl);
  }

  // ---- global daily ceiling (protects the free-tier quota) ----
  const global = await rateLimit("llmGlobal", "global");
  if (!global.ok) {
    const msg = `Today's free AI rewrites are used up; more will be available in ${waitText(global.retryAfter)}. Every check and score still works without them.`;
    return fail("daily_limit", 429, msg, {
      ...rl,
      "Retry-After": String(global.retryAfter),
    });
  }

  // ---- call ----
  try {
    const result = await runTask(parsed.task, provider);
    return reply({ ok: true, ...result }, 200, rl);
  } catch (err) {
    if (err instanceof LLMBudgetError) {
      const msg =
        err.scope === "day"
          ? `Today's free AI help is used up; it comes back in ${waitText(err.retryAfter)}. Every check and score still works without it.`
          : "Our AI helpers are busy right now. Please try again in a minute. Every check and score still works without them.";
      return fail("daily_limit", 429, msg, { ...rl, "Retry-After": String(err.retryAfter) });
    }
    // Log only the error class and upstream status: never user text, never provider messages.
    const status = (err as { status?: unknown })?.status;
    console.error(`[llm] ${parsed.task.task} failed: ${(err as Error)?.name ?? "Error"}${typeof status === "number" ? ` (${status})` : ""}`);
    return fail("unavailable", 503, undefined, rl);
  }
}
