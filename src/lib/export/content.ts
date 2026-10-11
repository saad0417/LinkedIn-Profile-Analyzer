/**
 * ExtractedProfile -> ResumeContent: the clean, editable content the
 * templates render. Dates are normalised to one format everywhere:
 * "Mon YYYY" (e.g. "Mar 2021"), "YYYY" when only a year is known, and
 * "Present" for ongoing roles. Unparseable dates keep their original text.
 */
import type { ExtractedProfile, ResumeContent } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LOOKUP: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const PRESENT_RE = /^(present|current|currently|now|today|ongoing|to date|date)$/i;

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

function fmt(year: number, month: number | null): string {
  return month ? `${MONTHS[month - 1]} ${year}` : String(year);
}

const validYear = (y: number) => y >= 1950 && y <= 2100;

/**
 * Normalise a single date to "Mon YYYY" / "YYYY" / "Present".
 * Accepts "YYYY-MM", "MM/YYYY", "MM.YYYY", "Mar 2021", "March, 2021",
 * "Mar '21", "2021", "Present"... Returns null if unparseable.
 */
export function normalizeDate(input: string | null | undefined): string | null {
  const s = clean(input).replace(/[.,]$/, "");
  if (!s) return null;
  if (PRESENT_RE.test(s)) return "Present";

  let m = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/); // 2021-03 / 2021-03-15
  if (m && validYear(+m[1]) && +m[2] >= 1 && +m[2] <= 12) return fmt(+m[1], +m[2]);

  m = s.match(/^(\d{1,2})\s*[-/.]\s*(\d{4})$/); // 03/2021
  if (m && validYear(+m[2]) && +m[1] >= 1 && +m[1] <= 12) return fmt(+m[2], +m[1]);

  m = s.match(/^([A-Za-z]{3,9})\.?,?\s*(?:'(\d{2})|(\d{4}))$/); // Mar 2021 / March, 2021 / Mar '21
  if (m) {
    const month = MONTH_LOOKUP[m[1].toLowerCase()];
    const year = m[3] ? +m[3] : 2000 + +m[2];
    if (month && validYear(year)) return fmt(year, month);
  }

  m = s.match(/^(\d{4})$/);
  if (m && validYear(+m[1])) return m[1];

  return null;
}

/** Split a written range ("03/2021 - Present", "2019 to 2021") into normalised parts. */
export function normalizeRange(input: string | null | undefined): { start: string; end: string } | null {
  const s = clean(input);
  if (!s) return null;
  const parts = s.split(/\s*(?:–|—|-{1,2}|\bto\b|\buntil\b|→)\s*/i).filter(Boolean);
  if (parts.length === 2) {
    const a = normalizeDate(parts[0]);
    const b = normalizeDate(parts[1]);
    if (a && b) return { start: a, end: b };
  }
  if (parts.length === 1) {
    const a = normalizeDate(parts[0]);
    if (a) return { start: a, end: "" };
  }
  return null;
}

/** Format a normalised range for display: "Mar 2021 – Present", "2019", or "". */
export function formatRange(start: string, end: string): string {
  const a = clean(start);
  const b = clean(end);
  if (a && b && a !== b) return `${a} – ${b}`;
  return a || b;
}

/** "YYYY-MM" | "present" (ExtractedRole.start/end) -> display form. */
function fromIso(v: string | null): string | null {
  if (!v) return null;
  if (v.toLowerCase() === "present") return "Present";
  return normalizeDate(v);
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = clean(raw);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Trim bullets and drop leading bullet glyphs the extractor may have kept. */
function cleanBullets(items: string[]): string[] {
  return items
    .map((b) => clean(b).replace(/^(?:[-*•·▪◦‣●○■□➢➤►–—]+)\s*/, ""))
    .filter((b) => b.length > 0);
}

export function profileToResumeContent(profile: ExtractedProfile): ResumeContent {
  const experience = profile.experience
    .map((r) => {
      let start = fromIso(r.start);
      let end = fromIso(r.end);
      if (!start || !end) {
        const written = normalizeRange(r.dates);
        if (written) {
          start ??= written.start || null;
          end ??= written.end || null;
        }
      }
      if (!start && !end && clean(r.dates)) {
        // Unparseable: keep the user's own text rather than guessing.
        start = clean(r.dates);
        end = "";
      } else if (start && !end && start !== "Present") {
        end = /present|current|now/i.test(r.dates ?? "") || !r.dates ? "Present" : "";
      }
      return {
        title: clean(r.title),
        company: clean(r.company),
        location: clean(r.location) || null,
        start: start ?? "",
        end: end ?? "",
        bullets: cleanBullets(r.bullets),
      };
    })
    .filter((r) => r.title || r.company || r.bullets.length);

  const education = profile.education
    .map((e) => {
      const range = normalizeRange(e.dates);
      return {
        institution: clean(e.institution),
        degree: clean(e.degree),
        dates: range ? formatRange(range.start, range.end) : clean(e.dates),
        details: cleanBullets(e.details),
      };
    })
    .filter((e) => e.institution || e.degree || e.details.length);

  return {
    name: clean(profile.name),
    headline: null,
    email: clean(profile.email) || null,
    phone: clean(profile.phone) || null,
    location: clean(profile.location) || null,
    linkedin: clean(profile.linkedin) || null,
    links: dedupe(profile.links).filter((l) => l.toLowerCase() !== clean(profile.linkedin).toLowerCase()),
    summary: clean(profile.summary) || null,
    experience,
    education,
    skills: dedupe(profile.skills),
    certifications: dedupe(profile.certifications),
  };
}
