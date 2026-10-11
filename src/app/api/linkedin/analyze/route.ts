import { analyzeLinkedIn, UnreadableDocumentError } from "@/lib/linkedin";
import type { LinkedInAnalyzeResponse } from "@/lib/linkedin/types";
import { clientIp, hit } from "@/lib/security/rate-limit";
import { MAX_UPLOAD_BYTES, sniffUpload } from "@/lib/security/upload";

// Node.js is the default runtime; an explicit `export const runtime` is rejected
// while nextConfig.cacheComponents is on. POST handlers are never cached.
export const maxDuration = 30;

const HOUR = 60 * 60 * 1000;
const LINKEDIN_UPLOADS_PER_HOUR = 10;
const PDF_ONLY = "Upload the PDF from LinkedIn: open your profile, More → Save to PDF.";

function reply(body: LinkedInAnalyzeResponse, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * LinkedIn "Save to PDF" export -> parse -> rubric -> JSON. The file only ever
 * exists as a buffer in this function's memory; it is never written to disk or
 * logged, and the buffer is zeroed before returning.
 */
export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return reply({ ok: false, code: "too_large", error: "Files must be 5 MB or smaller." }, 413);
  }

  const limit = hit(`linkedin:${clientIp(req)}`, LINKEDIN_UPLOADS_PER_HOUR, HOUR);
  if (!limit.ok) {
    const mins = Math.max(1, Math.ceil(limit.retryAfter / 60));
    return reply(
      {
        ok: false,
        code: "rate_limited",
        error: `You've checked ${LINKEDIN_UPLOADS_PER_HOUR} profiles in the last hour. You can check another in about ${mins} minute${mins === 1 ? "" : "s"}.`,
      },
      429,
      { "Retry-After": String(limit.retryAfter) },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return reply({ ok: false, code: "bad_request", error: "The upload didn't come through. Please try again." }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) return reply({ ok: false, code: "bad_request", error: PDF_ONLY }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return reply({ ok: false, code: "too_large", error: "Files must be 5 MB or smaller." }, 413);

  const buf = new Uint8Array(await file.arrayBuffer());
  try {
    const sniff = sniffUpload(buf);
    if (!sniff.ok) return reply({ ok: false, code: sniff.code, error: sniff.code === "too_large" ? sniff.error : PDF_ONLY }, 415);
    if (sniff.kind !== "pdf") return reply({ ok: false, code: "bad_type", error: PDF_ONLY }, 415);

    const result = await analyzeLinkedIn(buf);
    return reply({ ok: true, result });
  } catch (err) {
    if (err instanceof UnreadableDocumentError) return reply({ ok: false, code: "unreadable", error: err.message }, 422);
    console.error("linkedin analyze failed:", err instanceof Error ? err.name : "unknown");
    return reply({ ok: false, code: "unreadable", error: `We couldn't read this PDF. ${PDF_ONLY}` }, 422);
  } finally {
    buf.fill(0);
  }
}
