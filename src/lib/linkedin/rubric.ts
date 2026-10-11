// Deterministic LinkedIn profile rubric, from docs/research/linkedin-criteria.md §4.
//
// Seven sections whose weights sum to 100. Each check's weight is its share of
// the overall score (a section's check weights sum to the section weight).
// pass earns the full weight, warn half, fail nothing. Section score =
// round(100 × earned / section weight); overall = round(Σ earned).
//
// Only what LinkedIn's "Save to PDF" export shows is rated: no photo, banner,
// recommendations, endorsements, Featured, activity or Open to Work.
import type { Check, CheckStatus, Evidence, RewriteTarget, Severity } from "@/lib/types";
import type { LinkedInProfile, LinkedInSection, LinkedInSectionId } from "./types";
import { TITLE_WORDS } from "@/lib/analyze/profile";
import { findHardSkills, isSoftSkill } from "@/lib/analyze/match";
import { firstWord, isActionVerb } from "@/lib/analyze/verbs";
import { collapse, plural, quoteList, truncate } from "@/lib/analyze/text";

export const SECTION_WEIGHTS: Record<LinkedInSectionId, number> = {
  headline: 15,
  about: 20,
  experience: 30,
  skills: 12,
  education: 8,
  credentials: 5,
  contact: 10,
};

export const SECTION_LABELS: Record<LinkedInSectionId, string> = {
  headline: "Headline",
  about: "About",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  credentials: "Credentials",
  contact: "Contact & URL",
};

const ORDER: LinkedInSectionId[] = ["headline", "about", "experience", "skills", "education", "credentials", "contact"];

/** LinkedIn's export shows ~3 "Top Skills". Pass threshold kept configurable because the visible count is unverified. */
export const TOP_SKILLS_PASS = 3;

/** Things the PDF export does not contain, so the score cannot rate them. */
export const NOT_ASSESSED = [
  "Profile photo",
  "Background banner",
  "Recommendations",
  "Endorsements and your full skills list (the PDF shows only your top skills)",
  "Featured section, posts and activity",
  "Open to Work settings",
  "Connections and followers",
];

const PDF_NOTE = "LinkedIn’s PDF export doesn’t include your photo, banner, recommendations or endorsements, so they aren’t part of this score.";

export interface RubricInput {
  profile: LinkedInProfile;
  /** The Summary/About heading was printed (LinkedIn omits it when About is empty). */
  hasSummary: boolean;
}

interface Def {
  id: string;
  title: string;
  weight: number;
  why: string;
}

function severityOf(w: number): Severity {
  return w >= 6 ? "high" : w >= 3 ? "medium" : "low";
}

function mk(def: Def, status: CheckStatus, summary: string, extra: { fix?: string; evidence?: Evidence[]; rewriteTargets?: RewriteTarget[] } = {}): Check {
  const c: Check = {
    id: def.id,
    category: "profile",
    title: def.title,
    status,
    severity: severityOf(def.weight),
    weight: def.weight,
    summary,
    why: def.why,
  };
  if (status !== "pass" && extra.fix) c.fix = extra.fix;
  if (extra.evidence?.length) c.evidence = extra.evidence;
  if (status !== "pass" && extra.rewriteTargets?.length) c.rewriteTargets = extra.rewriteTargets;
  return c;
}

/* ---------------- shared helpers ---------------- */

/** Role words that are searchable on their own ("Student" and "Aspiring" are not). */
const NOT_ROLE = /^(student|graduate|aspiring|senior|junior|lead|head|principal|staff)$/i;
const ROLE_EXTRA = /\b(data|product|ux|ui|design|finance|financial|hr|operations|engineering|devops|security|cloud|growth|content|brand|people|talent|legal|compliance|research|recruiting|accounting|nursing|teaching|logistics|procurement|supply chain)\b/i;
const STOP = new Set("and or of the a an at in on for to with by from & - – | · at".split(" "));

/**
 * Earliest role keyword in `text`: a job-title word (Designer, Manager…) first,
 * else a field word (Product, Data…), else a word from the user's own current
 * titles. Null when there is none.
 */
function roleKeywordAt(text: string, titleWords: string[]): { at: number; word: string } | null {
  const first = (re: RegExp, ok: (w: string) => boolean = () => true): { at: number; word: string } | null => {
    for (const m of text.matchAll(re)) if (ok(m[0])) return { at: m.index ?? 0, word: m[0] };
    return null;
  };
  const title = first(new RegExp(TITLE_WORDS.source, "gi"), (w) => !NOT_ROLE.test(w.replace(/s$/i, "")));
  if (title) return title;
  const field = first(new RegExp(ROLE_EXTRA.source, "gi"));
  if (field) return field;
  let best: { at: number; word: string } | null = null;
  for (const w of titleWords) {
    const m = first(new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "giu"));
    if (m && (!best || m.at < best.at)) best = m;
  }
  return best;
}

function titleWordsOf(p: LinkedInProfile, currentOnly: boolean): string[] {
  const roles = currentOnly ? p.experience.filter((r) => r.end === "present") : p.experience;
  const words = new Set<string>();
  for (const r of roles)
    for (const w of (r.title ?? "").split(/[\s,/&()|·–-]+/))
      if (w.length >= 3 && !STOP.has(w.toLowerCase()) && !NOT_ROLE.test(w)) words.add(w.toLowerCase());
  return [...words].sort();
}

const YEAR_RE = /(?<![\d$€£₹.,])(?:19|20)\d{2}(?![\d%])/g;
const DURATION_RE = /\b\d+\+?\s*(?:years?|yrs?|months?|mos?)\b/gi;
const METRIC_RE =
  /[$€£₹]\s?\d[\d,.]*\s?(?:k|m|bn|b|million|billion|thousand)?\b|\d[\d,.]*\s?(?:%|percent\b|x\b)|\b\d[\d,.]*\+?|\b(?:doubled|tripled|halved|quadrupled|million|billion|thousands|hundreds|dozens)\b/gi;

/** Measurable figures in text, ignoring years, date ranges and durations. */
export function metrics(text: string): string[] {
  // Version and standard numbers ("WCAG 2.2", "ISO 9001", "Web 3.0") are names, not results.
  const t = text.replace(/\b[A-Z][A-Za-z]{1,}[\s-]?\d+(?:\.\d+)+\b|\b[A-Z]{2,}[\s-]\d{3,5}\b/g, " ").replace(DURATION_RE, " ").replace(YEAR_RE, " ");
  return [...t.matchAll(METRIC_RE)].map((m) => m[0].trim()).filter((m) => m && !/^0$/.test(m));
}

/** A Top Skill as it would appear in prose: "Go (Programming Language)" → "Go". */
function skillCore(s: string): string {
  return collapse(s.replace(/\([^)]*\)/g, " "));
}

function mentions(text: string, skill: string): boolean {
  const core = skillCore(skill);
  if (!core) return false;
  const esc = core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
  // Short skills ("Go", "R", "C#") must match case-sensitively.
  const flags = core.length <= 3 ? "u" : "iu";
  return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?:s|es)?(?![\\p{L}\\p{N}])`, flags).test(text);
}

function roleLabel(r: { title: string | null; company: string | null }): string {
  return [r.title, r.company].filter(Boolean).join(" · ") || "Untitled role";
}

/** Description lines: the user's own line breaks, bullet glyph stripped. */
function descriptionLines(d: string | null): string[] {
  if (!d) return [];
  return d
    .split(/\n+/)
    .map((l) => collapse(l.replace(/^\s*[•\-–*·▪]\s*/, "")))
    .filter(Boolean);
}

/** Latest year printed in the profile's dates: the export's "now", without reading the clock. */
function latestYear(p: LinkedInProfile): number | null {
  let y = 0;
  const scan = (s: string | null) => {
    for (const m of (s ?? "").matchAll(/(?:19|20)\d{2}/g)) y = Math.max(y, Number(m[0]));
  };
  for (const r of p.experience) {
    scan(r.dates);
    // "March 2022 - Present (4 years 8 months)": the export date is start + duration.
    if (r.end === "present" && r.start) {
      const d = (r.dates ?? "").match(/\((?:(\d+)\s+years?)?\s*(?:(\d+)\s+months?)?\)/i);
      if (d && (d[1] || d[2])) {
        const [sy, sm] = r.start.split("-").map(Number);
        const total = sy * 12 + (sm - 1) + Number(d[1] ?? 0) * 12 + Number(d[2] ?? 0) - 1;
        y = Math.max(y, Math.floor(total / 12));
      }
    }
  }
  for (const e of p.education) scan(e.dates);
  return y || null;
}

/** Years covered by the experience entries (earliest start to latest end). */
function experienceYears(p: LinkedInProfile): number {
  const now = latestYear(p);
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of p.experience) {
    const s = r.start ? Number(r.start.slice(0, 4)) + (Number(r.start.slice(5, 7)) - 1) / 12 : (r.dates?.match(/(?:19|20)\d{2}/) ? Number(r.dates.match(/(?:19|20)\d{2}/)![0]) : NaN);
    const e = r.end === "present" ? (now ?? NaN) : r.end ? Number(r.end.slice(0, 4)) + Number(r.end.slice(5, 7)) / 12 : NaN;
    if (Number.isFinite(s)) lo = Math.min(lo, s);
    if (Number.isFinite(e)) hi = Math.max(hi, e);
  }
  return Number.isFinite(lo) && Number.isFinite(hi) && hi > lo ? hi - lo : 0;
}

/* ---------------- headline (15) ---------------- */

const H = {
  length: { id: "linkedin.headline.length", title: "Headline length", weight: 4, why: "The headline can hold 220 characters and shows next to your name in every search result. A fuller headline gives recruiters, and LinkedIn search, more to match." },
  role: { id: "linkedin.headline.role-keyword", title: "Role in the first 80 characters", weight: 5, why: "Recruiters search by job title, and mobile search results show only about the first 80 characters of your headline." },
  generic: { id: "linkedin.headline.not-generic", title: "Headline says more than a status", weight: 3, why: "“Student at…” or a bare “Title at Company” repeats what your Experience already shows and wastes the most visible line on your profile." },
  segments: { id: "linkedin.headline.value-segments", title: "Role, skills and value", weight: 3, why: "Headlines that pair your role with your main skills and what you deliver (Role | Skills | Result) match more searches and tell people why to click." },
} satisfies Record<string, Def>;

function headlineChecks(p: LinkedInProfile): Check[] {
  const h = p.headline ? collapse(p.headline) : "";
  const ev: Evidence[] = h ? [{ text: h, where: "Headline" }] : [];
  const out: Check[] = [];
  const current = p.experience.find((r) => r.end === "present") ?? p.experience[0];
  const exampleRole = current?.title ?? "your role";

  // length
  const n = h.length;
  if (!h) out.push(mk(H.length, "fail", "We couldn't find a headline under your name.", { fix: `Add a headline: your role, two or three core skills and a result, for example “${exampleRole} | [skill] & [skill] | [result you deliver]”.` }));
  else if (n >= 70) out.push(mk(H.length, "pass", `Your headline is ${n} characters (LinkedIn allows 220).`, { evidence: ev }));
  else
    out.push(
      mk(H.length, n >= 40 ? "warn" : "fail", `Your headline is only ${plural(n, "character")} of the 220 LinkedIn allows.`, {
        evidence: ev,
        fix: `Use more of the space: keep your role first, then add your main skills and a result, for example “${h} | [skill] & [skill] | [what you deliver]”. Aim for 120–220 characters.`,
      }),
    );

  // role keyword
  const titleWords = titleWordsOf(p, true);
  const kw = h ? roleKeywordAt(h, titleWords) : null;
  if (!h) out.push(mk(H.role, "fail", "There is no headline to search.", { fix: `Start your headline with the job title you want to be found for, for example “${exampleRole}”.` }));
  else if (kw && kw.at < 80) out.push(mk(H.role, "pass", `Your headline names your role early (“${kw.word}”).`, { evidence: ev }));
  else if (kw)
    out.push(mk(H.role, "warn", `Your role (“${kw.word}”) only appears after the first 80 characters, which mobile search results cut off.`, { evidence: ev, fix: "Move your job title to the start of the headline." }));
  else
    out.push(
      mk(H.role, "fail", "Your headline doesn't name a job title or field a recruiter would search for.", {
        evidence: ev,
        fix: `Lead with the role you do or want, for example “${current?.title && current.title !== h ? current.title : "Marketing Analyst"} | …”, then add skills.`,
      }),
    );

  // not generic
  const segs = h.split(/\s*(?:\||•|·|–|—|,|;|\/\/)\s*|\s+-\s+/).map((s) => s.trim()).filter(Boolean);
  const statusOnly = /^(student|aspiring|seeking|looking for|unemployed|open to work|job seeker)\b/i.test(h) && segs.length <= 1;
  const studentAt = /^(student|graduate student|undergraduate|intern)\s+at\b/i.test(h) && segs.length <= 1;
  const titleAt = /^[^|•·,]{0,40}\bat\b [^|•·,]+$/i.test(h);
  const sameAsTitle = !!h && p.experience.some((r) => r.title && collapse(r.title).toLowerCase() === h.toLowerCase());
  if (!h) out.push(mk(H.generic, "fail", "There is no headline.", { fix: "Write a headline that says what you do and what you're good at, not just your status." }));
  else if (statusOnly || studentAt)
    out.push(
      mk(H.generic, "fail", `Your headline describes a status (“${truncate(h, 60)}”) rather than what you do.`, {
        evidence: ev,
        fix: "Say what you're studying or aiming for and what you can already do, for example “Business Administration student | Excel, data analysis & customer service | Seeking finance internships”.",
      }),
    );
  else if (titleAt || sameAsTitle)
    out.push(
      mk(H.generic, "warn", sameAsTitle ? "Your headline is just your current job title." : "Your headline is a plain “Title at Company”, which your Experience section already shows.", {
        evidence: ev,
        fix: "Keep the title, then add your specialism and a result, separated by “|”, for example “" + (h.split(/\s+at\s+/i)[0] || h) + " | [specialism] | [result you deliver]”.",
      }),
    );
  else out.push(mk(H.generic, "pass", "Your headline says more than a job title or status.", { evidence: ev }));

  // value segments
  const skillHits = h ? [...new Set([...findHardSkills(h), ...p.topSkills.filter((s) => mentions(h, s)).map(skillCore)])] : [];
  const nonTitleSeg = segs.slice(1).some((s) => !roleKeywordAt(s, titleWords) && s.split(/\s+/).length >= 2);
  const hasSkill = skillHits.length > 0 || nonTitleSeg;
  const multi = segs.length >= 2;
  if (multi && hasSkill) out.push(mk(H.segments, "pass", `Your headline has ${segs.length} parts and goes beyond the job title${skillHits.length ? ` (mentions ${quoteList(skillHits, 3)})` : ""}.`, { evidence: ev }));
  else
    out.push(
      mk(H.segments, multi || hasSkill ? "warn" : "fail", !h ? "There is no headline." : multi ? "Your headline has several parts but no skill or specialism a recruiter would search for." : hasSkill ? "Your headline is one phrase. Splitting it into role, skills and value makes it easier to scan." : "Your headline is a single phrase with no skills or specialism.", {
        evidence: ev,
        fix: "Use the pattern Role | Top skills | Value, for example “Data Analyst | SQL, Power BI & forecasting | Turning sales data into decisions”. Use skills that also appear in your Experience.",
      }),
    );
  return out;
}

/* ---------------- about (20) ---------------- */

const A = {
  length: { id: "linkedin.about.length", title: "About section length", weight: 8, why: "About holds up to 2,600 characters and all of it is searchable. A fuller About gives recruiters context and gives search more of your keywords." },
  hook: { id: "linkedin.about.hook", title: "Opening lines say what you do", weight: 4, why: "Only the first two or three lines (about 230–370 characters) show before “see more”. Most visitors decide from those lines whether to read on." },
  evidence: { id: "linkedin.about.evidence", title: "Numbers in your About", weight: 3, why: "A figure or two (team size, growth, money saved) turns claims into evidence and makes your About memorable." },
  structure: { id: "linkedin.about.structure", title: "Easy to read", weight: 3, why: "Short paragraphs or a few bullet lines are far easier to read on a phone than one long block of text." },
  cta: { id: "linkedin.about.cta", title: "Invitation to get in touch", weight: 2, why: "Ending with how to reach you, or what conversations you're open to, turns a profile visit into a message. First person is normal on LinkedIn." },
} satisfies Record<string, Def>;

/** 1234 → "1,234" without depending on the runtime's locale data. */
function thousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function aboutChecks(p: LinkedInProfile): Check[] {
  // LinkedIn omits the Summary heading when About is empty; either way there is nothing to rate.
  const s = p.summary?.trim() ?? "";
  if (!s) {
    const fix = "Add an About section (Profile → Add profile section → About): 3–5 short paragraphs on what you do, your main skills, two results with numbers, and how to reach you.";
    return [
      mk(A.length, "fail", "Your profile has no About section, so this part of the score is zero.", { fix }),
      mk(A.hook, "fail", "There is no About section to open with your role.", { fix: "Open your About with one sentence on what you do and for whom." }),
      mk(A.evidence, "fail", "There is no About section, so no results are shown there.", { fix: "Include one or two results with figures in your About." }),
      mk(A.structure, "fail", "There is no About section.", { fix: "Write your About as 3–5 short paragraphs." }),
      mk(A.cta, "fail", "There is no About section to invite contact.", { fix: "End your About with how people can reach you or what you're open to." }),
    ];
  }
  const target: RewriteTarget[] = [{ kind: "summary", text: s }];
  const head = truncate(s, 160);
  const out: Check[] = [];
  const n = s.length;
  if (n >= 1000) out.push(mk(A.length, "pass", `Your About is ${thousands(n)} characters (up to 2,600 are allowed).`));
  else
    out.push(
      mk(A.length, n >= 300 ? "warn" : "fail", `Your About is ${plural(n, "character")} long. Profiles with a fuller About (1,000+ characters) give recruiters much more to go on.`, {
        evidence: [{ text: head, where: "About" }],
        fix: "Expand it to roughly 1,000–2,000 characters: what you do and for whom, your main skills, two or three results with numbers, and what you're looking for next.",
        rewriteTargets: target,
      }),
    );

  const opening = s.slice(0, 300);
  const kw = roleKeywordAt(opening, titleWordsOf(p, false));
  const skill = p.topSkills.find((k) => mentions(opening, k));
  if (kw || skill) out.push(mk(A.hook, "pass", `Your opening lines mention “${kw?.word ?? skillCore(skill!)}”, so visitors see what you do before “see more”.`, { evidence: [{ text: truncate(opening, 160), where: "About · first lines" }] }));
  else
    out.push(
      mk(A.hook, "fail", "The first 300 characters of your About don't mention your role or any of your top skills.", {
        evidence: [{ text: truncate(opening, 160), where: "About · first lines" }],
        fix: "Rewrite the first sentence to say what you do, for example “I’m a [role] who [what you do] for [who].”",
        rewriteTargets: target,
      }),
    );

  const figs = metrics(s);
  if (figs.length >= 2) out.push(mk(A.evidence, "pass", `Your About includes ${figs.length} figures, such as ${quoteList([...new Set(figs)], 3)}.`));
  else
    out.push(
      mk(A.evidence, figs.length === 1 ? "warn" : "fail", figs.length === 1 ? `Your About has one figure (“${figs[0]}”).` : "Your About has no numbers, so it reads as claims rather than results.", {
        evidence: [{ text: head, where: "About" }],
        fix: "Add one or two concrete results with figures, for example “grew Instagram followers from 4,200 to 11,000 in 18 months”. Use real numbers only.",
        rewriteTargets: target,
      }),
    );

  const paras = s.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const bulletLines = s.split(/\n/).filter((l) => /^\s*[•\-–*·▪]\s/.test(l)).length;
  const longPara = paras.find((x) => x.length > 600);
  if ((paras.length >= 2 || bulletLines >= 3) && !longPara) out.push(mk(A.structure, "pass", `Your About is split into ${paras.length >= 2 ? plural(paras.length, "paragraph") : `${bulletLines} bullet lines`}.`));
  else
    out.push(
      mk(A.structure, "warn", longPara ? `One paragraph of your About runs to ${longPara.length} characters.` : "Your About is a single block of text.", {
        evidence: [{ text: truncate(longPara ?? s, 160), where: "About" }],
        fix: "Break it into short paragraphs of 2–3 sentences, or use a few bullet lines for key results.",
      }),
    );

  const cta = /@|https?:\/\/|www\.|\.(com|io|dev|design|net|org|co)\b|\b(reach out|contact me|get in touch|let'?s connect|let’s connect|message me|connect with me|open to|happy to (talk|chat)|email me|drop me a)\b/i.test(s);
  if (cta) out.push(mk(A.cta, "pass", "Your About tells people how to reach you or what you're open to."));
  else
    out.push(
      mk(A.cta, "warn", "Your About doesn't say how to get in touch or what you're open to.", {
        fix: "End with one line such as “Open to conversations about [type of role]. Message me here or email [address].”",
      }),
    );
  return out;
}

/* ---------------- experience (30) ---------------- */

const E = {
  count: { id: "linkedin.experience.role-count", title: "Roles listed", weight: 4, why: "Recruiters filter by past job titles and total years of experience, both taken from your Experience entries." },
  descriptions: { id: "linkedin.experience.descriptions", title: "Roles have descriptions", weight: 6, why: "Descriptions are searchable. A role with only a title gives recruiters nothing to match and no idea what you did." },
  current: { id: "linkedin.experience.current-role", title: "Current role described", weight: 6, why: "Your current role is the first thing recruiters read in Experience. A described current position was part of LinkedIn's “All-Star” profile criteria." },
  quantified: { id: "linkedin.experience.quantified", title: "Results with numbers", weight: 6, why: "Figures (customers served, money saved, growth) show the size of your work and make descriptions stand out." },
  titles: { id: "linkedin.experience.searchable-titles", title: "Searchable job titles", weight: 3, why: "LinkedIn Recruiter's title filter matches the titles in your Experience. Standard titles get found; creative ones do not." },
  locations: { id: "linkedin.experience.dates-locations", title: "Dates and locations", weight: 3, why: "Location is a recruiter filter, and complete dates let LinkedIn calculate your years of experience." },
  verbs: { id: "linkedin.experience.action-verbs", title: "Descriptions lead with what you did", weight: 2, why: "Starting lines with an action verb (Led, Built, Reduced) makes your contribution clear. Full sentences are fine on LinkedIn too." },
} satisfies Record<string, Def>;

const VANITY = /\b(ninja|rock ?star|guru|wizard|hero|jedi|unicorn|superstar|evangelist|happiness)\b/i;

function experienceChecks(p: LinkedInProfile): Check[] {
  const roles = p.experience;
  const out: Check[] = [];
  const n = roles.length;
  if (n >= 3) out.push(mk(E.count, "pass", `You list ${n} roles.`));
  else
    out.push(
      mk(E.count, n ? "warn" : "fail", n ? `You list ${plural(n, "role")}.` : "We found no roles in your Experience section.", {
        fix: "Add your past positions too, including internships, part-time, volunteer and freelance work, each with dates and a short description.",
        evidence: roles.map((r) => ({ text: roleLabel(r), where: r.dates ?? undefined })),
      }),
    );

  const described = roles.filter((r) => (r.description ?? "").length >= 100);
  const bare = roles.filter((r) => (r.description ?? "").length < 100);
  const share = n ? described.length / n : 0;
  if (n && share >= 0.66) out.push(mk(E.descriptions, "pass", described.length === n ? `All ${plural(n, "role")} have a description.` : `${described.length} of ${n} roles have a description of 100+ characters.`));
  else
    out.push(
      mk(E.descriptions, n && share >= 0.33 ? "warn" : "fail", n ? `${bare.length} of ${plural(n, "role")} ${bare.length === 1 ? "has" : "have"} little or no description (under 100 characters).` : "There are no roles to describe.", {
        evidence: bare.slice(0, 6).map((r) => ({ text: roleLabel(r), where: r.description ? `${r.description.length} characters` : "no description" })),
        fix: "For each role, add 2–4 lines: what you were responsible for and one or two results, with numbers where you have them.",
      }),
    );

  const current = roles.filter((r) => r.end === "present");
  const bestCurrent = [...current].sort((a, b) => (b.description ?? "").length - (a.description ?? "").length)[0];
  const curLen = (bestCurrent?.description ?? "").length;
  const year = latestYear(p);
  const studying = p.education.some((e) => {
    const m = (e.dates ?? "").match(/(\d{4})\s*$/);
    return !!m && year !== null && Number(m[1]) >= year;
  });
  if (bestCurrent && curLen >= 200) out.push(mk(E.current, "pass", `Your current role (${roleLabel(bestCurrent)}) has a ${curLen}-character description.`));
  else if (bestCurrent && curLen > 0)
    out.push(
      mk(E.current, "warn", `Your current role (${roleLabel(bestCurrent)}) has only a ${curLen}-character description.`, {
        evidence: [{ text: truncate(bestCurrent.description!, 160), where: roleLabel(bestCurrent) }],
        fix: "Expand it to at least 200 characters: your scope (team, customers, budget) and two results with numbers.",
      }),
    );
  else
    out.push(
      mk(E.current, !bestCurrent && studying ? "warn" : "fail", bestCurrent ? `Your current role (${roleLabel(bestCurrent)}) has no description.` : studying ? "No role is marked as current. That's expected while you're studying, but a current role (part-time job, internship, project) helps." : "No role in your Experience is marked as current (“Present”).", {
        evidence: bestCurrent ? [{ text: roleLabel(bestCurrent), where: bestCurrent.dates ?? undefined }] : undefined,
        fix: bestCurrent
          ? "Add a description to your current role: what you do, for whom, and one or two results with numbers."
          : "If you're working, studying or freelancing now, add it as a current position with “I am currently working in this role” ticked.",
      }),
    );

  const withDesc = roles.filter((r) => (r.description ?? "").trim());
  const quant = withDesc.filter((r) => metrics(r.description!).length > 0);
  const noNums = withDesc.filter((r) => metrics(r.description!).length === 0);
  const qShare = withDesc.length ? quant.length / withDesc.length : 0;
  const numberlessLines = noNums.flatMap((r) => descriptionLines(r.description).map((t) => ({ t, where: roleLabel(r) })));
  const includes = (k: number) => (k === 1 ? "includes" : "include");
  if (withDesc.length && qShare >= 0.5) out.push(mk(E.quantified, "pass", `${quant.length} of ${plural(withDesc.length, "described role")} ${includes(quant.length)} a number.`));
  else
    out.push(
      mk(E.quantified, quant.length ? "warn" : "fail", withDesc.length ? `${quant.length} of ${plural(withDesc.length, "described role")} ${includes(quant.length)} a number.` : "Your roles have no descriptions, so there are no results to show.", {
        evidence: noNums.slice(0, 6).map((r) => ({ text: truncate(r.description!, 160), where: roleLabel(r) })),
        fix: "Add a figure to at least half of your roles: how many, how much, how fast or by what percentage, for example “Cut month-end close from 9 to 5 days”.",
        rewriteTargets: numberlessLines.slice(0, 8).map((x) => ({ kind: "bullet" as const, text: x.t })),
      }),
    );

  const vanity = roles.filter((r) => r.title && VANITY.test(r.title));
  const searchable = roles.filter((r) => r.title && roleKeywordAt(r.title, []));
  const noTitle = roles.filter((r) => !r.title);
  if (!n) out.push(mk(E.titles, "fail", "There are no job titles to search.", { fix: "Add your roles with standard job titles." }));
  else if (vanity.length)
    out.push(
      mk(E.titles, "warn", `${plural(vanity.length, "title")} ${vanity.length === 1 ? "uses" : "use"} a nickname rather than a job title recruiters search for.`, {
        evidence: vanity.map((r) => ({ text: r.title!, where: r.company ?? undefined })),
        fix: "Use the standard title for the work (for example “Customer Success Manager” rather than “Customer Happiness Hero”). Keep the fun version in the description if you like.",
      }),
    );
  else if (!searchable.length || noTitle.length === n)
    out.push(
      mk(E.titles, "fail", "None of your job titles contain a common role word (such as Engineer, Manager, Analyst, Assistant).", {
        evidence: roles.slice(0, 4).map((r) => ({ text: r.title ?? "(no title)", where: r.company ?? undefined })),
        fix: "Use the market-standard title for each role, the one you'd search for in a job board.",
      }),
    );
  else out.push(mk(E.titles, "pass", searchable.length === n ? "All your job titles use standard role words." : `${searchable.length} of ${n} job titles use standard role words.`));

  const withLoc = roles.filter((r) => r.location);
  if (n && withLoc.length / n >= 0.8) out.push(mk(E.locations, "pass", withLoc.length === n ? "Every role has dates and a location." : `${withLoc.length} of ${n} roles have a location.`));
  else
    out.push(
      mk(E.locations, "warn", n ? `${n - withLoc.length} of ${plural(n, "role")} ${n - withLoc.length === 1 ? "has" : "have"} no location.` : "There are no roles to check.", {
        evidence: roles.filter((r) => !r.location).slice(0, 6).map((r) => ({ text: roleLabel(r), where: r.dates ?? undefined })),
        fix: "Edit each position and add its location (city and region, or “Remote”).",
      }),
    );

  const lines = withDesc.flatMap((r) => descriptionLines(r.description).map((t) => ({ t, where: roleLabel(r) })));
  const verbLines = lines.filter((l) => isActionVerb(firstWord(l.t)) || /^(I|We)\s+\p{L}+/u.test(l.t) && isActionVerb(l.t.split(/\s+/)[1] ?? ""));
  if (lines.length && verbLines.length / lines.length >= 0.5) out.push(mk(E.verbs, "pass", `${verbLines.length} of ${plural(lines.length, "description line")} start with what you did.`));
  else {
    const off = lines.filter((l) => !verbLines.includes(l));
    out.push(
      mk(E.verbs, "warn", lines.length ? `Only ${verbLines.length} of ${plural(lines.length, "description line")} start with an action verb.` : "There are no role descriptions to check.", {
        evidence: off.slice(0, 5).map((l) => ({ text: truncate(l.t, 160), where: l.where })),
        fix: "Start lines with what you did: “Responsible for social media” becomes “Ran social media for 3 brands, growing followers 40%”.",
        rewriteTargets: off.slice(0, 8).map((l) => ({ kind: "bullet" as const, text: l.t })),
      }),
    );
  }
  return out;
}

/* ---------------- skills (12) ---------------- */

const S = {
  count: { id: "linkedin.skills.top-skills-count", title: "Top skills listed", weight: 6, why: `Recruiters filter by skills. ${PDF_NOTE} The export lists only your top skills, so we rate those.` },
  alignment: { id: "linkedin.skills.alignment", title: "Skills backed up in your profile", weight: 4, why: "Skills that also appear in your headline, About or role descriptions look credible and help you rank for those searches." },
  hard: { id: "linkedin.skills.hard-skill", title: "Specific, searchable skills", weight: 2, why: "Recruiters search for concrete skills and tools (SQL, Figma, Payroll), rarely for soft skills like “Communication”." },
} satisfies Record<string, Def>;

function skillChecks(p: LinkedInProfile): Check[] {
  const sk = p.topSkills;
  const out: Check[] = [];
  const ev: Evidence[] = sk.length ? [{ text: sk.join(", "), where: "Top Skills" }] : [];
  if (sk.length >= TOP_SKILLS_PASS) out.push(mk(S.count, "pass", `Your profile shows ${plural(sk.length, "top skill")}: ${quoteList(sk, 5)}.`, { evidence: ev }));
  else
    out.push(
      mk(S.count, sk.length ? "warn" : "fail", sk.length ? `Your profile shows only ${plural(sk.length, "top skill")}.` : "Your PDF lists no Top Skills.", {
        evidence: ev,
        fix: "Add at least 5 skills on LinkedIn (Profile → Add profile section → Skills) and pin your three most relevant as top skills.",
      }),
    );

  const text = [p.headline ?? "", p.summary ?? "", ...p.experience.map((r) => `${r.title ?? ""} ${r.description ?? ""}`)].join("\n");
  const backed = sk.filter((k) => mentions(text, k));
  const unbacked = sk.filter((k) => !backed.includes(k));
  if (!sk.length) out.push(mk(S.alignment, "fail", "There are no top skills to compare with the rest of your profile.", { fix: "Add skills that match the work described in your Experience." }));
  else if (backed.length >= Math.min(2, sk.length)) out.push(mk(S.alignment, "pass", `${quoteList(backed.map(skillCore), 3)} also ${backed.length === 1 ? "appears" : "appear"} in your headline, About or roles.`));
  else
    out.push(
      mk(S.alignment, backed.length ? "warn" : "fail", backed.length ? `Only ${quoteList(backed.map(skillCore), 2)} also appears elsewhere in your profile.` : "None of your top skills appear in your headline, About or role descriptions.", {
        evidence: unbacked.map((k) => ({ text: k, where: "Top Skills · not mentioned elsewhere" })),
        fix: `Mention ${quoteList(unbacked.map(skillCore), 2)} where you used ${unbacked.length === 1 ? "it" : "them"}, in a role description or your About, or swap in skills your experience shows.`,
      }),
    );

  const hard = sk.filter((k) => !isSoftSkill(skillCore(k)));
  if (hard.length) out.push(mk(S.hard, "pass", `${quoteList(hard.map(skillCore), 3)} ${hard.length === 1 ? "is a" : "are"} specific skill${hard.length === 1 ? "" : "s"} recruiters search for.`));
  else
    out.push(
      mk(S.hard, "warn", sk.length ? `Your top skills (${quoteList(sk, 3)}) are all soft skills.` : "There are no top skills listed.", {
        evidence: ev,
        fix: "Pin at least one concrete skill or tool you use (for example “Financial Modeling”, “Figma” or “Python”) as a top skill.",
      }),
    );
  return out;
}

/* ---------------- education (8) ---------------- */

const ED = {
  present: { id: "linkedin.education.present", title: "Education listed", weight: 4, why: "Education is a common recruiter filter, and it was part of LinkedIn's “All-Star” profile criteria." },
  degree: { id: "linkedin.education.degree-field", title: "Degree and field", weight: 2, why: "Degree filters match the qualification line (for example “Bachelor of Science - BS, Computer Science”), not the school name." },
  dates: { id: "linkedin.education.dates", title: "Education dates", weight: 2, why: "Years let recruiters place your studies in your timeline." },
} satisfies Record<string, Def>;

function educationChecks(p: LinkedInProfile): Check[] {
  const ed = p.education.filter((e) => e.school || e.degree);
  if (!ed.length) {
    const senior = experienceYears(p) >= 10;
    const st: CheckStatus = senior ? "warn" : "fail";
    const fix = "Add your highest qualification (Profile → Add profile section → Education) with degree, field of study and years. Certificates and bootcamps count too.";
    return [
      mk(ED.present, st, senior ? "Your profile has no Education section. With 10+ years of experience this matters less, but some recruiters still filter on it." : "Your profile has no Education section.", { fix }),
      mk(ED.degree, st, "There is no education entry to show a degree.", { fix }),
      mk(ED.dates, st, "There is no education entry to date.", { fix }),
    ];
  }
  const out: Check[] = [mk(ED.present, "pass", `You list ${plural(ed.length, "education entry", "education entries")}.`)];
  const noDeg = ed.filter((e) => !e.degree);
  out.push(
    noDeg.length
      ? mk(ED.degree, "warn", `${plural(noDeg.length, "entry", "entries")} show${noDeg.length === 1 ? "s" : ""} only the school name.`, {
          evidence: noDeg.map((e) => ({ text: e.school ?? "(school)", where: "Education" })),
          fix: "Edit the entry and fill in Degree and Field of study, for example “High School Diploma” or “BSc, Economics”.",
        })
      : mk(ED.degree, "pass", "Each education entry shows a degree or qualification."),
  );
  const noDates = ed.filter((e) => !e.dates);
  out.push(
    noDates.length
      ? mk(ED.dates, "warn", `${plural(noDates.length, "entry", "entries")} ${noDates.length === 1 ? "has" : "have"} no years.`, {
          evidence: noDates.map((e) => ({ text: e.school ?? e.degree ?? "(entry)", where: "Education" })),
          fix: "Add the start and end years to each entry (an expected end year is fine while you're studying).",
        })
      : mk(ED.dates, "pass", "Each education entry has dates."),
  );
  return out;
}

/* ---------------- credentials (5) ---------------- */

const CR = {
  any: { id: "linkedin.credentials.any", title: "Certifications, awards or languages", weight: 3, why: "Certifications, honours, publications and languages are optional, but they set you apart and certifications are keyword-searchable." },
  depth: { id: "linkedin.credentials.depth", title: "Credentials beyond the basics", weight: 2, why: "A relevant certification, or a mix of awards, publications and languages, gives recruiters extra reasons to shortlist you." },
} satisfies Record<string, Def>;

function credentialChecks(p: LinkedInProfile): Check[] {
  const groups: [string, string[]][] = [
    ["Certifications", p.certifications],
    ["Honors-Awards", p.honors],
    ["Publications", p.publications],
    ["Languages", p.languages],
  ];
  const filled = groups.filter(([, v]) => v.length);
  const ev = filled.map(([k, v]) => ({ text: truncate(v.join(", "), 160), where: k }));
  const out: Check[] = [];
  out.push(
    filled.length
      ? mk(CR.any, "pass", `Your profile lists ${quoteList(filled.map(([k, v]) => `${k} (${v.length})`), 4).replace(/[“”]/g, "")}.`, { evidence: ev })
      : mk(CR.any, "warn", "Your profile lists no certifications, honours, publications or languages.", {
          fix: "If you have any, add them: a relevant certification, an award, or the languages you speak with your proficiency.",
        }),
  );
  const deep = p.certifications.length >= 1 || filled.length >= 2;
  out.push(
    deep
      ? mk(CR.depth, "pass", p.certifications.length ? `You list ${plural(p.certifications.length, "certification")}.` : `You list ${filled.length} kinds of credentials.`)
      : mk(CR.depth, "warn", filled.length ? `Your only credentials are ${filled[0][0].toLowerCase()}.` : "There are no credentials to show depth.", {
          fix: "Add a certification relevant to your field (many are free or low-cost), or list languages and awards you already have.",
        }),
  );
  return out;
}

/* ---------------- contact (10) ---------------- */

const C = {
  url: { id: "linkedin.contact.custom-url", title: "Custom profile URL", weight: 4, why: `A name-based URL (linkedin.com/in/your-name) looks tidier on a CV and is easier to share than the default with random characters. ${PDF_NOTE}` },
  location: { id: "linkedin.contact.location", title: "Location", weight: 3, why: "Location is one of the main filters in LinkedIn Recruiter. Without it you drop out of location-based searches." },
  email: { id: "linkedin.contact.email", title: "Email in contact info", weight: 2, why: "An email address lets recruiters contact you without InMail credits." },
  link: { id: "linkedin.contact.extra-link", title: "Portfolio or website", weight: 1, why: "A portfolio, GitHub or personal site gives evidence of your work beyond the profile." },
} satisfies Record<string, Def>;

function contactChecks(p: LinkedInProfile): Check[] {
  const out: Check[] = [];
  const url = p.profileUrl;
  const slug = url?.match(/linkedin\.com\/in\/([^\s/?#]+)/i)?.[1] ?? null;
  if (!url || !slug) out.push(mk(C.url, "fail", "We couldn't find your profile URL in the PDF.", { fix: "Check Contact info on LinkedIn and export the PDF again from your own profile (More → Save to PDF)." }));
  else if (/-[0-9a-f]{6,}$/i.test(slug) || /-?\d{3,}$/.test(slug) || slug.length > 40)
    out.push(
      mk(C.url, "warn", slug.length > 40 && !/\d{3,}|-[0-9a-f]{6,}$/i.test(slug) ? `Your profile URL is long (${slug.length} characters).` : "Your profile URL still has LinkedIn's default random ending.", {
        evidence: [{ text: url, where: "Contact" }],
        fix: `Edit it under “Edit public profile & URL” to something short like linkedin.com/in/${(p.name ?? "your-name").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")}.`,
      }),
    );
  else out.push(mk(C.url, "pass", `Your profile URL is clean: ${url}.`, { evidence: [{ text: url, where: "Contact" }] }));

  out.push(
    p.location
      ? mk(C.location, "pass", `Your location is set: ${p.location}.`)
      : mk(C.location, "fail", "We found no location under your headline.", { fix: "Add your city or metro area in your intro (Edit intro → Location)." }),
  );
  out.push(
    p.email
      ? mk(C.email, "pass", "Your contact info includes an email address.")
      : mk(C.email, "warn", "Your contact info has no email address.", { fix: "Add an email under Contact info and set who can see it. Use one you check often." }),
  );
  out.push(
    p.websites.length
      ? mk(C.link, "pass", `You link to ${quoteList(p.websites, 2)}.`)
      : mk(C.link, "warn", "Your contact info has no website besides LinkedIn.", { fix: "Add a portfolio, GitHub, personal site or company page under Contact info → Website." }),
  );
  return out;
}

/* ---------------- assemble ---------------- */

export function scoreProfile(input: RubricInput): { score: number; sections: LinkedInSection[] } {
  const p = input.profile;
  const bySection: Record<LinkedInSectionId, Check[]> = {
    headline: headlineChecks(p),
    about: aboutChecks(p),
    experience: experienceChecks(p),
    skills: skillChecks(p),
    education: educationChecks(p),
    credentials: credentialChecks(p),
    contact: contactChecks(p),
  };
  let earnedTotal = 0;
  const sections: LinkedInSection[] = ORDER.map((id) => {
    const checks = bySection[id];
    const weight = SECTION_WEIGHTS[id];
    const total = checks.reduce((n, c) => n + c.weight, 0);
    const earned = checks.reduce((n, c) => n + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0), 0);
    earnedTotal += total ? (earned / total) * weight : 0;
    return { id, label: SECTION_LABELS[id], score: total ? Math.round((100 * earned) / total) : 0, weight, checks };
  });
  return { score: Math.round(earnedTotal), sections };
}
