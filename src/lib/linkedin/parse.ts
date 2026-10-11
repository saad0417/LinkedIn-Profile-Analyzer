// Reads LinkedIn's "Save to PDF" export into a LinkedInProfile.
//
// The export is a two-column page: a shaded left sidebar (Contact, Top Skills,
// Languages, Certifications, Honors-Awards, Publications) and a wide main
// column (name in large type, headline, location, then Summary, Experience,
// Education under larger headings), with "Page X of Y" centred at the bottom.
//
// We use pdf.js positional text (shared with the resume engine), drop the page
// footers, find the gutter between the columns as a vertical strip that no
// text crosses, and read each column top-down, stitching pages together. Font
// size tells the name, headings and company/title lines apart from body text.
// Everything is deterministic and in memory.
import type { LinkedInEducation, LinkedInProfile, LinkedInRole } from "./types";
import { groupPdfLines, readPdfText, type PdfInfo, type PdfPageText, type PdfTextItem } from "@/lib/analyze/pdf";
import { UnreadableDocumentError } from "@/lib/analyze/errors";
import { EMAIL_RE, collapse } from "@/lib/analyze/text";

export interface LiLine {
  text: string;
  size: number;
  bold: boolean;
  x: number;
  x1: number;
  y: number;
  page: number;
  /** Vertical gap above this line, in multiples of its font size (Infinity at the top of a page). */
  gap: number;
}

export interface ParsedLinkedIn {
  profile: LinkedInProfile;
  phone: string | null;
  rawText: string;
  pageCount: number;
  looksLikeLinkedIn: boolean;
  /** Main-column section headings found, as printed, in order. */
  headings: string[];
  /** Summary heading present (LinkedIn omits it when About is empty). */
  hasSummary: boolean;
  hasEducation: boolean;
}

const FOOTER_RE = /^Page\s+\d+\s+of\s+\d+$/i;
const SIDE_HEADS: Record<string, keyof SideLists | "contact"> = {
  contact: "contact",
  "top skills": "topSkills",
  skills: "topSkills",
  languages: "languages",
  certifications: "certifications",
  "licenses & certifications": "certifications",
  "honors-awards": "honors",
  "honors & awards": "honors",
  publications: "publications",
  patents: "publications",
};
const MAIN_HEADS = new Set([
  "summary",
  "about",
  "experience",
  "education",
  "volunteer experience",
  "projects",
  "courses",
  "licenses & certifications",
  "honors & awards",
  "publications",
  "patents",
  "languages",
  "skills",
  "recommendations",
  "organizations",
]);

interface SideLists {
  topSkills: string[];
  languages: string[];
  certifications: string[];
  honors: string[];
  publications: string[];
}

const NO_TEXT =
  "This PDF has no selectable text, so we can't read it. Download a fresh copy from LinkedIn: open your profile, More → Save to PDF, and upload that file.";

export async function parseLinkedInPdf(buf: Uint8Array): Promise<ParsedLinkedIn> {
  const { pages, info } = await readPdfText(buf);
  const chars = pages.reduce((n, p) => n + p.chars, 0);
  if (!pages.length || chars < 40) throw new UnreadableDocumentError("corrupt", NO_TEXT);

  // 1. Drop "Page X of Y" footers.
  let footerSeen = false;
  const clean: PdfPageText[] = pages.map((p) => {
    const drop = new Set<PdfTextItem>();
    for (const l of groupPdfLines(p.items)) {
      if (FOOTER_RE.test(joinItems(l.items)) && l.y < p.height * 0.12) {
        footerSeen = true;
        for (const it of l.items) drop.add(it);
      }
    }
    return { ...p, items: p.items.filter((i) => !drop.has(i)) };
  });

  // 2. Gutter between the sidebar and the main column.
  const gutter = findGutter(clean);

  // 3. Lines per column, pages stitched.
  const side: LiLine[] = [];
  const main: LiLine[] = [];
  for (const p of clean) {
    const left = gutter === null ? [] : p.items.filter((i) => i.x1 <= gutter);
    const right = gutter === null ? p.items : p.items.filter((i) => i.x1 > gutter);
    side.push(...toLines(left, p.page));
    main.push(...toLines(right, p.page));
  }

  const body = bodySize(main.length ? main : side);
  const sideBody = bodySize(side);
  const sideRes = parseSidebar(side, sideBody);
  const mainRes = parseMain(main, body);

  const profile: LinkedInProfile = {
    name: mainRes.name,
    headline: mainRes.headline,
    location: mainRes.location,
    email: sideRes.email ?? findEmail(main),
    profileUrl: sideRes.profileUrl ?? findProfileUrl(main),
    websites: sideRes.websites,
    topSkills: sideRes.lists.topSkills,
    languages: sideRes.lists.languages,
    certifications: sideRes.lists.certifications,
    honors: sideRes.lists.honors,
    publications: sideRes.lists.publications,
    summary: mainRes.summary,
    experience: mainRes.experience,
    education: mainRes.education,
  };

  const rawText = [renderColumn(side), renderColumn(main)].filter(Boolean).join("\n\n");
  const hasLiUrl = /linkedin\.com\/in\//i.test(rawText.replace(/\s+/g, ""));
  const metaLi = isLinkedInMeta(info);
  const looksLikeLinkedIn = sideRes.headings.length > 0 && (hasLiUrl || metaLi) && (footerSeen || metaLi);

  return {
    profile,
    phone: sideRes.phone,
    rawText,
    pageCount: pages.length,
    looksLikeLinkedIn,
    headings: mainRes.headings,
    hasSummary: mainRes.headings.some((h) => /^(summary|about)$/i.test(h)),
    hasEducation: mainRes.headings.some((h) => /^education$/i.test(h)),
  };
}

function isLinkedInMeta(info: PdfInfo): boolean {
  return info.author === "LinkedIn" && /resume generated from profile/i.test(info.subject ?? "");
}

/* ---------------- geometry ---------------- */

function joinItems(items: PdfTextItem[]): string {
  let out = "";
  let prev: PdfTextItem | null = null;
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    if (prev && it.x - prev.x1 > 0.12 * it.size && !/\s$/.test(out) && !/^\s/.test(it.str)) out += " ";
    out += it.str;
    prev = it;
  }
  return collapse(out);
}

/**
 * The gutter is the widest vertical strip, between 15% and 50% of the page
 * width, that no text item crosses while both sides carry text. Measured over
 * all pages together (later pages often have an empty sidebar). Null when the
 * document has no such strip (single-column PDF).
 */
function findGutter(pages: PdfPageText[]): number | null {
  const w = Math.max(...pages.map((p) => p.width));
  const items = pages.flatMap((p) => p.items);
  if (items.length < 8) return null;
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  const lo = Math.floor(w * 0.15);
  const hi = Math.ceil(w * 0.5);
  for (let x = lo; x <= hi + 1; x++) {
    let ok = x <= hi;
    if (ok) {
      let left = 0;
      let right = 0;
      for (const it of items) {
        if (it.x < x - 0.5 && it.x1 > x + 0.5) {
          ok = false;
          break;
        }
        if (it.x1 <= x) left++;
        else right++;
      }
      ok = ok && left >= 4 && right >= 4;
    }
    if (ok && runStart < 0) runStart = x;
    if (!ok && runStart >= 0) {
      if (x - runStart > bestLen) {
        bestLen = x - runStart;
        bestStart = runStart;
      }
      runStart = -1;
    }
  }
  if (bestLen < 8) return null;
  return bestStart + bestLen / 2;
}

function toLines(items: PdfTextItem[], page: number): LiLine[] {
  const raw = groupPdfLines(items);
  const out: LiLine[] = [];
  let prevY: number | null = null;
  for (const l of raw) {
    const text = joinItems(l.items);
    if (!text) continue;
    const letters = l.items.filter((i) => /\p{L}/u.test(i.str));
    out.push({
      text,
      size: l.size,
      bold: letters.length > 0 && letters.every((i) => i.bold),
      x: Math.min(...l.items.map((i) => i.x)),
      x1: Math.max(...l.items.map((i) => i.x1)),
      y: l.y,
      page,
      gap: prevY === null ? Infinity : (prevY - l.y) / l.size,
    });
    prevY = l.y;
  }
  return out;
}

/** Font size carrying the most characters. */
function bodySize(lines: LiLine[]): number {
  const by = new Map<number, number>();
  for (const l of lines) {
    const k = Math.round(l.size * 2) / 2;
    by.set(k, (by.get(k) ?? 0) + l.text.length);
  }
  let best = 10;
  let n = -1;
  for (const [k, v] of [...by.entries()].sort((a, b) => a[0] - b[0]))
    if (v > n) {
      n = v;
      best = k;
    }
  return best;
}

/** A normal paragraph line break: the gap is about one line (not a blank line or a page break). */
function tight(l: LiLine): boolean {
  return l.gap < 1.75;
}

/** The previous line ran to the column edge, i.e. this line's first word would not have fitted after it. */
function wrapsFrom(prev: LiLine, cur: LiLine, right: number): boolean {
  if (cur.page !== prev.page && !(cur.gap === Infinity)) return false;
  const word = cur.text.split(/\s+/)[0] ?? "";
  const charW = cur.text.length ? (cur.x1 - cur.x) / cur.text.length : cur.size * 0.5;
  return prev.x1 + charW * (word.length + 1) > right - 1;
}

function renderColumn(lines: LiLine[]): string {
  const parts: string[] = [];
  lines.forEach((l, i) => {
    if (i > 0 && (l.gap >= 1.75 || l.page !== lines[i - 1].page)) parts.push("");
    parts.push(l.text);
  });
  return parts.join("\n");
}

const norm = (s: string) => collapse(s).toLowerCase().replace(/:$/, "");

/* ---------------- sidebar ---------------- */

const LABEL_RE = /^(.*?)\s*\((LinkedIn|Portfolio|Company|Personal|Blog|Other|RSS Feed|Mobile|Home|Work|Phone)\)$/i;

interface SideResult {
  headings: string[];
  email: string | null;
  phone: string | null;
  profileUrl: string | null;
  websites: string[];
  lists: SideLists;
}

function parseSidebar(lines: LiLine[], body: number): SideResult {
  const res: SideResult = {
    headings: [],
    email: null,
    phone: null,
    profileUrl: null,
    websites: [],
    lists: { topSkills: [], languages: [], certifications: [], honors: [], publications: [] },
  };
  if (!lines.length) return res;
  const right = Math.max(...lines.map((l) => l.x1));
  const sizesVary = lines.some((l) => Math.abs(l.size - body) > 0.6);

  // Most common line pitch (in font sizes) between consecutive sidebar lines.
  const pitches = new Map<number, number>();
  for (const l of lines) if (tight(l)) pitches.set(Math.round(l.gap * 20) / 20, (pitches.get(Math.round(l.gap * 20) / 20) ?? 0) + 1);
  const pitch = [...pitches.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 1.3;

  let section: keyof SideLists | "contact" | null = null;
  const contact: string[] = [];
  let items: string[] = [];
  let prev: LiLine | null = null;
  const flush = () => {
    if (section && section !== "contact") res.lists[section].push(...items.map(collapse).filter(Boolean));
    items = [];
  };

  for (const l of lines) {
    const key = SIDE_HEADS[norm(l.text)];
    if (key && (!sizesVary || l.size > body * 1.05 || l.bold)) {
      flush();
      section = key;
      res.headings.push(l.text);
      prev = null;
      continue;
    }
    if (section === "contact") {
      // Every contact entry is an email or ends with a "(Label)"; anything else continues the entry (wrapped URLs).
      // Only an unfinished URL (no spaces yet) can continue onto the next line.
      const last = contact[contact.length - 1];
      const isEmail = (t: string) => new RegExp(`^${EMAIL_RE.source}$`).test(t);
      const complete = last === undefined || LABEL_RE.test(last) || isEmail(last) || /\s/.test(last) || !/[./]/.test(last) || isEmail(l.text);
      if (complete) contact.push(l.text);
      else contact[contact.length - 1] = /^\(/.test(l.text) || /\s/.test(last) ? `${last} ${l.text}` : `${last}${l.text}`;
    } else if (section) {
      // Wrapped item: starts lowercase, or the previous line ended close to the column edge and this
      // line's first word would not have fitted after it. Languages always end with "(Proficiency)".
      const last = items[items.length - 1];
      const closed = section === "languages" && last !== undefined && /\)$/.test(last);
      // Line spacing inside a wrapped item is often tighter than between items; use it when present.
      const wrapped = prev !== null && wrapsFrom(prev, l, right) && (right - prev.x1 < (right - prev.x) * 0.3 || l.gap < pitch - 0.08);
      const cont = prev !== null && !closed && tight(l) && (/^[\p{Ll}(&]/u.test(l.text) || wrapped);
      if (cont && items.length) items[items.length - 1] += ` ${l.text}`;
      else items.push(l.text);
    }
    prev = l;
  }
  flush();

  for (const entry of contact) {
    const e = collapse(entry);
    const email = e.match(new RegExp(`^${EMAIL_RE.source}$`));
    if (email) {
      res.email ??= email[0];
      continue;
    }
    const m = e.match(LABEL_RE);
    const value = (m ? m[1] : e).replace(/\s+/g, "");
    const label = m?.[2].toLowerCase() ?? "";
    if (/^(mobile|home|work|phone)$/.test(label)) {
      res.phone ??= m![1].trim();
      continue;
    }
    const li = value.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^\s()]+/i);
    if (li) {
      res.profileUrl ??= li[0].replace(/\/$/, "");
      continue;
    }
    if (/\.[a-z]{2,}/i.test(value) && !new RegExp(`^${EMAIL_RE.source}$`).test(value)) res.websites.push(value);
  }
  return res;
}

function findEmail(lines: LiLine[]): string | null {
  for (const l of lines) {
    const m = l.text.match(EMAIL_RE);
    if (m) return m[0];
  }
  return null;
}

function findProfileUrl(lines: LiLine[]): string | null {
  const m = lines
    .map((l) => l.text)
    .join(" ")
    .match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%.]+/i);
  return m ? m[0] : null;
}

/* ---------------- main column ---------------- */

const MONTH = "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
const LI_DATE = `(?:${MONTH}\\s+)?(?:19|20)\\d{2}`;
const DATE_LINE = new RegExp(`^(${LI_DATE})\\s*[-–—]\\s*(${LI_DATE}|Present)\\s*(?:\\(([^)]*)\\))?$`, "i");
const DURATION_LINE = /^(?:less than a year|(?:\d+\s+years?)(?:\s+\d+\s+months?)?|\d+\s+months?)$/i;
const MONTH_NUM: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "March 2021" → "2021-03"; "2019" → null (month unknown); "Present" → "present". */
export function liDate(s: string): string | null {
  const t = s.trim();
  if (/^present$/i.test(t)) return "present";
  const m = t.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const mon = MONTH_NUM[m[1].slice(0, 3).toLowerCase()];
  return mon ? `${m[2]}-${String(mon).padStart(2, "0")}` : null;
}

const LOC_WORDS = /\b(area|region|metropolitan|metro|remote|hybrid|on-site|county|province|state|united states|united kingdom|canada|india|germany|australia|pakistan|nigeria|uae|emirates)\b/i;
const SMALL_WORDS = /^(and|of|de|da|del|la|le|du|the|am|an|im|upon|on|sur|di)$/i;

/** A short, title-cased line such as "Austin, Texas, United States" or "Greater London Area". */
function looksLikeLocation(t: string): boolean {
  if (t.length > 70 || /[.;:!?]$/.test(t) || /\d{3,}|@|https?:|www\./i.test(t) || /^[•\-–*]/.test(t)) return false;
  const words = t.split(/[\s,]+/).filter(Boolean);
  if (!words.length || words.length > 8) return false;
  const capped = words.every((w) => /^[\p{Lu}(]/u.test(w) || SMALL_WORDS.test(w) || /^[\p{Lu}]{2,3}$/u.test(w));
  return capped && (t.includes(",") || LOC_WORDS.test(t) || words.length <= 3);
}

interface MainResult {
  name: string | null;
  headline: string | null;
  location: string | null;
  summary: string | null;
  experience: LinkedInRole[];
  education: LinkedInEducation[];
  headings: string[];
}

function isMainHeading(l: LiLine, body: number): boolean {
  const t = norm(l.text);
  if (MAIN_HEADS.has(t)) return l.size >= body * 1.15 || l.bold || /^[A-Z &]+$/.test(l.text);
  return false;
}

function parseMain(lines: LiLine[], body: number): MainResult {
  const res: MainResult = { name: null, headline: null, location: null, summary: null, experience: [], education: [], headings: [] };
  if (!lines.length) return res;
  const right = Math.max(...lines.map((l) => l.x1));

  // Split into the top block and sections.
  const sections: { heading: string; lines: LiLine[] }[] = [];
  const top: LiLine[] = [];
  for (const l of lines) {
    if (isMainHeading(l, body)) {
      sections.push({ heading: l.text, lines: [] });
      res.headings.push(l.text);
    } else if (sections.length) sections[sections.length - 1].lines.push(l);
    else top.push(l);
  }

  // Name = the largest text in the top block (LinkedIn prints it at ~26pt).
  const nameSize = Math.max(0, ...top.slice(0, 6).map((l) => l.size));
  let i = 0;
  if (nameSize >= body * 1.6) {
    while (i < top.length && top[i].size < nameSize - 0.5) i++;
    const nameLines: string[] = [];
    while (i < top.length && Math.abs(top[i].size - nameSize) <= 0.5) nameLines.push(top[i++].text);
    res.name = nameLines.join(" ") || null;
  }
  // Headline (slightly larger than body) then location (body size).
  const rest = top.slice(i);
  if (rest.length) {
    const sizesDiffer = rest.some((l) => l.size > body * 1.05) && rest.some((l) => l.size <= body * 1.05);
    let head: LiLine[];
    let loc: LiLine[];
    if (sizesDiffer) {
      head = rest.filter((l) => l.size > body * 1.05);
      loc = rest.filter((l) => l.size <= body * 1.05);
    } else {
      const last = rest[rest.length - 1];
      const isLoc = rest.length > 1 && looksLikeLocation(last.text);
      head = isLoc ? rest.slice(0, -1) : rest;
      loc = isLoc ? [last] : [];
    }
    // Guard against non-LinkedIn PDFs, where this block can be a whole paragraph.
    const headline = collapse(head.map((l) => l.text).join(" "));
    const location = collapse(loc.map((l) => l.text).join(" "));
    res.headline = headline && head.length <= 3 && headline.length <= 260 ? headline : null;
    res.location = location && looksLikeLocation(location) ? location : null;
  }

  for (const s of sections) {
    const h = norm(s.heading);
    if ((h === "summary" || h === "about") && res.summary === null) res.summary = paragraphs(s.lines, right) || null;
    else if (h === "experience") res.experience.push(...parseExperience(s.lines, body, right));
    else if (h === "education") res.education.push(...parseEducation(s.lines, body, right));
  }
  return res;
}

/** Join lines into text: wrapped lines with a space, the user's own line breaks with "\n", blank lines with "\n\n". */
function paragraphs(lines: LiLine[], right: number): string {
  let out = "";
  lines.forEach((l, i) => {
    if (i === 0) {
      out = l.text;
      return;
    }
    const prev = lines[i - 1];
    const pageBreak = l.page !== prev.page;
    if (!pageBreak && !tight(l)) out += "\n\n";
    else if (/^[•\-–*·▪]\s/.test(l.text)) out += "\n";
    else if (pageBreak || wrapsFrom(prev, l, right)) out += " ";
    else out += "\n";
    out += l.text;
  });
  return out.trim();
}

function parseExperience(lines: LiLine[], body: number, right: number): LinkedInRole[] {
  const roles: LinkedInRole[] = [];
  const big = (l: LiLine) => l.size > body * 1.04 || (l.bold && !DATE_LINE.test(l.text));
  let pending: LiLine[] = [];
  let group: string | null = null;
  let lastCompany: string | null = null;
  let cur: { role: LinkedInRole; desc: LiLine[]; afterDate: boolean } | null = null;
  let lastWasBig = false;

  const finish = () => {
    if (cur) cur.role.description = cur.desc.length ? paragraphs(cur.desc, right) : null;
    cur = null;
  };

  for (const l of lines) {
    if (big(l)) {
      if (!lastWasBig) {
        finish();
        pending = [];
      }
      pending.push(l);
      lastWasBig = true;
      continue;
    }
    const date = l.text.match(DATE_LINE);
    if (DURATION_LINE.test(l.text) && pending.length && lastWasBig) {
      // Company line + total duration: several roles grouped under one company.
      group = joinWrapped(pending);
      lastCompany = group;
      pending = [];
      lastWasBig = true; // the next big lines are this group's first title
      continue;
    }
    lastWasBig = false;
    if (date && (pending.length || cur === null)) {
      finish();
      const { company, title } = splitHeader(pending, group, lastCompany);
      if (company !== group) group = null;
      lastCompany = company ?? lastCompany;
      pending = [];
      cur = {
        role: {
          title,
          company,
          dates: l.text,
          start: liDate(date[1]),
          end: liDate(date[2]),
          location: null,
          description: null,
        },
        desc: [],
        afterDate: true,
      };
      roles.push(cur.role);
      continue;
    }
    if (cur) {
      if (cur.afterDate && !cur.desc.length && cur.role.location === null && looksLikeLocation(l.text)) {
        cur.role.location = l.text;
        cur.afterDate = false;
        continue;
      }
      cur.afterDate = false;
      cur.desc.push(l);
    }
  }
  finish();
  return roles;
}

/** Decide which header lines are the company and which the title. */
function splitHeader(pending: LiLine[], group: string | null, lastCompany: string | null): { company: string | null; title: string | null } {
  if (!pending.length) return { company: group ?? lastCompany, title: null };
  if (group) {
    // Inside a grouped company every header is a title (possibly wrapped), unless the style changes (a new company).
    const cut = styleBreak(pending);
    if (cut > 0) return { company: joinWrapped(pending.slice(0, cut)), title: joinWrapped(pending.slice(cut)) };
    return { company: group, title: joinWrapped(pending) };
  }
  if (pending.length === 1) return { company: lastCompany, title: pending[0].text };
  const cut = styleBreak(pending);
  const at = cut > 0 ? cut : 1;
  return { company: joinWrapped(pending.slice(0, at)), title: joinWrapped(pending.slice(at)) };
}

/** Index where font size or weight changes between consecutive header lines (company 12pt → title 11.5pt bold), or -1. */
function styleBreak(ls: LiLine[]): number {
  for (let i = 1; i < ls.length; i++) if (Math.abs(ls[i].size - ls[i - 1].size) > 0.25 || ls[i].bold !== ls[i - 1].bold) return i;
  return -1;
}

function joinWrapped(ls: LiLine[]): string {
  return collapse(ls.map((l) => l.text).join(" "));
}

function parseEducation(lines: LiLine[], body: number, right: number): LinkedInEducation[] {
  const out: LinkedInEducation[] = [];
  let cur: { school: LiLine[]; detail: LiLine[] } | null = null;
  const items: { school: LiLine[]; detail: LiLine[] }[] = [];
  for (const l of lines) {
    const big = l.size > body * 1.04;
    if (big) {
      const prev: LiLine | undefined = cur?.school[cur.school.length - 1];
      if (cur && !cur.detail.length && prev && tight(l) && wrapsFrom(prev, l, right)) cur.school.push(l);
      else {
        cur = { school: [l], detail: [] };
        items.push(cur);
      }
    } else if (cur) cur.detail.push(l);
  }
  for (const it of items) {
    const school = collapse(it.school.map((l) => l.text).join(" "));
    const detail = collapse(it.detail.map((l) => l.text).join(" "));
    let degree: string | null = detail || null;
    let dates: string | null = null;
    const m = detail.match(/^(.*?)\s*·?\s*\(([^()]*\d{4}[^()]*)\)\s*$/);
    if (m) {
      degree = m[1].replace(/[\s·,]+$/, "").trim() || null;
      dates = m[2].trim();
    }
    out.push({ school: school || null, degree, dates });
  }
  return out;
}
