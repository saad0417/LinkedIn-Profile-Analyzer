import { rematch } from "@/lib/analyze";
import { sanitizeDocHtml } from "@/lib/sanitize";
import { clientIp, limitMessage, rateLimit } from "@/lib/security/rate-limit";
import { declaresTooLarge, isCrossSite, parseJson, readBodyCapped } from "@/lib/security/request";
import type { AnalysisResult, AnalyzeResponse } from "@/lib/types";

// Pure string work (a few ms); a hard ceiling in case of a pathological body.
export const maxDuration = 10;

const MAX_BODY_BYTES = 1_500_000;
const MAX_JD_CHARS = 20_000;
const TOO_LARGE = "That request is too large.";

function reply(body: AnalyzeResponse, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * Re-score Job Match against a new job description without re-uploading the
 * file. Works from the previous AnalysisResult, which the client already holds.
 *
 * Order: cross-site / size checks -> rate limit -> read the body (capped) -> parse -> work.
 */
export async function POST(req: Request) {
  if (isCrossSite(req)) return reply({ ok: false, code: "bad_request", error: "Cross-site requests aren't allowed." }, 403);
  if (declaresTooLarge(req, MAX_BODY_BYTES)) return reply({ ok: false, code: "too_large", error: TOO_LARGE }, 413);

  const limit = await rateLimit("match", clientIp(req));
  if (!limit.ok) {
    return reply({ ok: false, code: "rate_limited", error: limitMessage("match", limit) }, 429, limit.headers);
  }
  const rl = limit.headers;

  const raw = await readBodyCapped(req, MAX_BODY_BYTES);
  if (!raw.ok) {
    return raw.reason === "too_large"
      ? reply({ ok: false, code: "too_large", error: TOO_LARGE }, 413, rl)
      : reply({ ok: false, code: "bad_request", error: "Malformed request." }, 400, rl);
  }
  const body = parseJson(raw.bytes) as { result?: AnalysisResult; jd?: unknown } | null | undefined;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return reply({ ok: false, code: "bad_request", error: "Malformed request." }, 400, rl);
  }

  const result = body.result;
  if (!result || result.version !== 1 || !result.profile || typeof result.rawText !== "string" || !Array.isArray(result.checks)) {
    return reply({ ok: false, code: "bad_request", error: "Run a check on your resume first." }, 400, rl);
  }
  const jd = typeof body.jd === "string" && body.jd.trim() ? body.jd.trim().slice(0, MAX_JD_CHARS) : null;

  try {
    const out = rematch(result, jd);
    // The result came from the client: never echo back unsanitised preview HTML.
    out.sourceHtml = typeof out.sourceHtml === "string" ? sanitizeDocHtml(out.sourceHtml) : null;
    return reply({ ok: true, result: out }, 200, rl);
  } catch {
    return reply({ ok: false, code: "bad_request", error: "We couldn't compare that job description. Please try again." }, 400, rl);
  }
}
