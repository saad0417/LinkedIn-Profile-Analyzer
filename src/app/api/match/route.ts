import { rematch } from "@/lib/analyze";
import { clientIp, hit } from "@/lib/security/rate-limit";
import type { AnalysisResult, AnalyzeResponse } from "@/lib/types";


const MAX_BODY_BYTES = 1_500_000;
const MAX_JD_CHARS = 20_000;

function reply(body: AnalyzeResponse, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Re-score Job Match against a new job description without re-uploading the
 * file. Works from the previous AnalysisResult, which the client already holds.
 */
export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return reply({ ok: false, code: "too_large", error: "That request is too large." }, 413);
  }
  if (!hit(`match:${clientIp(req)}`, 60, 60 * 60 * 1000).ok) {
    return reply({ ok: false, code: "rate_limited", error: "Too many job descriptions in an hour. Try again shortly." }, 429);
  }

  let body: { result?: AnalysisResult; jd?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, code: "bad_request", error: "Malformed request." }, 400);
  }

  const result = body.result;
  if (!result || result.version !== 1 || !result.profile || typeof result.rawText !== "string" || !Array.isArray(result.checks)) {
    return reply({ ok: false, code: "bad_request", error: "Run a check on your resume first." }, 400);
  }
  const jd = typeof body.jd === "string" && body.jd.trim() ? body.jd.trim().slice(0, MAX_JD_CHARS) : null;

  try {
    return reply({ ok: true, result: await rematch(result, jd) });
  } catch {
    return reply({ ok: false, code: "bad_request", error: "We couldn't compare that job description. Please try again." }, 400);
  }
}
