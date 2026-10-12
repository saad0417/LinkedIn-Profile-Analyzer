import { analyzeDocument, UnreadableDocumentError } from "@/lib/analyze";
import { sanitizeDocHtml } from "@/lib/sanitize";
import { clientIp, limitMessage, rateLimit } from "@/lib/security/rate-limit";
import { declaresTooLarge, isCrossSite, isMultipart, parseMultipart, readBodyCapped } from "@/lib/security/request";
import { MAX_UPLOAD_BYTES, sniffUpload } from "@/lib/security/upload";
import type { AnalyzeResponse } from "@/lib/types";

// Node.js is the default runtime; an explicit `export const runtime` is rejected
// while nextConfig.cacheComponents is on. Parsing also has its own time budget.
export const maxDuration = 30;

const MAX_JD_CHARS = 20_000;
/** File + job description (≤ 20k chars, up to 4 bytes each in UTF-8) + multipart framing. */
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 128 * 1024;
const TOO_LARGE = "Files must be 4 MB or smaller.";

function reply(body: AnalyzeResponse, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * Upload -> parse -> checks -> JSON. The file only ever exists as a buffer in
 * this function's memory; it is never written to disk or logged, and nothing
 * from it except the extracted text and findings goes back to the client.
 *
 * Order: cross-site / size / type checks (free) -> rate limit -> read the body
 * (capped) -> parse -> analyze.
 */
export async function POST(req: Request) {
  if (isCrossSite(req)) return reply({ ok: false, code: "bad_request", error: "Cross-site requests aren't allowed." }, 403);
  if (declaresTooLarge(req, MAX_BODY_BYTES)) return reply({ ok: false, code: "too_large", error: TOO_LARGE }, 413);
  if (!isMultipart(req)) return reply({ ok: false, code: "bad_request", error: "Choose a PDF or Word file to check." }, 400);

  const limit = await rateLimit("analyze", clientIp(req));
  if (!limit.ok) {
    return reply({ ok: false, code: "rate_limited", error: limitMessage("analyze", limit) }, 429, limit.headers);
  }
  const rl = limit.headers;

  const body = await readBodyCapped(req, MAX_BODY_BYTES);
  if (!body.ok) {
    return body.reason === "too_large"
      ? reply({ ok: false, code: "too_large", error: TOO_LARGE }, 413, rl)
      : reply({ ok: false, code: "bad_request", error: "The upload didn't come through. Please try again." }, 400, rl);
  }

  let form: FormData;
  try {
    form = await parseMultipart(req, body.bytes);
  } catch {
    return reply({ ok: false, code: "bad_request", error: "The upload didn't come through. Please try again." }, 400, rl);
  } finally {
    body.bytes.fill(0);
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return reply({ ok: false, code: "bad_request", error: "Choose a PDF or Word file to check." }, 400, rl);
  }
  if (file.size > MAX_UPLOAD_BYTES) return reply({ ok: false, code: "too_large", error: TOO_LARGE }, 413, rl);

  const jdRaw = form.get("jd");
  const jd = typeof jdRaw === "string" && jdRaw.trim() ? jdRaw.trim().slice(0, MAX_JD_CHARS) : null;

  const buf = new Uint8Array(await file.arrayBuffer());
  try {
    const sniff = sniffUpload(buf);
    if (!sniff.ok) return reply({ ok: false, code: sniff.code, error: sniff.error }, 415, rl);

    const result = await analyzeDocument(buf, sniff.kind, jd);
    if (result.sourceHtml) result.sourceHtml = sanitizeDocHtml(result.sourceHtml);
    return reply({ ok: true, result }, 200, rl);
  } catch (err) {
    if (err instanceof UnreadableDocumentError) {
      return reply({ ok: false, code: "unreadable", error: err.message }, 422, rl);
    }
    console.error("analyze failed:", err instanceof Error ? err.name : "unknown");
    return reply(
      {
        ok: false,
        code: "unreadable",
        error:
          "We couldn't read this file. If it's password protected, remove the password and try again. Otherwise, re-export it from Word or Google Docs.",
      },
      422,
      rl,
    );
  } finally {
    buf.fill(0);
  }
}
