/**
 * Structured (JSON) LLM tasks:
 *   rewrite-bullets  - up to 15 bullets in one call, same length and order back
 *   linkedin-review  - LinkedInReview built only from the profile's own facts
 *   generate-resume  - polished ResumeContent from a form draft
 *
 * The model's JSON is never trusted: every field is type-checked, cleaned,
 * capped, number-guarded and (where it matters) name-guarded. Facts such as
 * names, employers, titles, dates and schools are copied from the user's
 * input server-side, never from the model.
 */
import type { LinkedInProfile, LinkedInReview } from "@/lib/linkedin/types";
import type { LLMTask, ResumeContent } from "@/lib/types";
import { LLMProviderError } from "./core";
import { extractJson, isPlainObject } from "./json";
import { dropInventedSentences, nameGuard } from "./names";
import {
  JSON_RULES,
  cap,
  collapse,
  fence,
  guardNumbers,
  postProcess,
  stripLineLead,
  stripQuotes,
  stripWrappers,
  type Prompt,
} from "./prompts";

export type BulletsTask = Extract<LLMTask, { task: "rewrite-bullets" }>;
export type ReviewTask = Extract<LLMTask, { task: "linkedin-review" }>;
export type GenerateTask = Extract<LLMTask, { task: "generate-resume" }>;

/** Thrown when the model's output can't be turned into a valid result. The route answers 503. */
const unusable = (what: string) => new LLMProviderError(null, `Unusable ${what} output`);

const BULLET_GUIDE = `- Open with a strong past-tense action verb (for example Led, Built, Reduced, Delivered, Designed, Negotiated).
- Keep every fact, name, tool, number and outcome the user wrote. Do not drop specifics.
- One line: ideally 12 to 25 words, never more than 30 words.
- Cut filler such as "responsible for", "worked on", "helped with", "various", "duties included".
- If a bullet describes a result but gives no number for it, insert the literal placeholder [metric] where the number belongs. Use at most two placeholders per bullet. If the user already gave numbers, keep them and do not add placeholders.
- Never guess a number. Never claim a result the user did not describe.
- No leading bullet characters, no quotation marks around a bullet.`;

const REFUSAL = /^(?:i(?:'m| am) sorry|sorry,|i can(?:not|'t)|as an ai|i'm unable|i am unable)/i;

/** One rewritten bullet, cleaned and number-guarded against `source`. null = junk. */
function cleanBullet(source: string, out: unknown): string | null {
  let value = out;
  if (isPlainObject(value)) value = value.text ?? value.bullet ?? value.rewrite ?? value.rewritten;
  if (typeof value !== "string") return null;
  const text = postProcess({ task: "rewrite-bullet", bullet: source, role: null }, value);
  if (!text || text.length < 8 || REFUSAL.test(text) || /USER_TEXT|<<<|>>>/.test(text)) return null;
  return text;
}

/* ---------------------------- rewrite-bullets ---------------------------- */

export function buildBulletsPrompt(task: BulletsTask): Prompt {
  const n = task.bullets.length;
  return {
    system: `You rewrite resume bullet points so they are clearer and stronger for recruiters and applicant tracking systems.

${JSON_RULES}

You receive a JSON array of ${n} bullet${n === 1 ? "" : "s"}. Rewrite each one independently.
${BULLET_GUIDE}
- Use only the facts in that same bullet. Never move facts between bullets.
- If a bullet is already strong, return it unchanged.

Output: a JSON array of exactly ${n} string${n === 1 ? "" : "s"}, in the same order as the input, one rewrite per input bullet. Never merge, split, drop, add or reorder bullets.`,
    user: `${task.role ? `The bullets are from this role (context only):\n${fence(task.role)}\n\n` : ""}Bullets to rewrite (a JSON array):\n${fence(JSON.stringify(task.bullets))}`,
  };
}

/** Per-line fallback for models that ignore the JSON instruction. */
function linesOf(raw: string): string[] {
  return stripWrappers(raw)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^[[\]{}]+,?$/.test(l))
    .map((l) => {
      const noComma = l.replace(/,\s*$/, "");
      if (/^".*"$/.test(noComma)) {
        try {
          const v = JSON.parse(noComma);
          if (typeof v === "string") return v;
        } catch {
          /* fall through */
        }
      }
      return stripQuotes(stripLineLead(noComma));
    })
    .filter(Boolean);
}

export function parseBullets(task: BulletsTask, raw: string): string[] {
  const n = task.bullets.length;
  let list: unknown[] | undefined;
  const parsed = extractJson(raw, "array") ?? extractJson(raw, "object");
  if (Array.isArray(parsed)) list = parsed;
  else if (isPlainObject(parsed)) {
    const inner = parsed.bullets ?? parsed.items ?? parsed.rewrites;
    if (Array.isArray(inner)) list = inner;
  }
  if (!list) {
    const lines = linesOf(raw);
    if (lines.length === n) list = lines;
  }
  if (!list || list.length !== n) throw unusable("rewrite-bullets");

  let usable = 0;
  const items = task.bullets.map((source, i) => {
    const text = cleanBullet(source, list![i]);
    if (text === null) return source;
    usable++;
    return text;
  });
  if (!usable) throw unusable("rewrite-bullets");
  return items;
}

/* ---------------------------- linkedin-review ---------------------------- */

/** Every string in the profile, for number / name allow-lists. */
export function profileText(p: LinkedInProfile): string {
  const parts: (string | null)[] = [
    p.name, p.headline, p.location, p.email, p.profileUrl, p.summary,
    ...p.websites, ...p.topSkills, ...p.languages, ...p.certifications, ...p.honors, ...p.publications,
  ];
  for (const r of p.experience) parts.push(r.title, r.company, r.dates, r.location, r.description);
  for (const e of p.education) parts.push(e.school, e.degree, e.dates);
  return parts.filter((x): x is string => !!x).join("\n");
}

/** The profile without empty fields or contact details the review doesn't need. */
function compactProfile(p: LinkedInProfile): Record<string, unknown> {
  const drop = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length)));
  return drop({
    name: p.name,
    headline: p.headline,
    location: p.location,
    about: p.summary,
    topSkills: p.topSkills,
    languages: p.languages,
    certifications: p.certifications,
    honors: p.honors,
    publications: p.publications,
    websites: p.websites,
    experience: p.experience.map((r) =>
      drop({ title: r.title, company: r.company, dates: r.dates, location: r.location, description: r.description }),
    ),
    education: p.education.map((e) => drop({ school: e.school, degree: e.degree, dates: e.dates })),
  });
}

export function buildReviewPrompt(task: ReviewTask): Prompt {
  return {
    system: `You review a LinkedIn profile for a job seeker and suggest concrete improvements. You are calm, specific and practical.

${JSON_RULES}
4. Headlines and the About draft may only use facts that appear in the profile: its employers, job titles, schools, skills, certifications and outcomes. Never introduce a company, school, product, client, certification, skill or number that the profile does not contain. Where a number would help but the profile gives none, write the literal placeholder [metric].
5. Use sentence case in headlines and the About draft: capitalise only the first word and proper nouns that appear in the profile.

Return one JSON object with exactly these keys:
{
  "verdict": string,        // 2 to 3 sentences: an honest overall read of the profile.
  "strengths": string[],    // 1 to 5 short points about what already works.
  "improvements": [{"title": string, "detail": string}],  // 1 to 7, most important first. title at most 8 words; detail 1 to 3 sentences with the concrete change.
  "headlines": string[],    // exactly 3 alternative headlines, each at most 220 characters, built only from the profile's facts. Sections may be separated with " | ".
  "about": string           // a rewritten About section, at most 2,600 characters, 2 to 4 short paragraphs separated by blank lines. First person is fine on LinkedIn.
}
The rule-based score and findings are context for the verdict and improvements; do not repeat the score in the headlines or About draft. No exclamation marks, no buzzword soup, no promises of outcomes.`,
    user: `Rule-based profile score (0 to 100): ${Math.round(task.score)}

Rule-based findings:
${fence(task.findings.length ? task.findings.map((f) => `- ${f}`).join("\n") : "(none)")}

The profile, as JSON:
${fence(JSON.stringify(compactProfile(task.profile), null, 1))}`,
  };
}

const asString = (v: unknown) => (typeof v === "string" ? v : "");

/** One line of prose: markdown, list markers and wrapping quotes removed, capped. */
function cleanLine(v: unknown, chars: number, words = 400): string {
  const s = stripWrappers(asString(v));
  if (!s) return "";
  const flat = collapse(stripQuotes(s.split("\n").map(stripLineLead).filter(Boolean).join(" ")));
  return cap(flat, words, chars);
}

/** Multi-paragraph prose for the About draft: keeps paragraphs and "•" lists. */
function cleanParagraphs(v: unknown, chars: number): string {
  const s = stripWrappers(asString(v));
  if (!s) return "";
  const text = stripQuotes(s)
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split("\n")
        .map((l) => collapse(l.replace(/^\s*[-*+]\s+/, "• ")))
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean)
    .join("\n\n");
  if (text.length <= chars) return text;
  const cut = text.slice(0, chars);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"));
  return (stop > chars * 0.6 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, "")).trim();
}

/** Headline: one line, ≤ 220 chars, cut at a " | " boundary when too long. */
function cleanHeadline(v: unknown): string {
  const s = cleanLine(v, 1000);
  if (s.length <= 220) return s;
  const cut = s.slice(0, 220);
  const bar = cut.lastIndexOf(" | ");
  return bar > 40 ? cut.slice(0, bar).trim() : "";
}

export function parseReview(task: ReviewTask, raw: string): LinkedInReview {
  const o = extractJson(raw, "object");
  if (!isPlainObject(o)) throw unusable("linkedin-review");

  const facts = profileText(task.profile);
  const context = `${facts}\n${task.findings.join("\n")}\n${Math.round(task.score)}`;
  const guard = nameGuard(facts);
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const uniq = (list: string[]) => list.filter((x, i) => x && list.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);

  const verdict = guardNumbers(cleanLine(o.verdict, 700, 110), context);
  if (!verdict) throw unusable("linkedin-review");

  const strengths = uniq(arr(o.strengths).map((s) => guardNumbers(cleanLine(s, 300, 50), context))).slice(0, 5);

  const improvements = arr(o.improvements)
    .map((x) => {
      if (!isPlainObject(x)) return null;
      const title = guardNumbers(cleanLine(x.title, 100, 14), context).replace(/[.:]+$/, "");
      const detail = guardNumbers(cleanLine(x.detail, 500, 90), context);
      return title && detail ? { title, detail } : null;
    })
    .filter((x): x is { title: string; detail: string } => x !== null)
    .slice(0, 7);

  // Headlines: profile facts only. A headline naming anything the profile doesn't contain is dropped whole.
  const headlines = uniq(
    arr(o.headlines)
      .map((h) => guardNumbers(cleanHeadline(h), facts))
      .filter((h) => h && guard.unknown(h).length === 0),
  ).slice(0, 3);

  const about = dropInventedSentences(guardNumbers(cleanParagraphs(o.about, 2600), facts), guard);

  return { verdict, strengths, improvements, headlines, about };
}

/* ---------------------------- generate-resume ---------------------------- */

const JD_PROMPT_CHARS = 12_000;

export function buildGeneratePrompt(task: GenerateTask): Prompt {
  const d = task.draft;
  const facts = {
    currentSummary: d.summary || undefined,
    roles: d.experience.map((e, index) => ({
      index,
      title: e.title,
      company: e.company,
      dates: [e.start, e.end].filter(Boolean).join(" - "),
      notes: e.bullets,
    })),
    education: d.education.map((e) => ({ degree: e.degree, institution: e.institution, details: e.details })),
    skills: d.skills,
    certifications: d.certifications,
  };
  const jd = task.jobDescription ? task.jobDescription.slice(0, JD_PROMPT_CHARS) : "";

  return {
    system: `You turn a job seeker's rough notes into polished, ATS-friendly resume content for a target role.

${JSON_RULES}
4. Each role's bullets may only use facts from that same role's notes. Never move facts between roles. A role with no notes gets an empty bullets array.
5. The job description (if given) only tells you what to emphasise and how to order things. Never copy requirements, tools or skills from it into the resume unless the user's own notes or skills list contain them.

Return one JSON object with exactly these keys:
{
  "headline": string,   // the target role as a short professional headline, e.g. "Data Analyst". Do not claim a past job title the person never held. No numbers.
  "summary": string,    // 2 to 4 sentences, at most 90 words, no first-person pronouns, no buzzwords, starts with a noun phrase describing the person's profession. Only facts from the notes, skills and education.
  "roles": [{"index": number, "bullets": string[]}],  // one entry per role, same index as given. 3 to 6 bullets per role when the notes support it (fewer if the notes are thin).
  "skills": string[]    // the person's skills ordered by relevance to the target role, de-duplicated. Only skills from their skills list or named explicitly in their notes.
}

How to write bullets:
${BULLET_GUIDE}
- Each bullet must be supported by that role's notes. Split long notes into separate bullets; combine fragments that describe the same thing.`,
    user: `Target role:\n${fence(task.targetRole)}\n\n${
      jd ? `Job description (for emphasis only):\n${fence(jd)}\n\n` : ""
    }The person's own facts, as JSON:\n${fence(JSON.stringify(facts, null, 1))}`,
  };
}

const skillKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseGenerated(task: GenerateTask, raw: string): ResumeContent {
  const o = extractJson(raw, "object");
  if (!isPlainObject(o)) throw unusable("generate-resume");
  const d = task.draft;

  const notesText = d.experience.map((e) => e.bullets.join("\n")).join("\n");
  const draftText = [
    d.name, d.headline, d.summary, d.location, notesText,
    ...d.experience.flatMap((e) => [e.title, e.company, e.location, e.start, e.end]),
    ...d.education.flatMap((e) => [e.institution, e.degree, e.dates, ...e.details]),
    ...d.skills, ...d.certifications,
  ]
    .filter(Boolean)
    .join("\n");
  const guard = nameGuard(`${draftText}\n${task.targetRole}`);
  let changed = 0;

  // Headline: honest target-role framing, no invented names, no numbers.
  const proposed = cleanLine(o.headline, 100, 12).replace(/[.]+$/, "");
  const headlineOk = proposed && !/\d/.test(proposed) && guard.unknown(proposed).length === 0;
  const headline = headlineOk ? proposed : task.targetRole || d.headline;
  if (headlineOk) changed++;

  // Summary: numbers only from the draft, sentences naming unknown things dropped.
  let summary = cleanLine(o.summary, 900, 110);
  summary = dropInventedSentences(guardNumbers(summary, draftText), guard);
  if (summary) changed++;
  else summary = d.summary ?? "";

  // Roles: bullets by index, each checked against that role's own notes.
  const byIndex = new Map<number, unknown[]>();
  const roles = Array.isArray(o.roles) ? o.roles : [];
  roles.forEach((r, pos) => {
    if (!isPlainObject(r) || !Array.isArray(r.bullets)) return;
    const idx = typeof r.index === "number" && Number.isInteger(r.index) ? r.index : roles.length === d.experience.length ? pos : -1;
    if (idx >= 0 && idx < d.experience.length && !byIndex.has(idx)) byIndex.set(idx, r.bullets);
  });

  const experience = d.experience.map((e, i) => {
    if (!e.bullets.length) return { ...e, bullets: [] };
    const notes = e.bullets.join("\n");
    const roleGuard = nameGuard([notes, e.title, e.company, e.location, ...d.skills, ...d.certifications].filter(Boolean).join("\n"));
    const seen = new Set<string>();
    const bullets = (byIndex.get(i) ?? [])
      .slice(0, 8)
      .map((b) => cleanBullet(notes, b))
      .filter((b): b is string => {
        if (!b || roleGuard.unknown(b).length) return false;
        const k = b.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 6);
    if (!bullets.length) return { ...e, bullets: [...e.bullets] }; // keep the user's own notes rather than lose the role
    changed++;
    return { ...e, bullets };
  });

  // Skills: the user's own list, or skills named verbatim in their notes. Nothing else survives.
  const own = new Map(d.skills.map((s) => [skillKey(s), s] as const));
  const mentioned = `${notesText}\n${d.summary ?? ""}`;
  const skills: string[] = [];
  const taken = new Set<string>();
  const take = (s: string) => {
    const k = skillKey(s);
    if (!k || taken.has(k)) return false;
    taken.add(k);
    skills.push(s);
    return true;
  };
  let fromModel = 0;
  for (const s of Array.isArray(o.skills) ? o.skills : []) {
    if (typeof s !== "string") continue;
    const clean = collapse(stripQuotes(s));
    const k = skillKey(clean);
    if (own.has(k)) fromModel += +take(own.get(k)!);
    else if (
      clean.length >= 1 &&
      clean.length <= 40 &&
      clean.split(/\s+/).length <= 4 &&
      new RegExp(`(?<![\\w+#.])${escapeRe(clean)}(?![\\w+#])`, "i").test(mentioned)
    )
      fromModel += +take(clean);
  }
  for (const s of d.skills) take(s); // never lose a skill the user listed
  if (fromModel) changed++;

  if (!changed) throw unusable("generate-resume");

  return {
    // Identity, contact, employers, titles, dates, schools and certifications: copied from the draft.
    name: d.name,
    headline: headline || null,
    email: d.email,
    phone: d.phone,
    location: d.location,
    linkedin: d.linkedin,
    links: [...d.links],
    summary: summary || null,
    experience,
    education: d.education.map((e) => ({ ...e, details: [...e.details] })),
    skills: skills.slice(0, 100),
    certifications: [...d.certifications],
  };
}
