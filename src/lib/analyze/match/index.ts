// Job-description matching. Pure and deterministic: works only from the
// resume's rawText + profile and the JD text, so it can be re-run on a stored
// AnalysisResult (see rematch in ../index.ts).
import type { Check, ExtractedProfile, KeywordHit, MatchResult } from "@/lib/types";
import { build, type CheckDef } from "../checks/common";
import { HARD_SKILLS, SOFT_SKILLS, STOPWORDS } from "./dictionary";
import { TITLE_WORDS } from "../profile";
import { cmp, collapse, normaliseText, quoteList } from "../text";

export const MATCH_DEFS = {
  title: {
    id: "match.title",
    category: "match",
    title: "Job title from the posting",
    severity: "high",
    weight: 15,
    why: "Recruiters search their ATS by job title first. A CV that never uses the title in the posting ranks lower for that search.",
  },
  hard: {
    id: "match.hard-skills",
    category: "match",
    title: "Hard skills from the posting",
    severity: "high",
    weight: 20,
    why: "Tools, technologies and qualifications are the keywords recruiters filter on. Each one missing from your CV is a search you will not appear in.",
  },
  soft: {
    id: "match.soft-skills",
    category: "match",
    title: "Other keywords from the posting",
    severity: "medium",
    weight: 8,
    why: "Recurring phrases in a posting show what the team cares about. Using the same words, where true, helps both the ATS ranking and the recruiter’s skim.",
  },
} satisfies Record<string, CheckDef>;

/* ---------------- term compilation ---------------- */

interface Term {
  term: string;
  kind: "hard" | "soft";
  ci: RegExp | null;
  cs: RegExp | null;
  /** Longest alias length, used to let longer phrases claim text first. */
  len: number;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function aliasPattern(alias: string): string {
  const body = esc(alias).replace(/(?:\\-|\s)+/g, "[\\s-]+");
  const plural = /\p{L}$/u.test(alias) && alias.length >= 4 ? "(?:s|es)?" : "";
  const short = alias.length <= 2 ? "(?![-&]\\p{L})" : "";
  return `(?<![\\p{L}\\p{N}+#])(?<!\\p{L}\\.)${body}${plural}(?![\\p{L}\\p{N}+#])${short}`;
}

function compile(entry: string, kind: "hard" | "soft"): Term {
  const aliases = entry.split("|").filter(Boolean);
  const term = aliases[0].replace(/^=/, "");
  const ci = aliases.filter((a) => !a.startsWith("=")).sort((a, b) => b.length - a.length || cmp(a, b));
  const cs = aliases.filter((a) => a.startsWith("=")).map((a) => a.slice(1)).sort((a, b) => b.length - a.length || cmp(a, b));
  return {
    term,
    kind,
    ci: ci.length ? new RegExp(ci.map(aliasPattern).join("|"), "giu") : null,
    cs: cs.length ? new RegExp(cs.map(aliasPattern).join("|"), "gu") : null,
    len: Math.max(...aliases.map((a) => a.replace(/^=/, "").length)),
  };
}

let DICT: Term[] | null = null;
function dictionary(): Term[] {
  if (!DICT) {
    DICT = [...HARD_SKILLS.map((e) => compile(e, "hard")), ...SOFT_SKILLS.map((e) => compile(e, "soft"))].sort(
      (a, b) => b.len - a.len || cmp(a.term, b.term),
    );
  }
  return DICT;
}

type Span = [number, number];

function spans(t: Term, text: string): Span[] {
  const out: Span[] = [];
  for (const re of [t.ci, t.cs]) {
    if (!re) continue;
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) out.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  }
  out.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Span[] = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && s[0] < last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  return merged;
}

/** Count each term's occurrences; longer terms claim their text first so "SQL Server" is not also "SQL". */
function countTerms(terms: Term[], text: string): Map<string, number> {
  const claimed: Span[] = [];
  const counts = new Map<string, number>();
  const overlaps = (s: Span) => claimed.some((c) => s[0] < c[1] && c[0] < s[1]);
  const ordered = [...terms].sort((a, b) => b.len - a.len || cmp(a.term, b.term));
  for (const t of ordered) {
    const free = spans(t, text).filter((s) => !overlaps(s));
    claimed.push(...free);
    counts.set(t.term, free.length);
  }
  return counts;
}

/** Hard-skill dictionary terms found in a piece of text, in dictionary order (display names). */
export function findHardSkills(text: string): string[] {
  const counts = countTerms(dictionary().filter((t) => t.kind === "hard"), text);
  return [...counts.entries()].filter(([, n]) => n > 0).map(([t]) => t).sort(cmp);
}

/** True when the whole phrase is a soft skill from the dictionary ("Communication", "Team Player"). */
export function isSoftSkill(phrase: string): boolean {
  const p = phrase.trim();
  return dictionary().some((t) => {
    if (t.kind !== "soft") return false;
    for (const re of [t.ci, t.cs]) {
      if (!re) continue;
      re.lastIndex = 0;
      const m = re.exec(p);
      if (m && m.index === 0 && m[0].length === p.length) return true;
    }
    return false;
  });
}

/* ---------------- JD parsing ---------------- */

const SENIORITY = /\b(senior|sr|junior|jr|lead|principal|staff|mid[-\s]?level|entry[-\s]?level|graduate|i{1,3}|iv)\b\.?/gi;

export function extractJobTitle(jd: string): string | null {
  const lines = jd
    .split(/\n/)
    .map((l) => collapse(l))
    .filter(Boolean);
  const clean = (s: string) =>
    collapse(
      s
        .replace(/^[\s\-–—:*#•]+/, "")
        .replace(/[\s.,;:!]+$/, "")
        .replace(/\s*[|]\s*.*$/, ""),
    );
  for (const l of lines.slice(0, 15)) {
    const m = l.match(/^(?:job\s*title|position(?:\s*title)?|role|title|vacancy|job)\s*[:–—-]\s*(.+)$/i);
    if (m && m[1].split(/\s+/).length <= 12) return clean(m[1]);
  }
  const first = lines[0];
  if (first && first.split(/\s+/).length <= 9 && TITLE_WORDS.test(first) && !/[.!?]$/.test(first) && !/^(about|we|our|join)\b/i.test(first))
    return clean(first);
  const m =
    jd.match(/\b(?:looking for|hiring|seeking|recruiting)\s+(?:an?\s+|our\s+(?:next|new)\s+)?(?:experienced\s+|talented\s+|motivated\s+)?([A-Z][\w&/+-]*(?:\s+[A-Z(][\w&/+()-]*){0,6})/) ??
    null;
  if (m && TITLE_WORDS.test(m[1])) return clean(m[1].replace(/\s+(?:to|who|with|for|in|at|that|on)\b.*$/, ""));
  return null;
}

/** The searchable core of a title: no parentheses, no " – Department", no seniority words. */
function coreTitle(title: string): { full: string; core: string } {
  const full = collapse(title.replace(/\([^)]*\)/g, " ").split(/\s+[–—-]\s+|,|\s+\|\s+/)[0]).toLowerCase();
  const core = collapse(full.replace(SENIORITY, " "));
  return { full, core: core || full };
}

function phraseRegex(phrase: string): RegExp {
  return new RegExp(aliasPattern(phrase), "giu");
}

function companyTokens(jd: string): Set<string> {
  const out = new Set<string>();
  const pats = [/^([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,3})\s+(?:is|are)\s+(?:hiring|looking|seeking|recruiting)/m, /\babout\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,3})/, /\bjoin\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,3})/];
  for (const p of pats) {
    const m = jd.match(p);
    if (m) for (const w of m[1].toLowerCase().split(/\s+/)) if (!STOPWORDS.has(w)) out.add(w);
  }
  return out;
}

/** Repeated multi-word phrases not covered by the dictionary (e.g. "payments platform"). */
function phraseKeywords(jd: string, claimed: Span[], exclude: Set<string>, titleWords: Set<string>): Map<string, number> {
  const counts = new Map<string, number>();
  const tokenRe = /[\p{L}][\p{L}'’-]*/gu;
  for (const sm of jd.matchAll(/[^\n.;:!?()•]+/g)) {
    const sentence = sm[0];
    const offset = sm.index ?? 0;
    const toks: { w: string; s: number; e: number }[] = [];
    for (const m of sentence.matchAll(tokenRe)) toks.push({ w: m[0].toLowerCase().replace(/['’]s$/, ""), s: offset + (m.index ?? 0), e: offset + (m.index ?? 0) + m[0].length });
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= toks.length; i++) {
        const g = toks.slice(i, i + n);
        if (g.some((t) => STOPWORDS.has(t.w) || t.w.length < 3 || exclude.has(t.w))) continue;
        if (g.every((t) => titleWords.has(t.w))) continue;
        if (claimed.some((c) => g[0].s < c[1] && c[0] < g[n - 1].e)) continue;
        const key = g.map((t) => t.w).join(" ");
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const repeated = [...counts.entries()].filter(([, c]) => c >= 2);
  // Prefer the longer phrase when a trigram is as frequent as its bigrams.
  return new Map(repeated.filter(([k, c]) => !repeated.some(([k2, c2]) => k2 !== k && k2.includes(k) && c2 >= c)));
}

/* ---------------- main ---------------- */

export interface MatchOutput {
  match: MatchResult;
  checks: Check[];
}

export function computeMatch(rawText: string, profile: ExtractedProfile, jdInput: string): MatchOutput {
  const jd = normaliseText(jdInput).replace(/\r\n?/g, "\n");
  const resume = normaliseText(rawText);
  const jobTitle = extractJobTitle(jd);

  // Dictionary terms present in the JD.
  const dict = dictionary();
  const jdCounts = countTerms(dict, jd);
  const selected = dict.filter((t) => (jdCounts.get(t.term) ?? 0) > 0);

  // Text claimed by dictionary terms, so phrases do not duplicate them.
  const claimed: Span[] = [];
  for (const t of selected) claimed.push(...spans(t, jd));
  const titleInfo = jobTitle ? coreTitle(jobTitle) : null;
  const titleWords = new Set((titleInfo?.full ?? "").split(/\s+/).filter(Boolean));
  const phrases = [...phraseKeywords(jd, claimed, companyTokens(jd), titleWords).entries()]
    .sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))
    .slice(0, 10);

  const resumeCounts = countTerms(selected, resume);
  const keywords: KeywordHit[] = [
    ...selected.map((t) => ({ term: t.term, kind: t.kind, inJd: jdCounts.get(t.term) ?? 0, inResume: resumeCounts.get(t.term) ?? 0 })),
    ...phrases.map(([p, c]) => ({ term: p, kind: "soft" as const, inJd: c, inResume: [...resume.matchAll(phraseRegex(p))].length })),
  ]
    .sort((a, b) => b.inJd - a.inJd || cmp(a.term.toLowerCase(), b.term.toLowerCase()) || cmp(a.term, b.term))
    .slice(0, 40);

  // Title.
  let titleFound = false;
  let titlePartial: string | null = null;
  if (titleInfo) {
    titleFound = phraseRegex(titleInfo.full).test(resume) || phraseRegex(titleInfo.core).test(resume);
    if (!titleFound) {
      const coreWords = titleInfo.core.split(/\s+/).filter((w) => !STOPWORDS.has(w));
      for (const r of profile.experience) {
        const t = (r.title ?? "").toLowerCase();
        const hit = coreWords.filter((w) => new RegExp(`(?<![\\p{L}])${esc(w)}(?![\\p{L}])`, "u").test(t)).length;
        if (coreWords.length >= 2 && hit >= Math.ceil((coreWords.length * 2) / 3)) {
          titlePartial = r.title;
          break;
        }
      }
    }
  }

  const checks: Check[] = [];
  if (jobTitle) {
    checks.push(
      build(MATCH_DEFS.title, {
        status: titleFound ? "pass" : titlePartial ? "warn" : "fail",
        summary: titleFound
          ? `Your CV uses the job title from the posting (“${jobTitle}”).`
          : titlePartial
            ? `The posting’s title is “${jobTitle}”. Your CV has a close variant (“${titlePartial}”) but not the title itself.`
            : `The posting’s job title, “${jobTitle}”, does not appear in your CV.`,
        fix: `If it honestly describes your experience, use the title “${titleInfo!.core.replace(/\b\p{L}/gu, (c) => c.toUpperCase())}” in your headline or summary, for example as the line under your name.`,
      }),
    );
  }
  const hard = keywords.filter((k) => k.kind === "hard");
  const soft = keywords.filter((k) => k.kind === "soft");
  const coverage = (list: KeywordHit[]) => list.filter((k) => k.inResume > 0).length;
  if (hard.length) {
    const have = coverage(hard);
    const missing = hard.filter((k) => k.inResume === 0).map((k) => k.term);
    const ratio = have / hard.length;
    checks.push(
      build(MATCH_DEFS.hard, {
        status: ratio >= 0.7 ? "pass" : ratio >= 0.4 ? "warn" : "fail",
        summary: `Your CV mentions ${have} of the ${hard.length} hard skills in the posting.${missing.length ? ` Missing: ${quoteList(missing, 6)}.` : ""}`,
        fix: "Add the missing skills you genuinely have, both in your skills section and in the bullet where you used them. Leave out anything you could not discuss in an interview.",
      }),
    );
  }
  if (soft.length) {
    const have = coverage(soft);
    const missing = soft.filter((k) => k.inResume === 0).map((k) => k.term);
    const ratio = have / soft.length;
    checks.push(
      build(MATCH_DEFS.soft, {
        status: ratio >= 0.6 ? "pass" : ratio >= 0.3 ? "warn" : "fail",
        summary: `Your CV uses ${have} of ${soft.length} other keywords from the posting.${missing.length ? ` Not found: ${quoteList(missing, 5)}.` : ""}`,
        fix: "Where it is true, echo the posting’s wording in your summary and bullets, for example by naming the stakeholders you worked with or how you communicated results.",
      }),
    );
  }
  if (!checks.length) {
    checks.push(
      build(MATCH_DEFS.hard, {
        status: "fail",
        summary: "We could not find a job title or any recognisable skills in the job description, so there is nothing to match against.",
        fix: "Paste the full job posting, including the title and the requirements section.",
      }),
    );
  }

  const score = scoreOf(checks);
  return { match: { score, jobTitle, titleFound, keywords }, checks };
}

export function scoreOf(checks: Check[]): number {
  const total = checks.reduce((n, c) => n + c.weight, 0);
  if (!total) return 0;
  const earned = checks.reduce((n, c) => n + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0), 0);
  return Math.round((100 * earned) / total);
}

