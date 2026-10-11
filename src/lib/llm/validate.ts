import type { LinkedInEducation, LinkedInProfile, LinkedInRole } from "@/lib/linkedin/types";
import type { LLMTask } from "@/lib/types";
import { parseResumeContent } from "@/lib/export/validate";

export const LLM_LIMITS = {
  /** Whole request. The per-task caps below are the real bounds. */
  bodyBytes: 128_000,
  bullet: 500,
  role: 120,
  summary: 2000,
  targetRole: 120,
  context: 4000,
  checkId: 100,
  title: 200,
  checkSummary: 1000,
  evidenceItems: 5,
  evidenceItem: 500,
  // rewrite-bullets
  batchBullets: 15,
  // linkedin-review
  profileBytes: 30_000,
  findings: 30,
  finding: 300,
  // generate-resume
  draftBytes: 40_000,
  draftRoles: 10,
  draftNotes: 25,
  draftNote: 1000,
  jobDescription: 20_000,
} as const;

/** Per-field caps for an untrusted LinkedInProfile. */
const PROFILE_CAPS = {
  name: 120,
  headline: 300,
  location: 160,
  email: 254,
  profileUrl: 300,
  summary: 3000,
  websites: [10, 300],
  topSkills: [50, 100],
  languages: [20, 100],
  certifications: [30, 200],
  honors: [30, 300],
  publications: [30, 300],
  experience: 30,
  role: { title: 200, company: 200, dates: 120, start: 20, end: 20, location: 160, description: 2500 },
  education: 15,
  school: { school: 200, degree: 300, dates: 120 },
} as const;

export type ParseResult = { ok: true; task: LLMTask } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Strip control characters (keep tab/newline) and trim. */
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();

function str(
  o: Record<string, unknown>,
  key: string,
  max: number,
  { required = true }: { required?: boolean } = {},
): { value: string | undefined; error?: string } {
  const v = o[key];
  if (v === undefined || v === null || v === "") {
    return required ? { value: undefined, error: `Missing "${key}".` } : { value: undefined };
  }
  if (typeof v !== "string") return { value: undefined, error: `"${key}" must be a string.` };
  const s = clean(v);
  if (!s) return required ? { value: undefined, error: `"${key}" is empty.` } : { value: undefined };
  if (s.length > max) return { value: undefined, error: `"${key}" is too long (max ${max} characters).` };
  return { value: s };
}

class Invalid extends Error {}

function nullableStr(v: unknown, field: string, max: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new Invalid(`"${field}" must be a string or null.`);
  const s = clean(v);
  if (s.length > max) throw new Invalid(`"${field}" is too long (max ${max} characters).`);
  return s || null;
}

function strList(v: unknown, field: string, maxItems: number, maxLen: number): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new Invalid(`"${field}" must be an array of strings.`);
  if (v.length > maxItems) throw new Invalid(`"${field}" has too many items (max ${maxItems}).`);
  return v.map((x, i) => {
    if (typeof x !== "string") throw new Invalid(`"${field}[${i}]" must be a string.`);
    const s = clean(x);
    if (s.length > maxLen) throw new Invalid(`"${field}[${i}]" is too long (max ${maxLen} characters).`);
    return s;
  }).filter(Boolean);
}

function objList(v: unknown, field: string, maxItems: number): Record<string, unknown>[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new Invalid(`"${field}" must be an array.`);
  if (v.length > maxItems) throw new Invalid(`"${field}" has too many items (max ${maxItems}).`);
  return v.map((x, i) => {
    if (!isObj(x)) throw new Invalid(`"${field}[${i}]" must be an object.`);
    return x;
  });
}

/** Rebuild a LinkedInProfile from untrusted JSON: known keys only, every field capped. */
export function parseLinkedInProfile(v: unknown): LinkedInProfile {
  if (!isObj(v)) throw new Invalid(`"profile" must be an object.`);
  if (Buffer.byteLength(JSON.stringify(v), "utf8") > LLM_LIMITS.profileBytes) {
    throw new Invalid(`"profile" is too large (max ${LLM_LIMITS.profileBytes / 1000} KB).`);
  }
  const C = PROFILE_CAPS;
  const experience: LinkedInRole[] = objList(v.experience, "profile.experience", C.experience).map((r, i) => ({
    title: nullableStr(r.title, `profile.experience[${i}].title`, C.role.title),
    company: nullableStr(r.company, `profile.experience[${i}].company`, C.role.company),
    dates: nullableStr(r.dates, `profile.experience[${i}].dates`, C.role.dates),
    start: nullableStr(r.start, `profile.experience[${i}].start`, C.role.start),
    end: nullableStr(r.end, `profile.experience[${i}].end`, C.role.end),
    location: nullableStr(r.location, `profile.experience[${i}].location`, C.role.location),
    description: nullableStr(r.description, `profile.experience[${i}].description`, C.role.description),
  }));
  const education: LinkedInEducation[] = objList(v.education, "profile.education", C.education).map((e, i) => ({
    school: nullableStr(e.school, `profile.education[${i}].school`, C.school.school),
    degree: nullableStr(e.degree, `profile.education[${i}].degree`, C.school.degree),
    dates: nullableStr(e.dates, `profile.education[${i}].dates`, C.school.dates),
  }));
  return {
    name: nullableStr(v.name, "profile.name", C.name),
    headline: nullableStr(v.headline, "profile.headline", C.headline),
    location: nullableStr(v.location, "profile.location", C.location),
    email: nullableStr(v.email, "profile.email", C.email),
    profileUrl: nullableStr(v.profileUrl, "profile.profileUrl", C.profileUrl),
    websites: strList(v.websites, "profile.websites", ...C.websites),
    topSkills: strList(v.topSkills, "profile.topSkills", ...C.topSkills),
    languages: strList(v.languages, "profile.languages", ...C.languages),
    certifications: strList(v.certifications, "profile.certifications", ...C.certifications),
    honors: strList(v.honors, "profile.honors", ...C.honors),
    publications: strList(v.publications, "profile.publications", ...C.publications),
    summary: nullableStr(v.summary, "profile.summary", C.summary),
    experience,
    education,
  };
}

/** Structured tasks: throws Invalid with a user-facing message. */
function parseStructured(body: Record<string, unknown>): LLMTask {
  const L = LLM_LIMITS;
  switch (body.task) {
    case "rewrite-bullets": {
      if (!Array.isArray(body.bullets)) throw new Invalid(`"bullets" must be an array of strings.`);
      if (body.bullets.length === 0) throw new Invalid(`"bullets" is empty.`);
      if (body.bullets.length > L.batchBullets) throw new Invalid(`"bullets" has too many items (max ${L.batchBullets}).`);
      const bullets = body.bullets.map((b, i) => {
        if (typeof b !== "string") throw new Invalid(`"bullets[${i}]" must be a string.`);
        const s = clean(b);
        if (!s) throw new Invalid(`"bullets[${i}]" is empty.`);
        if (s.length > L.bullet) throw new Invalid(`"bullets[${i}]" is too long (max ${L.bullet} characters).`);
        return s;
      });
      const role = str(body, "role", L.role, { required: false });
      if (role.error) throw new Invalid(role.error);
      return { task: "rewrite-bullets", bullets, role: role.value ?? null };
    }
    case "linkedin-review": {
      const profile = parseLinkedInProfile(body.profile);
      const score = body.score;
      if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
        throw new Invalid(`"score" must be a number from 0 to 100.`);
      }
      const findings = strList(body.findings, "findings", L.findings, L.finding);
      return { task: "linkedin-review", profile, score, findings };
    }
    case "generate-resume": {
      const targetRole = str(body, "targetRole", L.targetRole);
      if (targetRole.error) throw new Invalid(targetRole.error);
      if (!isObj(body.draft)) throw new Invalid(`"draft" must be an object.`);
      if (Buffer.byteLength(JSON.stringify(body.draft), "utf8") > L.draftBytes) {
        throw new Invalid(`"draft" is too large (max ${L.draftBytes / 1000} KB).`);
      }
      const draft = parseResumeContent(body.draft, {
        experience: L.draftRoles,
        bullets: L.draftNotes,
        bullet: L.draftNote,
      });
      if (!draft.ok) throw new Invalid(draft.error.replace(/^"/, `"draft.`));
      const c = draft.value;
      const tidy = (s: string) => clean(s);
      const tidyOpt = (s: string | null) => (s ? clean(s) || null : null);
      const tidyList = (l: string[]) => l.map(tidy).filter(Boolean);
      let jobDescription: string | null = null;
      if (body.jobDescription !== undefined && body.jobDescription !== null && body.jobDescription !== "") {
        if (typeof body.jobDescription !== "string") throw new Invalid(`"jobDescription" must be a string.`);
        jobDescription = clean(body.jobDescription) || null;
        if (jobDescription && jobDescription.length > L.jobDescription) {
          throw new Invalid(`"jobDescription" is too long (max ${L.jobDescription} characters).`);
        }
      }
      return {
        task: "generate-resume",
        targetRole: targetRole.value!,
        jobDescription,
        draft: {
          name: tidy(c.name),
          headline: tidyOpt(c.headline),
          email: tidyOpt(c.email),
          phone: tidyOpt(c.phone),
          location: tidyOpt(c.location),
          linkedin: tidyOpt(c.linkedin),
          links: tidyList(c.links),
          summary: tidyOpt(c.summary),
          experience: c.experience.map((e) => ({
            title: tidy(e.title),
            company: tidy(e.company),
            location: tidyOpt(e.location),
            start: tidy(e.start),
            end: tidy(e.end),
            bullets: tidyList(e.bullets),
          })),
          education: c.education.map((e) => ({
            institution: tidy(e.institution),
            degree: tidy(e.degree),
            dates: tidy(e.dates),
            details: tidyList(e.details),
          })),
          skills: tidyList(c.skills),
          certifications: tidyList(c.certifications),
        },
      };
    }
    default:
      throw new Invalid("Unknown task.");
  }
}

/** Strictly validate an untrusted JSON body into an LLMTask. */
export function parseLLMTask(body: unknown): ParseResult {
  if (!isObj(body)) return { ok: false, error: "Body must be a JSON object." };
  const L = LLM_LIMITS;

  switch (body.task) {
    case "rewrite-bullet": {
      const bullet = str(body, "bullet", L.bullet);
      const role = str(body, "role", L.role, { required: false });
      const err = bullet.error ?? role.error;
      if (err) return { ok: false, error: err };
      return { ok: true, task: { task: "rewrite-bullet", bullet: bullet.value!, role: role.value ?? null } };
    }
    case "rewrite-summary": {
      const summary = str(body, "summary", L.summary);
      const targetRole = str(body, "targetRole", L.targetRole);
      const context = str(body, "context", L.context, { required: false });
      const err = summary.error ?? targetRole.error ?? context.error;
      if (err) return { ok: false, error: err };
      return {
        ok: true,
        task: {
          task: "rewrite-summary",
          summary: summary.value!,
          targetRole: targetRole.value!,
          ...(context.value ? { context: context.value } : {}),
        },
      };
    }
    case "explain": {
      const checkId = str(body, "checkId", L.checkId);
      if (checkId.value && !/^[a-z0-9][a-z0-9._-]*$/i.test(checkId.value)) {
        return { ok: false, error: `"checkId" has an invalid format.` };
      }
      const title = str(body, "title", L.title);
      const summary = str(body, "summary", L.checkSummary);
      const err = checkId.error ?? title.error ?? summary.error;
      if (err) return { ok: false, error: err };

      let evidence: string[] | undefined;
      if (body.evidence !== undefined && body.evidence !== null) {
        if (!Array.isArray(body.evidence)) return { ok: false, error: `"evidence" must be an array of strings.` };
        if (body.evidence.length > L.evidenceItems) {
          return { ok: false, error: `"evidence" has too many items (max ${L.evidenceItems}).` };
        }
        evidence = [];
        for (const e of body.evidence) {
          if (typeof e !== "string") return { ok: false, error: `"evidence" must be an array of strings.` };
          const s = clean(e);
          if (s.length > L.evidenceItem) {
            return { ok: false, error: `An "evidence" item is too long (max ${L.evidenceItem} characters).` };
          }
          if (s) evidence.push(s);
        }
      }
      return {
        ok: true,
        task: {
          task: "explain",
          checkId: checkId.value!,
          title: title.value!,
          summary: summary.value!,
          ...(evidence && evidence.length ? { evidence } : {}),
        },
      };
    }
    default:
      try {
        return { ok: true, task: parseStructured(body) };
      } catch (err) {
        if (err instanceof Invalid) return { ok: false, error: err.message };
        throw err;
      }
  }
}
