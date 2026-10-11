import { analyzeDocument, UnreadableDocumentError } from "@/lib/analyze";
import { sanitizeDocHtml } from "@/lib/sanitize";
import { clientIp, limitUpload } from "@/lib/security/rate-limit";
import { MAX_UPLOAD_BYTES, sniffUpload } from "@/lib/security/upload";
import type { AnalyzeResponse } from "@/lib/types";

export const maxDuration = 30;

const MAX_JD_CHARS = 20_000;

function reply(body: AnalyzeResponse, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * Upload -> parse -> checks -> JSON. The file only ever exists as a buffer in
 * this function's memory; it is never written to disk or logged, and nothing
 * from it except the extracted text and findings goes back to the client.
 */
export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return reply({ ok: false, code: "too_large", error: "Files must be 5 MB or smaller." }, 413);
  }

  const limit = limitUpload(clientIp(req));
  if (!limit.ok) {
    const mins = Math.max(1, Math.ceil(limit.retryAfter / 60));
    return reply(
      {
        ok: false,
        code: "rate_limited",
        error: `You've checked 5 files in the last hour. You can check another in about ${mins} minute${mins === 1 ? "" : "s"}.`,
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
  if (!(file instanceof Blob)) {
    return reply({ ok: false, code: "bad_request", error: "Choose a PDF or Word file to check." }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return reply({ ok: false, code: "too_large", error: "Files must be 5 MB or smaller." }, 413);
  }

  const jdRaw = form.get("jd");
  const jd = typeof jdRaw === "string" && jdRaw.trim() ? jdRaw.trim().slice(0, MAX_JD_CHARS) : null;

  const buf = new Uint8Array(await file.arrayBuffer());
  const sniff = sniffUpload(buf);
  if (!sniff.ok) return reply({ ok: false, code: sniff.code, error: sniff.error }, 415);

  try {
    const result = await analyzeDocument(buf, sniff.kind, jd);
    if (result.sourceHtml) result.sourceHtml = sanitizeDocHtml(result.sourceHtml);
    return reply({ ok: true, result });
  } catch (err) {
    if (err instanceof UnreadableDocumentError) {
      return reply({ ok: false, code: "unreadable", error: err.message }, 422);
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
    );
  } finally {
    buf.fill(0);
  }
}
