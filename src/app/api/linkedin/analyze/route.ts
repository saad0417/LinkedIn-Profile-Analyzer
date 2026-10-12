import { analyzeLinkedIn, UnreadableDocumentError } from "@/lib/linkedin";
import type { LinkedInAnalyzeResponse } from "@/lib/linkedin/types";
import { clientIp, limitMessage, rateLimit } from "@/lib/security/rate-limit";
import { declaresTooLarge, isCrossSite, isMultipart, parseMultipart, readBodyCapped } from "@/lib/security/request";
import { MAX_UPLOAD_BYTES, sniffUpload } from "@/lib/security/upload";

// Node.js is the default runtime; an explicit `export const runtime` is rejected
// while nextConfig.cacheComponents is on. POST handlers are never cached.
export const maxDuration = 30;

const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;
const PDF_ONLY = "Upload the PDF from LinkedIn: open your profile, More → Save to PDF.";
const TOO_LARGE = "Files must be 4 MB or smaller.";
const NOT_RECEIVED = "The upload didn't come through. Please try again.";

function reply(body: LinkedInAnalyzeResponse, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * LinkedIn "Save to PDF" export -> parse -> rubric -> JSON. The file only ever
 * exists as a buffer in this function's memory; it is never written to disk or
 * logged, and the buffer is zeroed before returning.
 *
 * Order: cross-site / size / type checks (free) -> rate limit -> read the body
 * (capped) -> parse -> analyze.
 */
export async function POST(req: Request) {
  if (isCrossSite(req)) return reply({ ok: false, code: "bad_request", error: "Cross-site requests aren't allowed." }, 403);
  if (declaresTooLarge(req, MAX_BODY_BYTES)) return reply({ ok: false, code: "too_large", error: TOO_LARGE }, 413);
  if (!isMultipart(req)) return reply({ ok: false, code: "bad_request", error: PDF_ONLY }, 400);

  const limit = await rateLimit("linkedin", clientIp(req));
  if (!limit.ok) {
    return reply({ ok: false, code: "rate_limited", error: limitMessage("linkedin", limit) }, 429, limit.headers);
  }
  const rl = limit.headers;

  const body = await readBodyCapped(req, MAX_BODY_BYTES);
  if (!body.ok) {
    return body.reason === "too_large"
      ? reply({ ok: false, code: "too_large", error: TOO_LARGE }, 413, rl)
      : reply({ ok: false, code: "bad_request", error: NOT_RECEIVED }, 400, rl);
  }

  let form: FormData;
  try {
    form = await parseMultipart(req, body.bytes);
  } catch {
    return reply({ ok: false, code: "bad_request", error: NOT_RECEIVED }, 400, rl);
  } finally {
    body.bytes.fill(0);
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) return reply({ ok: false, code: "bad_request", error: PDF_ONLY }, 400, rl);
  if (file.size > MAX_UPLOAD_BYTES) return reply({ ok: false, code: "too_large", error: TOO_LARGE }, 413, rl);

  const buf = new Uint8Array(await file.arrayBuffer());
  try {
    const sniff = sniffUpload(buf);
    if (!sniff.ok) return reply({ ok: false, code: sniff.code, error: sniff.code === "too_large" ? sniff.error : PDF_ONLY }, 415, rl);
    if (sniff.kind !== "pdf") return reply({ ok: false, code: "bad_type", error: PDF_ONLY }, 415, rl);

    const result = await analyzeLinkedIn(buf);
    return reply({ ok: true, result }, 200, rl);
  } catch (err) {
    if (err instanceof UnreadableDocumentError) return reply({ ok: false, code: "unreadable", error: err.message }, 422, rl);
    console.error("linkedin analyze failed:", err instanceof Error ? err.name : "unknown");
    return reply({ ok: false, code: "unreadable", error: `We couldn't read this PDF. ${PDF_ONLY}` }, 422, rl);
  } finally {
    buf.fill(0);
  }
}
