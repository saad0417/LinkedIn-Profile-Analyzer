/**
 * POST /api/export
 *   Body: { content: ResumeContent, template: TemplateId, format: "docx" | "pdf" }
 *   200: the file (attachment). Errors: JSON { ok: false, error, code }.
 *
 * GET /api/export?template=<any TemplateId>&format=docx|pdf
 *   The template filled with fictional sample content ("download template").
 *   Deterministic, so the bytes are cached.
 *
 * Limits: see LIMITS.export / LIMITS.exportSample in rate-limit.ts.
 */
import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";
import type { TemplateId } from "@/lib/types";
import { clientIp, limitMessage, rateLimit } from "@/lib/security/rate-limit";
import { declaresTooLarge, isCrossSite, isJsonContentType, parseJson, readBodyCapped } from "@/lib/security/request";
import {
  EXPORT_LIMITS,
  MIME,
  getTemplate,
  isFormat,
  isTemplateId,
  parseExportRequest,
  renderResume,
  resumeFileName,
  sampleFor,
  type ExportFormat,
} from "@/lib/export";

// Rendering takes well under a second; this is a ceiling, not an expectation.
export const maxDuration = 30;

type ExportErrorCode = "bad_request" | "too_large" | "rate_limited" | "server_error";

function error(code: ExportErrorCode, status: number, message: string, extra?: Record<string, string>) {
  return Response.json(
    { ok: false, code, error: message },
    { status, headers: { "Cache-Control": "no-store", ...extra } },
  );
}

function fileResponse(bytes: Uint8Array, format: ExportFormat, filename: string, cacheControl: string, extra?: Record<string, string>) {
  return new Response(bytes.slice(), {
    status: 200,
    headers: {
      "Content-Type": MIME[format],
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

/** Order: cross-site / content-type / declared size (free) -> rate limit -> read body (capped) -> validate -> render. */
export async function POST(request: Request): Promise<Response> {
  if (isCrossSite(request)) return error("bad_request", 403, "Cross-site requests aren't allowed.");
  if (!isJsonContentType(request)) return error("bad_request", 400, "Send the request as JSON.");
  if (declaresTooLarge(request, EXPORT_LIMITS.bodyBytes)) return error("too_large", 413, "That resume is too large to export.");

  const limit = await rateLimit("export", clientIp(request));
  if (!limit.ok) return error("rate_limited", 429, limitMessage("export", limit), limit.headers);
  const rl = limit.headers;

  const raw = await readBodyCapped(request, EXPORT_LIMITS.bodyBytes);
  if (!raw.ok) {
    return raw.reason === "too_large"
      ? error("too_large", 413, "That resume is too large to export.", rl)
      : error("bad_request", 400, "That request couldn't be read.", rl);
  }
  const body = parseJson(raw.bytes);
  if (body === undefined) return error("bad_request", 400, "Request body isn't valid JSON.", rl);
  const parsed = parseExportRequest(body);
  if (!parsed.ok) return error("bad_request", 400, parsed.error, rl);

  const { content, template, format } = parsed.value;
  try {
    const bytes = await renderResume(content, template, format);
    return fileResponse(bytes, format, resumeFileName(content.name, format), "no-store", rl);
  } catch (err) {
    console.error(`[export] render failed: ${(err as Error)?.name ?? "Error"}`);
    return error("server_error", 500, "We couldn't build that file. Please try again.", rl);
  }
}

/** Sample-filled template bytes. Inputs are a closed set, so caching is safe. */
async function sampleTemplate(template: TemplateId, format: ExportFormat): Promise<Uint8Array> {
  "use cache";
  cacheLife("days");
  return renderResume(sampleFor(template), template, format);
}

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const template = params.get("template") ?? "standard";
  const format = params.get("format") ?? "docx";
  if (!isTemplateId(template)) return error("bad_request", 400, "Unknown template.");
  if (!isFormat(format)) return error("bad_request", 400, `"format" must be "docx" or "pdf".`);

  const limit = await rateLimit("exportSample", clientIp(request));
  if (!limit.ok) return error("rate_limited", 429, limitMessage("exportSample", limit), limit.headers);

  const bytes = await sampleTemplate(template, format);
  const filename = `${getTemplate(template)!.name.replace(/\s+/g, "-")}-Resume-Template.${format}`;
  // No RateLimit-* headers here: the response is publicly cacheable, and
  // per-client counters must never be stored in a shared cache.
  return fileResponse(bytes, format, filename, "public, max-age=86400, stale-while-revalidate=604800");
}
