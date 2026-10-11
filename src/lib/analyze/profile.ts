// Turn reading-order lines into an ExtractedProfile.
//
// This works on exactly the text a parser saw (see the PDF/DOCX parsers),
// so a two-column PDF produces interleaved, partly garbled sections here too.
// That is intentional: the profile is the "what the parser understood" view.
// When a field is ambiguous we leave it null rather than guess.
import type { ExtractedEducation, ExtractedProfile, ExtractedRole, ExtractedSection, SectionKind } from "@/lib/types";
import type { Line } from "./internal";
import { CREATIVE_HEADING, lookupHeading } from "./headings";
import { findDateRanges, normaliseDate, type DateRange } from "./dates";
import {
  EMAIL_RE,
  LINKEDIN_RE,
  collapse,
  findLinks,
  findPhone,
  isAllCaps,
  stripBullet,
  titleCaseName,
  wordCount,
} from "./text";

/* ---------------- vocabularies ---------------- */

export const TITLE_WORDS =
  /\b(engineer(?:ing)?|developer|programmer|manager|director|analyst|designer|consultant|specialist|coordinator|associate|assistant|administrator|officer|lead|head|intern|trainee|apprentice|representative|executive|accountant|auditor|nurse|teacher|lecturer|professor|researcher|scientist|architect|technician|supervisor|operative|cashier|clerk|agent|advisor|adviser|planner|writer|editor|producer|president|vp|founder|co-founder|owner|partner|chef|driver|pharmacist|physician|doctor|therapist|attorney|lawyer|paralegal|strategist|marketer|recruiter|generalist|controller|buyer|merchandiser|receptionist|secretary|tutor|instructor|fellow|worker|operator|mechanic|electrician|cto|ceo|cfo|coo|cio|sre|devops|product owner|scrum master|salesperson|sales|marketing|support|volunteer|leader|principal|staff|senior|junior|graduate|student|surgeon|dentist|paramedic|midwife|carer|caregiver|counsel(?:l)?or|psychologist|economist|statistician|actuary|underwriter|banker|trader|broker|cook|barista|server|waiter|waitress|bartender|housekeeper|janitor|guard|pilot|inspector|surveyor|estimator|foreman|journalist|reporter|photographer|animator|illustrator|copywriter|translator|interpreter|librarian|curator|coach|trainer)s?\b/i;

/** Words that only qualify a title ("Senior", "Sales"); weaker evidence than a head noun like "Engineer". */
const TITLE_MODIFIERS = /^(lead|head|principal|staff|senior|junior|graduate|student|sales|marketing|support|volunteer|devops)$/i;

/** Legal-entity suffixes: the strongest evidence that a part is an organisation. */
const LEGAL_SUFFIX = /\b(inc|llc|ltd|limited|plc|corp|corporation|gmbh|ag|s\.?p\.?a|s\.?a|sarl|bv|nv|pvt|pty|llp|lp|co)\b\.?$|\b(university|hospital|bank|college|school|institute|council|ministry|nhs|authority)\b/i;

/** Evidence score that a header part is a job title (2 = head noun, 1 = modifier only). */
function titleScore(s: string): number {
  const m = s.match(new RegExp(TITLE_WORDS.source, "gi"));
  if (!m) return 0;
  return m.some((w) => !TITLE_MODIFIERS.test(w.replace(/s$/i, ""))) ? 2 : 1;
}

/** Evidence score that a header part is an organisation (3 = legal suffix/institution, 1 = industry word). */
function companyScore(s: string): number {
  if (LEGAL_SUFFIX.test(s)) return 3;
  return COMPANY_WORDS.test(s) ? 1 : 0;
}

const COMPANY_WORDS =
  /\b(inc|llc|ltd|limited|plc|corp|corporation|company|co|gmbh|ag|s\.?p\.?a|spa|s\.?a|sarl|bv|nv|pvt|pty|llp|lp|group|holdings|bank|university|college|hospital|clinic|health|healthcare|centre|center|school|technologies|technology|tech|solutions|systems|software|labs?|studio|studios|agency|partners|consulting|consultants|services|networks?|foundation|institute|council|ministry|hotels?|resorts?|logistics|payments|media|digital|cloud|insurance|financial|finance|capital|bank|airlines?|motors|pharma(?:ceuticals)?|telecom|communications|industries|international|global|enterprises|ventures|retail|foods?|consumer goods|outfitters|grocery|stores?|freight|distribution|automation|mobility|commerce|credit union|union|ngo|trust|nhs|council|authority|department of|government)\b\.?/i;

const COMPANY_SUFFIX_ONLY = /^(inc|llc|ltd|limited|plc|corp|co|gmbh|ag|s\.?p\.?a|s\.?a|pvt\.? ltd|pty\.? ltd|llp|lp)\.?$/i;

const REGION_CODES = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC ON QC BC AB MB SK NS NB NL PE NSW VIC QLD WA SA TAS ACT NT UK UAE USA US".split(
    " ",
  ),
);
const COUNTRIES =
  /^(united kingdom|united states|usa|uk|england|scotland|wales|ireland|canada|australia|new zealand|india|pakistan|bangladesh|sri lanka|nepal|uae|united arab emirates|saudi arabia|qatar|kuwait|bahrain|oman|egypt|nigeria|ghana|kenya|south africa|germany|france|spain|portugal|italy|netherlands|belgium|switzerland|austria|poland|sweden|norway|denmark|finland|singapore|malaysia|indonesia|philippines|vietnam|thailand|japan|china|hong kong|south korea|brazil|mexico|argentina|chile|colombia|peru|turkey|israel|jordan|lebanon|morocco|tunisia|ethiopia|tanzania|uganda|rwanda|zimbabwe|czech republic|czechia|slovakia|hungary|romania|bulgaria|greece|croatia|serbia|ukraine|estonia|latvia|lithuania|luxembourg|iceland|cyprus|malta)$/i;

const LOCATION_WORD = /^(remote|hybrid|on-?site|remote \(.*\)|.* \(remote\))$/i;

const DEGREE_RE =
  /\b(bachelor'?s?|master'?s?|b\.?\s?sc|m\.?\s?sc|b\.\s?a\.|m\.\s?a\.|\bba\b|\bma\b|b\.\s?s\.|m\.\s?s\.|\bbs\b|\bms\b|mba|m\.b\.a|ph\.?\s?d|doctor(?:ate)?|diploma|associate'?s? degree|associate of|b\.?\s?eng|m\.?\s?eng|b\.?\s?tech|m\.?\s?tech|b\.\s?e\.|\bbe\b(?= in| \()|bba|b\.b\.a|bcom|b\.com|llb|ll\.?m|\bmd\b|a-levels?|gcse|igcse|high school|secondary school|certificate|laurea|diplom|grado|licenciatura|hnd|btec|degree|honours|honors|b\.?arch|m\.?arch|b\.?ed|m\.?ed|pgce|bsn|msn|dnp|jd|j\.d\.)(?![\p{L}])/iu;

const INSTITUTION_RE =
  /\b(universit(?:y|ies|ät|at|é|à|e|a|ario|eit)|universidad|universidade|uniwersytet|college|school|institute|institut|academy|polytechnic|politecnico|polytechnique|hochschule|conservatory|seminary|lums|iit|nust|fast|campus|faculty)\b/i;

const LOC_PAIR = /^([\p{Lu}][\p{L}.'’-]*(?:\s+[\p{Lu}][\p{L}.'’-]*){0,2}),\s*([\p{Lu}][\p{L}.'’-]*(?:\s+[\p{Lu}][\p{L}.'’-]*){0,2})$/u;

function isLocation(s: string): boolean {
  const t = s.trim().replace(/[()]/g, "");
  if (!t || /\d|@/.test(t)) return false;
  if (LOCATION_WORD.test(t) || COUNTRIES.test(t)) return true;
  const m = t.match(LOC_PAIR);
  if (!m) return false;
  if (TITLE_WORDS.test(t) || COMPANY_WORDS.test(t) || INSTITUTION_RE.test(t) || DEGREE_RE.test(t)) return false;
  return REGION_CODES.has(m[2].toUpperCase()) || COUNTRIES.test(m[2]);
}

/* ---------------- splitting helpers ---------------- */

const STRONG_SEP = /\s{3,}|\s*[|•·▪◦]\s*|\s+[–—-]\s+|\s+@\s+/u;

/** Split a header line into meaningful parts; commas split too, but "City, ST" stays together. */
export function splitParts(text: string): string[] {
  const out: string[] = [];
  const pieces0: string[] = [];
  for (const piece of text.split(STRONG_SEP)) {
    // "Engineer at Acme" splits, but "University of Texas at San Antonio" does not.
    const at = piece.match(/^(.+?)\s+at\s+(\p{Lu}.*)$/u);
    if (at && titleScore(at[1]) > 0 && !INSTITUTION_RE.test(piece) && companyScore(at[1]) < 3) pieces0.push(at[1], at[2]);
    else pieces0.push(piece);
  }
  for (const strong of pieces0) {
    const s = strong.replace(/^[\s,;:()\-–—]+|[\s,;:(\-–—]+$/g, "").replace(/^\((.*)\)$/, "$1").trim();
    if (!s) continue;
    if (isLocation(s) || !s.includes(",")) {
      out.push(s);
      continue;
    }
    const pieces = splitTopLevel(s, /,/).map((x) => x.trim()).filter(Boolean);
    const merged: string[] = [];
    for (const p of pieces) {
      const prev = merged[merged.length - 1];
      if (prev && COMPANY_SUFFIX_ONLY.test(p)) merged[merged.length - 1] = `${prev}, ${p}`;
      else if (prev && (REGION_CODES.has(p.toUpperCase()) || COUNTRIES.test(p)) && !COMPANY_WORDS.test(prev) && !TITLE_WORDS.test(prev) && wordCount(prev) <= 3)
        merged[merged.length - 1] = `${prev}, ${p}`;
      else merged.push(p);
    }
    out.push(...merged);
  }
  return out.filter((p) => /\p{L}/u.test(p));
}

/** Split on a separator, ignoring separators inside parentheses. */
export function splitTopLevel(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    else if ((ch === ")" || ch === "]") && depth > 0) depth--;
    if (depth === 0 && sep.test(ch)) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function removeRange(text: string, r: DateRange): string {
  return text.replace(r.text, " ").replace(/\(\s*\)/g, " ");
}

/* ---------------- headings ---------------- */

interface HeadingHit {
  kind: SectionKind | null;
  heading: string;
  inline: string | null;
}

function classifyHeading(line: Line, i: number, skip: Set<number>): HeadingHit | null {
  if (line.bullet || skip.has(i)) return null;
  const t = line.text.trim();
  if (line.segments.length === 1 || line.styledHeading) {
    const k = lookupHeading(t);
    if (k) return { kind: k, heading: cleanHeading(t), inline: null };
  }
  // "Skills: Python, SQL" — a known heading with content on the same line.
  const inline = line.segments[0].match(/^([^:]{3,40}):\s*(.+)$/);
  if (inline) {
    const k = lookupHeading(inline[1]);
    if (k) {
      const rest = [inline[2], ...line.segments.slice(1)].join("   ");
      return { kind: k, heading: cleanHeading(inline[1]), inline: rest };
    }
  }
  if (line.segments.length > 1) return null;

  // Heading-like lines that are not in the dictionary ("My Journey").
  const wc = wordCount(t);
  if (wc < 1 || wc > 6 || t.length > 48) return null;
  if (/\d|@|https?:|www\./i.test(t) || /[.;,]$/.test(t)) return null;
  if (findDateRanges(t).length) return null;
  const creative = CREATIVE_HEADING.test(t);
  const big = line.relSize !== null && line.relSize >= 1.15;
  const caps = isAllCaps(t) && wc <= 4 && (line.bold || big || line.styledHeading) && !COMPANY_WORDS.test(t);
  if (creative || line.styledHeading || big || caps) return { kind: null, heading: cleanHeading(t), inline: null };
  return null;
}

function cleanHeading(t: string): string {
  return collapse(t.replace(/[:\s]+$/, ""));
}

/* ---------------- name / contact ---------------- */

const NAME_PARTICLES = /^(de|da|del|della|di|du|van|von|der|den|al|el|bin|binti|ibn|la|le|dos|das|y|e|st\.?)$/i;

function nameFrom(s: string): string | null {
  const t = s
    .replace(/^(name|full name)\s*:\s*/i, "")
    .split(/\s*[|•·,]\s*|\s{3,}/)[0]
    .trim();
  if (!t || /\d|@|\/|:/.test(t)) return null;
  if (/\b(resume|résumé|resumé|curriculum|vitae|cv)\b/i.test(t)) return null;
  const w = t.split(/\s+/);
  const core = w.filter((x) => !NAME_PARTICLES.test(x));
  if (core.length < 2 || core.length > 4 || w.length > 5) return null;
  if (!core.every((x) => /^[\p{Lu}][\p{L}'’.-]*$/u.test(x) || /^[\p{Lu}]\.?$/u.test(x))) return null;
  if (TITLE_WORDS.test(t) || COMPANY_WORDS.test(t) || lookupHeading(t) || CREATIVE_HEADING.test(t) || isLocation(t)) return null;
  return titleCaseName(t);
}

function nameInLine(l: Line): string | null {
  for (const seg of l.segments) {
    const c = nameFrom(seg);
    if (c) return c;
  }
  return l.segments.length > 1 ? null : nameFrom(l.text);
}

/* ---------------- roles ---------------- */

interface Entry {
  header: Line[];
  bullets: string[];
}

function isContinuation(l: Line, prev: Line, prevText: string): boolean {
  const text = l.text.trim();
  if (/^[\p{Ll}(&,]/u.test(text)) return true;
  if (l.indent === null || prev.indent === null) return false;
  const sameIndent = Math.abs(l.indent - prev.indent) <= 2.5;
  if (!sameIndent) return false;
  if (prev.bullet) return l.indent > 3;
  // Wrapped description paragraph: previous line was long and did not end a sentence.
  return (prev.fillsWidth ?? wordCount(prevText) >= 10) && !/[.!?:]$/.test(prevText.trim());
}

function parseEntries(lines: Line[]): Entry[] {
  const entries: Entry[] = [];
  let cur: Entry | null = null;
  let prevContent: Line | null = null;
  const hasRange = (l: Line) => findDateRanges(l.text).length > 0;
  for (const l of lines) {
    const text = l.text.trim();
    if (!text) continue;
    const ranged = hasRange(l);
    if (l.bullet) {
      if (!cur) {
        cur = { header: [], bullets: [] };
        entries.push(cur);
      }
      cur.bullets.push(stripBullet(text));
      prevContent = l;
      continue;
    }
    if (prevContent && cur && cur.bullets.length && !ranged && isContinuation(l, prevContent, cur.bullets[cur.bullets.length - 1])) {
      cur.bullets[cur.bullets.length - 1] += " " + text;
      prevContent = { ...l, bullet: prevContent.bullet, indent: prevContent.indent };
      continue;
    }
    if (cur && cur.header.length && !ranged && wordCount(text) >= 12) {
      cur.bullets.push(text);
      prevContent = l;
      continue;
    }
    prevContent = null;
    const curDated = cur ? cur.header.findIndex(hasRange) : -1;
    if (!cur || cur.bullets.length > 0 || (ranged && curDated >= 0)) {
      const next: Entry = { header: [], bullets: [] };
      // "Title / Company | dates" blocks without bullets: undated lines after the
      // previous entry's date line belong to this entry (unless that entry led with its date line).
      if (cur && cur.bullets.length === 0 && ranged && curDated > 0) {
        next.header.push(...cur.header.splice(curDated + 1));
      }
      cur = next;
      entries.push(cur);
    }
    cur.header.push(l);
  }
  return entries.filter((e) => e.header.length > 0 || e.bullets.length > 0);
}

function roleFromEntry(e: Entry): ExtractedRole | null {
  let range: DateRange | null = null;
  const parts: string[] = [];
  for (const h of e.header) {
    let t = h.text;
    const rs = findDateRanges(t);
    if (rs.length && !range) {
      range = rs[0];
      t = removeRange(t, rs[0]);
    } else if (rs.length) t = removeRange(t, rs[0]);
    parts.push(...splitParts(t));
  }
  const p = parts.filter((x) => wordCount(x) <= 12);
  if (!range && !p.length && !e.bullets.length) return null;

  // Title-word evidence (Engineer, Manager, Volunteer…) outweighs industry words (Software, Media, Food);
  // only a legal suffix or institution word (Ltd, GmbH, University) outweighs a title word.
  const cls = p.map((x) => {
    const t = titleScore(x);
    const c = companyScore(x);
    return { text: x, title: t > c, company: c > t, loc: isLocation(x) };
  });
  // A short part right after a company-looking part is usually its location ("Gulf Crest Hotels, Dubai").
  for (let i = 1; i < cls.length; i++) {
    const c = cls[i];
    if (!c.title && !c.company && !c.loc && cls[i - 1].company && wordCount(c.text) <= 3 && /^\p{Lu}/u.test(c.text)) c.loc = true;
  }
  const usable = cls.filter((c) => !c.loc);
  let titleIdx = usable.findIndex((c) => c.title);
  let companyIdx = usable.findIndex((c, i) => c.company && i !== titleIdx);
  if (titleIdx < 0 && companyIdx < 0) {
    titleIdx = usable.length ? 0 : -1;
    companyIdx = usable.length > 1 ? 1 : -1;
  } else if (titleIdx < 0) {
    titleIdx = usable.findIndex((_, i) => i !== companyIdx);
  } else if (companyIdx < 0) {
    companyIdx = usable.findIndex((_, i) => i !== titleIdx);
  }
  let title = titleIdx >= 0 ? usable[titleIdx].text : null;
  // Unclassified parts between title and company extend the title ("Registered Nurse, Emergency Department").
  if (titleIdx >= 0 && companyIdx > titleIdx + 1) {
    const between = usable.slice(titleIdx + 1, companyIdx).filter((c) => !c.title && !c.company);
    if (between.length === companyIdx - titleIdx - 1) title = [title, ...between.map((c) => c.text)].join(", ");
  }
  const company = companyIdx >= 0 ? usable[companyIdx].text : null;
  const location = cls.find((c) => c.loc)?.text ?? null;
  return {
    title,
    company,
    location,
    dates: range ? range.text : null,
    start: range ? normaliseDate(range.start) : null,
    end: range ? normaliseDate(range.end, range.present) : null,
    bullets: e.bullets.map(collapse),
  };
}

/* ---------------- education ---------------- */

function parseEducation(lines: Line[]): ExtractedEducation[] {
  const out: ExtractedEducation[] = [];
  let cur: ExtractedEducation | null = null;
  const start = () => {
    cur = { institution: null, degree: null, dates: null, details: [] };
    out.push(cur);
    return cur;
  };
  for (const l of lines) {
    const raw = l.text.trim();
    if (!raw) continue;
    if (l.bullet) {
      (cur ?? start()).details.push(stripBullet(raw));
      continue;
    }
    const ranges = findDateRanges(raw);
    let text = raw;
    let dates: string | null = null;
    if (ranges.length) {
      dates = ranges[0].text;
      text = removeRange(text, ranges[0]);
    } else {
      const y = raw.match(/(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(?:19[5-9]\d|20[0-4]\d)(?!\d)/i);
      if (y && !/\d\.\d|gpa|cgpa/i.test(raw)) {
        dates = y[0];
        text = text.replace(y[0], " ");
      }
    }
    const parts = splitParts(text);
    let institution: string | null = null;
    let degree: string | null = null;
    const leftovers: string[] = [];
    for (const part of parts) {
      const isInst = INSTITUTION_RE.test(part) && !/\b(diploma|degree|bachelor|master|certificate|honours|honors)\b/i.test(part);
      if (isInst && !institution) institution = part;
      else if (DEGREE_RE.test(part) && !degree) degree = part;
      else if (degree && !institution && leftovers.length === 0 && !isLocation(part) && wordCount(part) <= 5) degree = `${degree}, ${part}`;
      else leftovers.push(part);
    }
    const c = cur as ExtractedEducation | null;
    const clash = c && ((institution && c.institution) || (degree && c.degree) || (dates && c.dates && !institution && !degree));
    if (!institution && !degree && !dates) {
      if (c) c.details.push(collapse(raw));
      else if (wordCount(raw) <= 12) {
        const e = start();
        e.institution = collapse(raw);
      }
      continue;
    }
    const e: ExtractedEducation = !c || clash ? start() : c;
    if (institution) e.institution = institution;
    if (degree) e.degree = degree;
    if (dates && !e.dates) e.dates = dates;
    for (const x of leftovers) {
      // "PES University, Bengaluru": a bare place name after the institution is not a detail.
      if (isLocation(x) || (institution && wordCount(x) <= 2 && /^\p{Lu}[\p{L}.'’-]*(?:\s\p{Lu}[\p{L}.'’-]*)?$/u.test(x))) continue;
      e.details.push(x);
    }
  }
  return out.filter((e) => e.institution || e.degree);
}

/* ---------------- skills / certifications ---------------- */

/** Re-join list lines that a PDF wrapped onto the next line before splitting them into items. */
function joinWrapped(lines: Line[]): Line[] {
  const out: Line[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    const t = l.text.trim();
    const wrapped =
      prev &&
      !l.bullet &&
      l.segments.length === 1 &&
      !/^[^:]{2,40}:/.test(t) &&
      (/[,;|]$/.test(prev.text.trim()) || (prev.fillsWidth === true && !/[.:]$/.test(prev.text.trim()) && /[,;|•·]/.test(prev.text)));
    if (wrapped) {
      const sep = /[,;|]$/.test(prev.text.trim()) ? " " : " ";
      out[out.length - 1] = { ...prev, text: prev.text.trimEnd() + sep + t, segments: [...prev.segments.slice(0, -1), prev.segments[prev.segments.length - 1] + sep + t], fillsWidth: l.fillsWidth };
    } else out.push(l);
  }
  return out;
}

function parseSkills(lines: Line[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const l of joinWrapped(lines)) {
    let t = stripBullet(l.text);
    for (let seg of t.split(/\s{3,}/)) {
      seg = seg.trim();
      const label = seg.match(/^([^:]{2,40}):\s*(.*)$/);
      if (label && wordCount(label[1]) <= 4) seg = label[2];
      for (const raw of splitTopLevel(seg, /[,;|•·▪●]/)) {
        const s = raw
          .replace(/^\s*(and|&)\s+/i, "")
          .replace(/[.\s]+$/, "")
          .trim();
        if (!s || !/\p{L}/u.test(s)) continue;
        const wc = wordCount(s);
        if (wc > 6 || s.length > 50) continue;
        const k = s.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(s);
      }
    }
    t = "";
  }
  return out;
}

function parseCertifications(lines: Line[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    const t = collapse(stripBullet(l.text).replace(/\s{3,}/g, " "));
    if (!t || wordCount(t) > 25) continue;
    if (!l.bullet && out.length && /^[\p{Ll}(]/u.test(t)) {
      out[out.length - 1] += " " + t;
      continue;
    }
    out.push(t);
  }
  return out;
}

/* ---------------- main ---------------- */

export interface InternalSection {
  heading: string;
  kind: SectionKind | null;
  lines: Line[];
  /** Index of the heading line in the document's lines. */
  lineIndex: number;
}

export interface BulletRef {
  text: string;
  where: string;
}

export interface ProfileBuild {
  profile: ExtractedProfile;
  sections: InternalSection[];
  /** Lines before the first heading (name, contact, intro). */
  preamble: Line[];
  /** Achievement bullets from experience, projects and unrecognised sections. */
  bullets: BulletRef[];
  /** Paragraph text written by the user: the summary and prose in unrecognised sections. */
  prose: BulletRef[];
  /** Every date range in the document, in order. */
  ranges: DateRange[];
  nameLineIndex: number;
}

export function extractProfile(lines: Line[]): ProfileBuild {
  const fullText = lines.map((l) => l.text).join("\n");

  // Name: in the top region (before the first known heading), the biggest plausible name line.
  const firstKnown = lines.findIndex((l) => !l.bullet && (lookupHeading(l.text.trim()) !== undefined || (l.styledHeading && lookupHeading(l.segments[0]) !== undefined)));
  const topEnd = Math.min(firstKnown >= 0 ? firstKnown : lines.length, 12);
  let nameLineIndex = -1;
  let name: string | null = null;
  let bestSize = -1;
  for (let i = 0; i < topEnd; i++) {
    const l = lines[i];
    if (l.bullet) continue;
    const cand = nameInLine(l);
    if (!cand) continue;
    const size = l.relSize ?? 1;
    if (size > bestSize + 0.01) {
      bestSize = size;
      name = cand;
      nameLineIndex = i;
    }
  }
  // Fallback: a sidebar or "Contact" block can come before the name. Accept a
  // clearly larger-than-body name line anywhere near the start.
  if (!name) {
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const l = lines[i];
      if (l.bullet || l.relSize === null || l.relSize < 1.5) continue;
      const cand = nameInLine(l);
      if (cand && l.relSize > bestSize + 0.01) {
        bestSize = l.relSize;
        name = cand;
        nameLineIndex = i;
      }
    }
  }

  // Heading detection. The line under the name is usually a headline ("Marketing Manager"), not a heading.
  const skip = new Set<number>();
  if (nameLineIndex >= 0) {
    skip.add(nameLineIndex);
    const next = lines[nameLineIndex + 1];
    if (next && !lookupHeading(next.text) && wordCount(next.text) <= 6) skip.add(nameLineIndex + 1);
  }
  const sections: InternalSection[] = [];
  const preamble: Line[] = [];
  let current: InternalSection | null = null;
  lines.forEach((l, i) => {
    const hit = classifyHeading(l, i, skip);
    if (hit) {
      current = { heading: hit.heading, kind: hit.kind, lines: [], lineIndex: i };
      sections.push(current);
      if (hit.inline) current.lines.push({ ...l, text: hit.inline, segments: hit.inline.split(/ {3,}/), styledHeading: false, bullet: false });
      return;
    }
    if (current) current.lines.push(l);
    else preamble.push(l);
  });

  // Contact details. Prefer the top of the document, fall back to anywhere.
  const topText = preamble.map((l) => l.text).join("\n");
  const email = (topText.match(EMAIL_RE) ?? fullText.match(EMAIL_RE))?.[0] ?? null;
  const phone = findPhone(topText) ?? findPhone(fullText);
  // PDFs often wrap a long URL at a hyphen; rejoin "…/in/jane-\ndoe" before matching.
  const urlText = fullText.replace(/([/\w]-)\n(?=[a-z0-9])/g, "$1");
  const li = urlText.match(LINKEDIN_RE)?.[0] ?? null;
  const linkedin = li ? li.replace(/\/$/, "") : null;
  const links = findLinks(urlText);
  let location: string | null = null;
  const contactBlock = sections.filter((s) => s.lines.slice(0, 8).some((l) => EMAIL_RE.test(l.text) || findPhone(l.text))).flatMap((s) => s.lines.slice(0, 8));
  for (const l of [...preamble.slice(0, 8), ...contactBlock]) {
    const m = l.text.match(/\b(?:location|address|based in)\s*:\s*([^|•·]+)/i);
    if (m && m[1].trim()) {
      location = collapse(m[1]);
      break;
    }
    for (const part of l.text.split(/\s*(?:\||•|·|▪|◦|\s{3,}|\s[–—]\s)\s*/)) {
      if (part && isLocation(part) && !EMAIL_RE.test(part)) {
        location = collapse(part);
        break;
      }
    }
    if (location) break;
  }

  // Summary: the summary section, or an intro paragraph above the first heading.
  const summarySection = sections.find((s) => s.kind === "summary");
  let summary: string | null = null;
  if (summarySection) summary = collapse(summarySection.lines.map((l) => stripBullet(l.text)).join(" ")) || null;
  if (!summary) {
    const intro = preamble.filter(
      (l, i) => i !== nameLineIndex && !EMAIL_RE.test(l.text) && !findPhone(l.text) && !LINKEDIN_RE.test(l.text) && wordCount(l.text) >= 6,
    );
    const text = collapse(intro.map((l) => l.text).join(" "));
    if (wordCount(text) >= 15) summary = text;
  }

  const experience: ExtractedRole[] = [];
  const education: ExtractedEducation[] = [];
  const skills: string[] = [];
  const certifications: string[] = [];
  const bullets: BulletRef[] = [];
  for (const s of sections) {
    if (s.kind === "experience") {
      for (const e of parseEntries(s.lines)) {
        const r = roleFromEntry(e);
        if (!r) continue;
        experience.push(r);
        const where = [s.heading, r.company ?? r.title].filter(Boolean).join(" · ");
        for (const b of r.bullets) bullets.push({ text: b, where });
      }
    } else if (s.kind === "education") education.push(...parseEducation(s.lines));
    else if (s.kind === "skills") {
      for (const sk of parseSkills(s.lines)) if (!skills.some((x) => x.toLowerCase() === sk.toLowerCase())) skills.push(sk);
    } else if (s.kind === "certifications") certifications.push(...parseCertifications(s.lines));
    else if (s.kind === "projects" || s.kind === null) {
      for (const e of parseEntries(s.lines)) for (const b of e.bullets) bullets.push({ text: collapse(b), where: s.heading });
    }
  }

  const prose: BulletRef[] = [];
  if (summary) prose.push({ text: summary, where: summarySection?.heading ?? "Summary" });
  for (const s of sections) {
    if (s.kind !== null) continue;
    const text = collapse(s.lines.filter((l) => !l.bullet && wordCount(l.text) >= 3 && findDateRanges(l.text).length === 0).map((l) => l.text).join(" "));
    if (wordCount(text) >= 8) prose.push({ text, where: s.heading });
  }

  const outSections: ExtractedSection[] = sections.map((s) => ({
    heading: s.heading,
    kind: s.kind,
    text: s.lines.map((l) => l.text).join("\n"),
  }));

  const ranges: DateRange[] = [];
  for (const l of lines) ranges.push(...findDateRanges(l.text));

  return {
    profile: {
      name,
      email,
      phone,
      linkedin,
      location,
      links,
      summary,
      sections: outSections,
      experience,
      education,
      skills,
      certifications,
    },
    sections,
    preamble,
    bullets,
    prose,
    ranges,
    nameLineIndex,
  };
}

/** Guess what an unrecognised section really is, for the fix text. */
export function inferSectionKind(s: InternalSection): SectionKind | null {
  const text = s.lines.map((l) => l.text).join("\n");
  // A "Get in touch" block holding contact details: "other" (it needs no heading at all).
  if (EMAIL_RE.test(text) || findPhone(text)) return "other";
  const ranges = findDateRanges(text).length;
  const bullets = s.lines.filter((l) => l.bullet).length;
  if (DEGREE_RE.test(text) && INSTITUTION_RE.test(text)) return "education";
  if (ranges >= 1 && (bullets >= 1 || TITLE_WORDS.test(text))) return "experience";
  if (DEGREE_RE.test(text) || INSTITUTION_RE.test(text)) return "education";
  const items = text.split(/[,|•·\n]/).filter((x) => x.trim());
  if (items.length >= 4 && items.every((x) => wordCount(x) <= 4)) return "skills";
  if (/\b(certified|certification|certificate|license|licence)\b/i.test(text)) return "certifications";
  const firstHeadingLike = s.heading.toLowerCase();
  if (/about|hello|hi|who i am|me$/.test(firstHeadingLike) && wordCount(text) >= 12) return "summary";
  return null;
}
