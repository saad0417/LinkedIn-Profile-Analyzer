// Content checks: deterministic writing conventions.
import type { Check, Evidence, RewriteTarget } from "@/lib/types";
import { build, NOT_EVALUATED, type CheckContext, type CheckDef } from "./common";
import { plural, quoteList, truncate, wordCount } from "../text";
import { findDateRanges, monthIndex, type ParsedDate } from "../dates";
import type { BulletRef } from "../profile";
import { firstWord, isActionVerb } from "../verbs";

/** Bullet openers that describe duties rather than results. Matched at the start of a bullet, case-insensitively. */
export const WEAK_OPENERS = [
  "responsible for",
  "was responsible for",
  "responsibilities included",
  "responsibilities include",
  "duties included",
  "duties include",
  "tasked with",
  "in charge of",
  "involved in",
  "participated in",
  "helped with",
  "helped to",
  "helped",
  "assisted with",
  "assisted in",
  "assisted",
  "worked on",
  "worked with",
  "worked as",
  "contributed to",
  "handled",
  "dealt with",
  "tried to",
  "my role was",
  "my duties",
] as const;

export const CONTENT_DEFS = {
  quantified: {
    id: "content.quantified",
    category: "content",
    title: "Results backed by numbers",
    severity: "high",
    weight: 15,
    why: "Recruiters skim for evidence of impact. Numbers (amounts, percentages, team sizes, volumes) make a bullet concrete and memorable.",
  },
  weakOpeners: {
    id: "content.weak-openers",
    category: "content",
    title: "Bullets open with strong verbs",
    severity: "medium",
    weight: 10,
    why: "Phrases like “Responsible for” describe a job description, not what you achieved. A strong verb puts your contribution first.",
  },
  padding: {
    id: "content.padding",
    category: "content",
    title: "Specific, varied bullet points",
    severity: "low",
    weight: 5,
    why: "Very short bullets and the same opening verb repeated read as filler and waste the few seconds a recruiter spends on each role.",
  },
  pronouns: {
    id: "content.pronouns",
    category: "content",
    title: "No first-person pronouns",
    severity: "medium",
    weight: 8,
    why: "CV convention is implied first person: “Led a team of 6”, not “I led a team of 6”. Pronouns take space and read as informal.",
  },
  gaps: {
    id: "content.gaps",
    category: "content",
    title: "No unexplained employment gaps",
    severity: "medium",
    weight: 8,
    why: "Recruiters notice gaps between roles, and some screening rules flag them. A one-line explanation answers the question before it is asked.",
  },
  linkedin: {
    id: "content.linkedin",
    category: "content",
    title: "LinkedIn profile link",
    severity: "low",
    weight: 4,
    why: "Most recruiters check LinkedIn before calling. A visible link saves them a search and makes sure they find the right person.",
  },
  resumeAccent: {
    id: "content.resume-accent",
    category: "content",
    title: "Plain spelling of “resume”",
    severity: "low",
    weight: 3,
    why: "Accented characters are sometimes garbled by older systems and job-board imports (“RÃ©sumÃ©”), and recruiters search for the plain spelling.",
  },
  actionVerbs: {
    id: "content.action-verbs",
    category: "content",
    title: "Bullets start with an action verb",
    severity: "medium",
    weight: 8,
    why: "Recruiters read the first two or three words of a bullet. Starting with what you did (Built, Cut, Negotiated) makes your contribution clear at a glance.",
  },
  bulletLength: {
    id: "content.bullet-length",
    category: "content",
    title: "Bullets are easy to scan",
    severity: "low",
    weight: 4,
    why: "A bullet longer than about 30 words turns into a paragraph that gets skimmed, and a role with more than 8 bullets buries the best ones.",
  },
  summary: {
    id: "content.summary",
    category: "content",
    title: "Short professional summary",
    severity: "low",
    weight: 4,
    why: "A 2–4 sentence summary at the top tells a recruiter who you are and what you are aiming for before they reach your roles. Many parsers store it as its own field.",
  },
  skills: {
    id: "content.skills",
    category: "content",
    title: "Skills section",
    severity: "medium",
    weight: 6,
    why: "Recruiters filter candidates by skills, and most parsers fill the skills field from a section headed “Skills”. A clear list makes sure your tools and methods are found.",
  },
  length: {
    id: "content.length",
    category: "content",
    title: "One or two pages",
    severity: "medium",
    weight: 5,
    why: "One page suits early careers and two pages suit most experienced candidates. Recruiters rarely read a third page closely.",
  },
  location: {
    id: "content.location",
    category: "content",
    title: "Location on the CV",
    severity: "low",
    weight: 3,
    why: "Recruiters and ATS searches often filter by location. A city and region (or “Remote”) is enough; a full street address is not needed.",
  },
} satisfies Record<string, CheckDef>;

const NUMBER_RE = /\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|fifty|hundred|hundreds|thousand|thousands|million|millions|billion|dozens?|double[ds]?|doubling|tripled?|halved|percent)\b/i;

function ev(b: BulletRef): Evidence {
  return { text: truncate(b.text), where: b.where };
}
function rt(text: string, kind: RewriteTarget["kind"] = "bullet"): RewriteTarget {
  return { kind, text };
}

const MAX_ITEMS = 8;

export function contentChecks(ctx: CheckContext): Check[] {
  if (ctx.noText) {
    return Object.values(CONTENT_DEFS).map((def) =>
      build(def, { status: "fail", summary: NOT_EVALUATED, fix: "Fix the text layer first (see “Selectable text”)." }),
    );
  }
  const out: Check[] = [quantified(ctx), weakOpeners(ctx), padding(ctx), pronouns(ctx)];
  const g = gaps(ctx);
  if (g) out.push(g);
  out.push(linkedin(ctx), resumeAccent(ctx));
  out.push(actionVerbs(ctx), bulletLength(ctx), summaryCheck(ctx), skillsCheck(ctx));
  const len = lengthCheck(ctx);
  if (len) out.push(len);
  out.push(locationCheck(ctx));
  return out;
}

function quantified(ctx: CheckContext): Check {
  const bullets = ctx.build.bullets;
  const summary = ctx.build.profile.summary;
  const summaryTarget: RewriteTarget[] = summary && !NUMBER_RE.test(summary) ? [rt(summary, "summary")] : [];
  if (!bullets.length) {
    return build(CONTENT_DEFS.quantified, {
      status: "warn",
      summary: "We found no bullet points describing your work, so there are no results for a recruiter to scan.",
      fix: "Under each role, add 2–5 bullet points that state what you achieved, with a number where you can (amount, percentage, time saved, team size).",
      rewriteTargets: summaryTarget,
    });
  }
  const missing = bullets.filter((b) => !NUMBER_RE.test(b.text));
  const n = bullets.length;
  const q = n - missing.length;
  const ratio = q / n;
  const status = ratio >= 0.5 ? "pass" : ratio >= 0.25 ? "warn" : "fail";
  const text =
    missing.length === 0
      ? `All ${plural(n, "bullet point")} include a number.`
      : q === 0
        ? `None of your ${plural(n, "bullet point")} include${n === 1 ? "s" : ""} a number, so none shows a measurable result.`
        : `${q} of your ${plural(n, "bullet point")} include${q === 1 ? "s" : ""} a number. ${missing.length === 1 ? "The other one describes" : `The other ${missing.length} describe`} work without a measurable result.`;
  return build(CONTENT_DEFS.quantified, {
    status,
    summary: text,
    fix: "Add a figure to each bullet where you honestly can: how much, how many, how fast, or by what percentage. For example, “Cut month-end close from 9 to 5 days”.",
    evidence: status === "pass" ? undefined : missing.slice(0, MAX_ITEMS).map(ev),
    rewriteTargets: [...missing.slice(0, MAX_ITEMS).map((b) => rt(b.text)), ...summaryTarget],
  });
}

function openerOf(text: string): string | null {
  const t = text.toLowerCase().replace(/^[^\p{L}]+/u, "");
  for (const o of WEAK_OPENERS) if (t === o || t.startsWith(o + " ") || t.startsWith(o + ",")) return o;
  return null;
}

function weakOpeners(ctx: CheckContext): Check {
  const bullets = ctx.build.bullets;
  const hits = bullets.map((b) => ({ b, o: openerOf(b.text) })).filter((x) => x.o);
  if (!bullets.length) return build(CONTENT_DEFS.weakOpeners, { status: "pass", summary: "No bullet points to check for weak openers." });
  if (!hits.length) return build(CONTENT_DEFS.weakOpeners, { status: "pass", summary: "None of your bullet points open with duty phrases such as “Responsible for”." });
  const openers = [...new Set(hits.map((h) => h.o!))].map((o) => o.charAt(0).toUpperCase() + o.slice(1));
  const status = hits.length >= 3 || (hits.length >= 2 && hits.length / bullets.length >= 0.3) ? "fail" : "warn";
  return build(CONTENT_DEFS.weakOpeners, {
    status,
    summary: `${plural(hits.length, "bullet point")} open${hits.length === 1 ? "s" : ""} with ${quoteList(openers, 3)}. ${hits.length === 1 ? "It describes" : "These describe"} duties rather than what you achieved.`,
    fix: "Start each bullet with a past-tense verb that says what you did (Led, Built, Reduced, Negotiated, Launched), then the result.",
    evidence: hits.slice(0, MAX_ITEMS).map((h) => ev(h.b)),
    rewriteTargets: hits.slice(0, MAX_ITEMS).map((h) => rt(h.b.text)),
  });
}

function padding(ctx: CheckContext): Check {
  const bullets = ctx.build.bullets;
  if (bullets.length < 2) return build(CONTENT_DEFS.padding, { status: "pass", summary: "Not enough bullet points to judge repetition or padding." });
  const short = bullets.filter((b) => wordCount(b.text) < 5);
  const counts = new Map<string, BulletRef[]>();
  for (const b of bullets) {
    const first = b.text.replace(/^[^\p{L}]+/u, "").split(/\s+/)[0]?.toLowerCase().replace(/[^\p{L}-]/gu, "");
    if (!first || first.length < 3) continue;
    counts.set(first, [...(counts.get(first) ?? []), b]);
  }
  const repeated = [...counts.entries()]
    .filter(([, v]) => v.length >= 3 && v.length / bullets.length >= 0.2)
    .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1));
  const seen = new Map<string, number>();
  for (const b of bullets) seen.set(b.text.toLowerCase(), (seen.get(b.text.toLowerCase()) ?? 0) + 1);
  const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([t]) => t);

  if (!short.length && !repeated.length && !dupes.length) {
    return build(CONTENT_DEFS.padding, { status: "pass", summary: "Your bullet points are specific and vary their opening verbs." });
  }
  const parts: string[] = [];
  const evidence: Evidence[] = [];
  if (short.length) {
    parts.push(`${plural(short.length, "bullet point")} ${short.length === 1 ? "has" : "have"} fewer than five words.`);
    evidence.push(...short.slice(0, 5).map((b) => ({ text: truncate(b.text), where: `${b.where} · very short` })));
  }
  for (const [w, list] of repeated.slice(0, 2)) {
    const verb = list[0].text.replace(/^[^\p{L}]+/u, "").split(/\s+/)[0].replace(/[^\p{L}-]/gu, "");
    parts.push(`${list.length} bullets start with “${verb}”.`);
    evidence.push(...list.slice(0, 3).map((b) => ({ text: truncate(b.text), where: `${b.where} · repeated “${w}”` })));
  }
  if (dupes.length) parts.push(`${plural(dupes.length, "bullet point")} ${dupes.length === 1 ? "appears" : "appear"} more than once.`);
  // One evidence row per bullet, merging the reasons.
  const merged = new Map<string, Evidence>();
  for (const e of evidence) {
    const prev = merged.get(e.text);
    if (prev) prev.where = `${prev.where} · ${e.where?.split(" · ").pop()}`;
    else merged.set(e.text, { ...e });
  }
  evidence.splice(0, evidence.length, ...merged.values());
  const status = short.length >= 3 && short.length / bullets.length >= 0.3 ? "fail" : "warn";
  return build(CONTENT_DEFS.padding, {
    status,
    summary: parts.join(" "),
    fix: "Merge or expand very short bullets into one specific achievement each, and vary your opening verbs (Led, Built, Cut, Grew, Resolved).",
    evidence: evidence.slice(0, MAX_ITEMS),
    rewriteTargets: short.slice(0, MAX_ITEMS).map((b) => rt(b.text)),
  });
}

/** Words before a standalone "I" that make it a Roman numeral ("Level I", "Phase I"). */
const ROMAN_CONTEXT = /\b(level|phase|tier|grade|class|type|part|stage|step|year|unit|chapter|section|war|act|schedule|category|volume|book|title|series|model|generation|gen|division|band|engineer|analyst|technician|specialist|associate|developer|nurse|officer|programmer|support|clerk|accountant|manager|representative|agent|coordinator|assistant|administrator|consultant|scientist|designer|teacher|paralegal)\s*$/i;

function pronounHits(text: string): string[] {
  const hits: string[] = [];
  const re = /(?<![\p{L}\d/'’-])(I|me|my|mine|myself|we|our|ours|ourselves|us|My|We|Our|Me)(?![\p{L}\d]|\/|-\p{L}|-\d)/gu;
  for (const m of text.matchAll(re)) {
    const w = m[1];
    const idx = m.index ?? 0;
    const before = text.slice(Math.max(0, idx - 24), idx);
    const after = text.slice(idx + w.length, idx + w.length + 6);
    if (w === "I") {
      if (ROMAN_CONTEXT.test(before)) continue;
      if (/^\s*(?:&|and|or|,|-|–|\/)\s*I{1,3}V?\b/.test(after) || /^\s*I{1,3}\b/.test(after)) continue;
      if (/^\.\s/.test(after) && idx === 0) continue; // "I. Introduction" style numbering
    }
    hits.push(w);
  }
  // Lower-case "me"/"us" only: "ME" (Maine, Middle East) and "US" (United States) are not pronouns.
  return hits.filter((h) => !(h === "US" || h === "ME"));
}

function pronouns(ctx: CheckContext): Check {
  const items: { text: string; where: string; kind: RewriteTarget["kind"]; hits: string[] }[] = [];
  for (const pr of ctx.build.prose) {
    const h = pronounHits(pr.text);
    if (h.length) items.push({ text: pr.text, where: pr.where, kind: "summary", hits: h });
  }
  for (const b of ctx.build.bullets) {
    const h = pronounHits(b.text);
    if (h.length) items.push({ text: b.text, where: b.where, kind: "bullet", hits: h });
  }
  const total = items.reduce((n, i) => n + i.hits.length, 0);
  if (!total) return build(CONTENT_DEFS.pronouns, { status: "pass", summary: "Your summary and bullet points avoid first-person pronouns." });
  const words = [...new Set(items.flatMap((i) => i.hits.map((w) => w.toLowerCase() === "i" ? "I" : w.toLowerCase())))];
  return build(CONTENT_DEFS.pronouns, {
    status: total >= 3 ? "fail" : "warn",
    summary: `We found ${plural(total, "first-person pronoun")} (${quoteList(words, 5)}) in ${plural(items.length, items.length === 1 ? "place" : "place")}.`,
    fix: "Drop the pronouns and start with the verb: “I managed a team of 6” becomes “Managed a team of 6”.",
    evidence: items.slice(0, MAX_ITEMS).map((i) => ({ text: truncate(i.text), where: i.where })),
    rewriteTargets: items.slice(0, MAX_ITEMS).map((i) => rt(i.text, i.kind)),
  });
}

const GAP_EXPLAINED = /\b(career break|sabbatical|parental leave|maternity|paternity|family leave|caring for|carer for|caregiver|gap year|full-time study|travell?ing|relocat(?:ed|ion)|medical leave|redundan(?:t|cy))\b/i;

function fmtDate(d: ParsedDate): string {
  return d.text;
}

function gaps(ctx: CheckContext): Check | null {
  const roles = ctx.build.profile.experience
    .map((r) => {
      const range = r.dates ? findDateRanges(r.dates)[0] : undefined;
      if (!range) return null;
      return { r, range, start: monthIndex(range.start, "start"), end: range.present ? Infinity : range.end ? monthIndex(range.end, "end") : null };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.end !== null && x.end >= x.start);
  if (roles.length < 2) return null;
  const sorted = [...roles].sort((a, b) => a.start - b.start || (a.end as number) - (b.end as number));
  const found: { months: number; approx: boolean; text: string }[] = [];
  let latestEnd = sorted[0].end as number;
  let latest = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const gap = cur.start - latestEnd - 1;
    if (gap > 6 && Number.isFinite(latestEnd)) {
      const approx = cur.range.start.month === null || latest.range.end?.month === null;
      const label = (x: typeof cur) => [x.r.title, x.r.company].filter(Boolean).join(", ") || x.range.text;
      found.push({
        months: gap,
        approx,
        text: `${approx ? "At least " : ""}${gap} months between “${label(latest)}” (ended ${latest.range.end ? fmtDate(latest.range.end) : "?"}) and “${label(cur)}” (started ${fmtDate(cur.range.start)})`,
      });
    }
    if ((cur.end as number) > latestEnd) {
      latestEnd = cur.end as number;
      latest = cur;
    }
  }
  if (!found.length) return build(CONTENT_DEFS.gaps, { status: "pass", summary: "Your roles follow on from each other without gaps longer than six months." });
  if (GAP_EXPLAINED.test(ctx.doc.rawText)) {
    return build(CONTENT_DEFS.gaps, {
      status: "pass",
      summary: `There ${found.length === 1 ? "is a gap" : `are ${found.length} gaps`} of more than six months between roles, and your CV mentions a reason for time away.`,
      evidence: found.map((f) => ({ text: f.text })),
    });
  }
  const longest = Math.max(...found.map((f) => f.months));
  return build(CONTENT_DEFS.gaps, {
    status: "warn",
    summary:
      found.length === 1
        ? found[0].approx
          ? `There is a gap of at least ${longest} months between two of your roles that the CV does not explain.`
          : `There is a ${longest}-month gap between two of your roles that the CV does not explain.`
        : `There are ${found.length} gaps of more than six months between roles (the longest is ${longest} months) that the CV does not explain.`,
    fix: "Add a one-line entry for each gap, for example “Career break: caring for a family member” or “Sabbatical: travel and study”, or list freelance work or courses from that time.",
    evidence: found.map((f) => ({ text: f.text })),
  });
}

function linkedin(ctx: CheckContext): Check {
  const p = ctx.build.profile;
  if (p.linkedin) return build(CONTENT_DEFS.linkedin, { status: "pass", summary: `We found your LinkedIn profile: ${p.linkedin}.` });
  const hidden = ctx.doc.hidden.find((h) => /linkedin\.com/i.test(h.text));
  const mentions = /linkedin/i.test(ctx.doc.rawText);
  return build(CONTENT_DEFS.linkedin, {
    status: "warn",
    summary: hidden
      ? `Your LinkedIn link is in ${hidden.where === "text box" ? "a text box" : `the page ${hidden.where}`}, which most parsers do not read.`
      : mentions
        ? "You mention LinkedIn, but there is no profile URL a recruiter can follow."
        : "We found no LinkedIn profile URL.",
    fix: "Add your LinkedIn URL (linkedin.com/in/your-name) to the contact line under your name. You can shorten it in LinkedIn’s profile settings.",
  });
}

function resumeAccent(ctx: CheckContext): Check {
  const m = ctx.doc.rawText.match(/[^\n]*(?<!\p{L})(r[ée]sum[ée])(?!\p{L})[^\n]*/iu);
  const accented = m && /[éÉ]/.test(m[1]) ? m : null;
  if (!accented) return build(CONTENT_DEFS.resumeAccent, { status: "pass", summary: "Your CV does not use an accented spelling of “résumé”." });
  return build(CONTENT_DEFS.resumeAccent, {
    status: "warn",
    summary: `Your CV uses the spelling “${accented[1]}”.`,
    fix: "Write “resume” without accents, or drop the word: a CV does not need a title, your name is the heading.",
    evidence: [{ text: truncate(accented[0]) }],
  });
}

/* ---------------- added from docs/research/ats-criteria.md ---------------- */

function actionVerbs(ctx: CheckContext): Check {
  // Bullets with a duty opener ("Responsible for") are already covered by content.weak-openers.
  const bullets = ctx.build.bullets.filter((b) => !openerOf(b.text));
  if (bullets.length < 3) return build(CONTENT_DEFS.actionVerbs, { status: "pass", summary: "Not enough bullet points to judge how they open." });
  const off = bullets.filter((b) => !isActionVerb(firstWord(b.text)));
  const ratio = (bullets.length - off.length) / bullets.length;
  const status = ratio >= 0.7 ? "pass" : ratio >= 0.4 ? "warn" : "fail";
  if (!off.length) return build(CONTENT_DEFS.actionVerbs, { status, summary: `All ${plural(bullets.length, "bullet point")} start with an action verb.` });
  const openers = [...new Set(off.map((b) => firstWord(b.text)).filter(Boolean))];
  return build(CONTENT_DEFS.actionVerbs, {
    status,
    summary: `${bullets.length - off.length} of ${plural(bullets.length, "bullet point")} start with an action verb. ${off.length === 1 ? "One starts" : `${off.length} start`} with ${quoteList(openers, 3)} instead.`,
    fix: "Rewrite those bullets to open with the verb for what you did, then the result: “Customer onboarding for 40 accounts” becomes “Onboarded 40 customer accounts…”.",
    evidence: status === "pass" ? off.slice(0, 3).map(ev) : off.slice(0, MAX_ITEMS).map(ev),
    rewriteTargets: off.slice(0, MAX_ITEMS).map((b) => rt(b.text)),
  });
}

const LONG_BULLET_WORDS = 30;
const MAX_BULLETS_PER_ROLE = 8;

function bulletLength(ctx: CheckContext): Check {
  const bullets = ctx.build.bullets;
  if (!bullets.length) return build(CONTENT_DEFS.bulletLength, { status: "pass", summary: "No bullet points to check for length." });
  const long = bullets.filter((b) => wordCount(b.text) > LONG_BULLET_WORDS);
  const crowded = ctx.build.profile.experience.filter((r) => r.bullets.length > MAX_BULLETS_PER_ROLE);
  const share = long.length / bullets.length;
  const status = share > 0.3 ? "fail" : share > 0.1 || crowded.length ? "warn" : "pass";
  if (status === "pass" && !long.length) return build(CONTENT_DEFS.bulletLength, { status, summary: `All ${plural(bullets.length, "bullet point")} are ${LONG_BULLET_WORDS} words or fewer.` });
  const parts: string[] = [];
  if (long.length) parts.push(`${plural(long.length, "bullet point")} of ${bullets.length} ${long.length === 1 ? "runs" : "run"} past ${LONG_BULLET_WORDS} words.`);
  if (crowded.length)
    parts.push(`${crowded.length === 1 ? "One role has" : `${crowded.length} roles have`} more than ${MAX_BULLETS_PER_ROLE} bullets (${quoteList(crowded.map((r) => `${[r.title, r.company].filter(Boolean).join(", ") || "untitled role"}: ${r.bullets.length}`), 2)}).`);
  return build(CONTENT_DEFS.bulletLength, {
    status,
    summary: parts.join(" "),
    fix: `Keep each bullet to one achievement in ${LONG_BULLET_WORDS} words or fewer (split long ones in two), and keep the strongest 3–6 bullets per role.`,
    evidence: long.slice(0, MAX_ITEMS).map((b) => ({ text: truncate(b.text), where: `${b.where} · ${wordCount(b.text)} words` })),
    rewriteTargets: long.slice(0, MAX_ITEMS).map((b) => rt(b.text)),
  });
}

/** The research suggests 25–120 words; a single strong sentence of 15+ words is accepted too. */
const SUMMARY_MIN_WORDS = 15;
const SUMMARY_MAX_WORDS = 120;

function summaryCheck(ctx: CheckContext): Check {
  const summary = ctx.build.profile.summary;
  if (!summary) {
    return build(CONTENT_DEFS.summary, {
      status: "warn",
      summary: "We found no summary or profile paragraph at the top of your CV.",
      fix: "Add 2–4 sentences under your name headed “Summary”: your role and years of experience, your strongest skills, and one result you are proud of.",
    });
  }
  const words = wordCount(summary);
  if (words >= SUMMARY_MIN_WORDS && words <= SUMMARY_MAX_WORDS) return build(CONTENT_DEFS.summary, { status: "pass", summary: `Your summary is ${words} words, a comfortable length to read at a glance.` });
  const short = words < SUMMARY_MIN_WORDS;
  return build(CONTENT_DEFS.summary, {
    status: "warn",
    summary: short ? `Your summary is only ${plural(words, "word")}, too short to say what you offer.` : `Your summary is ${words} words, longer than a recruiter will read at the top of a CV.`,
    fix: short
      ? "Expand it to 2–4 sentences: your role and experience, your strongest skills, and one concrete result."
      : "Cut it to 2–4 sentences (under about 120 words). Move detail into your role bullets.",
    evidence: [{ text: truncate(summary), where: "Summary" }],
    rewriteTargets: [rt(summary, "summary")],
  });
}

function skillsCheck(ctx: CheckContext): Check {
  const p = ctx.build.profile;
  const has = ctx.build.sections.some((s) => s.kind === "skills");
  const n = p.skills.length;
  if (!has) {
    return build(CONTENT_DEFS.skills, {
      status: "fail",
      summary: "We found no section headed “Skills”, so a parser has no skills list to store.",
      fix: "Add a section headed “Skills” with 6–20 specific tools, methods and qualifications, separated by commas, for example “Excel, SQL, Power BI, IFRS, Budgeting”.",
    });
  }
  if (n >= 6 && n <= 40) return build(CONTENT_DEFS.skills, { status: "pass", summary: `Your Skills section lists ${n} items.` });
  return build(CONTENT_DEFS.skills, {
    status: "warn",
    summary: n === 0 ? "Your Skills section has no items we could read." : n < 6 ? `Your Skills section lists only ${plural(n, "item")}.` : `Your Skills section lists ${n} items, which reads as a keyword dump.`,
    fix:
      n > 40
        ? "Trim the list to the 15–30 skills most relevant to the roles you want, and group them (Tools, Languages, Methods)."
        : "List 6–20 specific skills as plain text separated by commas: tools, software, methods and certifications you actually use.",
    evidence: n ? [{ text: truncate(p.skills.join(", ")), where: "Skills" }] : undefined,
  });
}

/** Months of experience from the earliest role start to the latest role end ("present" = latest date in the CV, no clock). */
function experienceMonths(ctx: CheckContext): number | null {
  const latestMentioned = ctx.build.ranges.reduce((m, r) => Math.max(m, monthIndex(r.start, "start"), r.end ? monthIndex(r.end, "end") : 0), 0);
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of ctx.build.profile.experience) {
    const range = r.dates ? findDateRanges(r.dates)[0] : undefined;
    if (!range) continue;
    lo = Math.min(lo, monthIndex(range.start, "start"));
    hi = Math.max(hi, range.present ? latestMentioned : range.end ? monthIndex(range.end, "end") : -Infinity);
  }
  return Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo ? hi - lo + 1 : null;
}

function lengthCheck(ctx: CheckContext): Check | null {
  const pages = ctx.doc.pageCount;
  if (!pages) return null; // DOCX without a saved page count: not measurable.
  const months = experienceMonths(ctx);
  if (pages === 1) return build(CONTENT_DEFS.length, { status: "pass", summary: "Your CV is one page." });
  if (pages === 2) {
    if (months !== null && months < 24)
      return build(CONTENT_DEFS.length, {
        status: "warn",
        summary: `Your CV is two pages, but your roles cover about ${plural(Math.max(1, Math.round(months / 12)), "year")}.`,
        fix: "With under two years of experience, one page is usually enough. Cut older or less relevant detail until it fits.",
      });
    return build(CONTENT_DEFS.length, { status: "pass", summary: "Your CV is two pages." });
  }
  return build(CONTENT_DEFS.length, {
    status: pages >= 4 ? "fail" : "warn",
    summary: `Your CV is ${pages} pages.`,
    fix: "Bring it down to two pages: keep full detail for the last 10–15 years, shorten older roles to one line each, and drop duties that do not show results.",
  });
}

const STREET_RE = /\b\d{1,5}\s+(?:[\p{L}.'’-]+\s+){0,4}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|terrace|crescent|close)\b\.?/iu;

function locationCheck(ctx: CheckContext): Check {
  const p = ctx.build.profile;
  const top = ctx.build.preamble.slice(0, 10).map((l) => l.text).join("\n");
  const street = top.match(STREET_RE);
  if (street) {
    return build(CONTENT_DEFS.location, {
      status: "warn",
      summary: "Your CV includes a full street address.",
      fix: "Replace the street address with just your city and region (for example “Leeds, UK”). It is all recruiters need and keeps your home address private.",
      evidence: [{ text: truncate(street[0]), where: "Contact details" }],
    });
  }
  if (p.location) return build(CONTENT_DEFS.location, { status: "pass", summary: `We found your location: ${p.location}.` });
  return build(CONTENT_DEFS.location, {
    status: "warn",
    summary: "We found no city or region in your contact details.",
    fix: "Add your city and region or country to the contact line under your name, for example “Austin, TX” or “Remote, UK”.",
  });
}
