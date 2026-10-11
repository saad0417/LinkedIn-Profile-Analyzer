/**
 * POST /api/export
 *   Body: { content: ResumeContent, template: TemplateId, format: "docx" | "pdf" }
 *   200: the file (attachment). Errors: JSON { ok: false, error, code }.
 *
 * GET /api/export?template=<any TemplateId>&format=docx|pdf
 *   The template filled with fictional sample content ("download template").
 *   Deterministic, so the bytes are cached.
 */
import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";
import type { TemplateId } from "@/lib/types";
import { hit, clientIp } from "@/lib/security/rate-limit";
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


const HOUR = 60 * 60 * 1000;
const EXPORTS_PER_HOUR = 30;

type ExportErrorCode = "bad_request" | "too_large" | "rate_limited" | "server_error";

function error(code: ExportErrorCode, status: number, message: string, extra?: Record<string, string>) {
  return Response.json(
    { ok: false, code, error: message },
    { status, headers: { "Cache-Control": "no-store", ...extra } },
  );
}

function fileResponse(bytes: Uint8Array, format: ExportFormat, filename: string, cacheControl: string) {
  return new Response(bytes.slice(), {
    status: 200,
    headers: {
      "Content-Type": MIME[format],
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    return error("bad_request", 400, "Send the request as JSON.");
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > EXPORT_LIMITS.bodyBytes) return error("too_large", 413, "That resume is too large to export.");

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return error("bad_request", 400, "That request couldn't be read.");
  }
  if (Buffer.byteLength(raw, "utf8") > EXPORT_LIMITS.bodyBytes) {
    return error("too_large", 413, "That resume is too large to export.");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return error("bad_request", 400, "Request body isn't valid JSON.");
  }
  const parsed = parseExportRequest(body);
  if (!parsed.ok) return error("bad_request", 400, parsed.error);

  const limit = hit(`export:${clientIp(request)}`, EXPORTS_PER_HOUR, HOUR);
  if (!limit.ok) {
    return error("rate_limited", 429, "You've exported a lot of files this hour. Please try again a little later.", {
      "Retry-After": String(limit.retryAfter),
    });
  }

  const { content, template, format } = parsed.value;
  try {
    const bytes = await renderResume(content, template, format);
    return fileResponse(bytes, format, resumeFileName(content.name, format), "no-store");
  } catch (err) {
    console.error(`[export] render failed: ${(err as Error)?.name ?? "Error"}`);
    return error("server_error", 500, "We couldn't build that file. Please try again.");
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

  const bytes = await sampleTemplate(template, format);
  const filename = `${getTemplate(template)!.name.replace(/\s+/g, "-")}-Resume-Template.${format}`;
  return fileResponse(bytes, format, filename, "public, max-age=86400, stale-while-revalidate=604800");
}
