/** Strict shape/size validation for untrusted ResumeContent from POST /api/export. */
import type { ResumeContent, TemplateId } from "@/lib/types";
import { isTemplateId } from "./templates";

export const EXPORT_LIMITS = {
  bodyBytes: 200_000,
  name: 120,
  headline: 160,
  email: 254,
  phone: 60,
  location: 120,
  url: 300,
  links: 6,
  summary: 3000,
  experience: 25,
  title: 160,
  company: 160,
  date: 40,
  bullets: 20,
  bullet: 700,
  education: 10,
  institution: 200,
  degree: 200,
  dates: 60,
  details: 10,
  detail: 400,
  skills: 100,
  skill: 120,
  certifications: 25,
  certification: 200,
} as const;

export type ExportFormat = "docx" | "pdf";
export const isFormat = (v: unknown): v is ExportFormat => v === "docx" || v === "pdf";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

class Invalid extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function reqStr(v: unknown, field: string, max: number): string {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new Invalid(`"${field}" must be a string.`);
  if (v.length > max) throw new Invalid(`"${field}" is too long (max ${max} characters).`);
  return v;
}

function optStr(v: unknown, field: string, max: number): string | null {
  const s = reqStr(v, field, max);
  return s.trim() ? s : null;
}

function strArr(v: unknown, field: string, maxItems: number, maxLen: number): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new Invalid(`"${field}" must be an array.`);
  if (v.length > maxItems) throw new Invalid(`"${field}" has too many items (max ${maxItems}).`);
  return v.map((x, i) => reqStr(x, `${field}[${i}]`, maxLen));
}

function objArr(v: unknown, field: string, maxItems: number): Record<string, unknown>[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new Invalid(`"${field}" must be an array.`);
  if (v.length > maxItems) throw new Invalid(`"${field}" has too many items (max ${maxItems}).`);
  return v.map((x, i) => {
    if (!isObj(x)) throw new Invalid(`"${field}[${i}]" must be an object.`);
    return x;
  });
}

export type ContentLimits = { [K in keyof typeof EXPORT_LIMITS]: number };

export function parseResumeContent(v: unknown, limits: Partial<ContentLimits> = {}): Result<ResumeContent> {
  const L: ContentLimits = { ...EXPORT_LIMITS, ...limits };
  try {
    if (!isObj(v)) throw new Invalid(`"content" must be an object.`);
    const content: ResumeContent = {
      name: reqStr(v.name, "name", L.name),
      headline: optStr(v.headline, "headline", L.headline),
      email: optStr(v.email, "email", L.email),
      phone: optStr(v.phone, "phone", L.phone),
      location: optStr(v.location, "location", L.location),
      linkedin: optStr(v.linkedin, "linkedin", L.url),
      links: strArr(v.links, "links", L.links, L.url),
      summary: optStr(v.summary, "summary", L.summary),
      experience: objArr(v.experience, "experience", L.experience).map((e, i) => ({
        title: reqStr(e.title, `experience[${i}].title`, L.title),
        company: reqStr(e.company, `experience[${i}].company`, L.company),
        location: optStr(e.location, `experience[${i}].location`, L.location),
        start: reqStr(e.start, `experience[${i}].start`, L.date),
        end: reqStr(e.end, `experience[${i}].end`, L.date),
        bullets: strArr(e.bullets, `experience[${i}].bullets`, L.bullets, L.bullet),
      })),
      education: objArr(v.education, "education", L.education).map((e, i) => ({
        institution: reqStr(e.institution, `education[${i}].institution`, L.institution),
        degree: reqStr(e.degree, `education[${i}].degree`, L.degree),
        dates: reqStr(e.dates, `education[${i}].dates`, L.dates),
        details: strArr(e.details, `education[${i}].details`, L.details, L.detail),
      })),
      skills: strArr(v.skills, "skills", L.skills, L.skill),
      certifications: strArr(v.certifications, "certifications", L.certifications, L.certification),
    };
    return { ok: true, value: content };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, error: err.message };
    throw err;
  }
}

export function parseExportRequest(
  body: unknown,
): Result<{ content: ResumeContent; template: TemplateId; format: ExportFormat }> {
  if (!isObj(body)) return { ok: false, error: "Body must be a JSON object." };
  if (!isTemplateId(body.template)) return { ok: false, error: "Unknown template." };
  if (!isFormat(body.format)) return { ok: false, error: `"format" must be "docx" or "pdf".` };
  const content = parseResumeContent(body.content);
  if (!content.ok) return content;
  return { ok: true, value: { content: content.value, template: body.template, format: body.format } };
}
