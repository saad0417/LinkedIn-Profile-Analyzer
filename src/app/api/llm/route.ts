/**
 * POST /api/llm
 * Body: LLMTask JSON. Response: LLMResponse JSON.
 *
 * Optional AI help: bullet/summary rewrites, check explanations, batch
 * bullet rewrites (rewrite-bullets), the LinkedIn review (linkedin-review)
 * and the resume generator (generate-resume). Every request, batch or not,
 * is ONE provider call and counts once against the per-IP and daily limits.
 * Scoring never depends on this route. User text is never logged.
 */
import type { LLMResponse } from "@/lib/types";
import { clientIp, limitLlmGlobal, limitLlmIp } from "@/lib/security/rate-limit";
import { getProvider, LLMUnavailableError, parseLLMTask, runTask, type LLMProvider } from "@/lib/llm";
import { LLM_LIMITS } from "@/lib/llm/validate";

// Structured tasks write long JSON; the provider timeout is 45 s.
export const maxDuration = 60;

const MESSAGES = {
  bad_request: "That request couldn't be processed.",
  rate_limited: "You've made a lot of AI requests this hour. Please try again a little later.",
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

export async function POST(request: Request): Promise<Response> {
  // ---- parse + validate (cheap, before touching any quota) ----
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    return fail("bad_request", 400, "Send the request as JSON.");
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > LLM_LIMITS.bodyBytes) return fail("bad_request", 400, "Request is too large.");

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return fail("bad_request", 400);
  }
  if (Buffer.byteLength(raw, "utf8") > LLM_LIMITS.bodyBytes) return fail("bad_request", 400, "Request is too large.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("bad_request", 400, "Request body isn't valid JSON.");
  }
  const parsed = parseLLMTask(body);
  if (!parsed.ok) return fail("bad_request", 400, parsed.error);

  // ---- per-IP limit ----
  const ipLimit = limitLlmIp(clientIp(request));
  if (!ipLimit.ok) {
    return fail("rate_limited", 429, undefined, { "Retry-After": String(ipLimit.retryAfter) });
  }

  // ---- provider availability (don't burn the global ceiling when unconfigured) ----
  let provider: LLMProvider;
  try {
    provider = getProvider();
  } catch (err) {
    if (!(err instanceof LLMUnavailableError)) console.error("[llm] provider init failed");
    return fail("unavailable", 503);
  }

  // ---- global daily ceiling (protects the free-tier quota) ----
  const global = limitLlmGlobal();
  if (!global.ok) {
    return fail("daily_limit", 429, undefined, { "Retry-After": String(global.retryAfter) });
  }

  // ---- call ----
  try {
    const result = await runTask(parsed.task, provider);
    return reply({ ok: true, ...result }, 200);
  } catch (err) {
    // Log only the error class and upstream status: never user text, never provider messages.
    const status = (err as { status?: unknown })?.status;
    console.error(`[llm] ${parsed.task.task} failed: ${(err as Error)?.name ?? "Error"}${typeof status === "number" ? ` (${status})` : ""}`);
    return fail("unavailable", 503);
  }
}
