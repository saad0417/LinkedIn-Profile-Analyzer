// Small text helpers shared across the engine.

/** Private-use and symbol-font code points that PDFs and Word use for bullet glyphs. */
const PUA_BULLETS = /[]/g;

/** Normalise extracted text: unify bullet glyphs and spaces, drop zero-width characters. */
export function normaliseText(s: string): string {
  return s
    .replace(PUA_BULLETS, "•")
    .replace(/[    - ]/g, " ")
    .replace(/[​-‍﻿­]/g, "")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/ﬀ/g, "ff")
    .replace(/ﬃ/g, "ffi")
    .replace(/ﬄ/g, "ffl");
}

/** Leading bullet glyph or list marker followed by whitespace. */
export const BULLET_PREFIX = /^\s*(?:[•●▪‣◦○■□►▸▹➢➤➣✓✔◆◇∙·*‒–—-]|\d{1,2}[.)]|[a-z][.)](?=\s))\s+/;
/** A line that is just a bullet glyph (PDFs sometimes put the glyph on its own). */
export const BULLET_ONLY = /^\s*[•●▪‣◦○■□►▸▹➢➤➣✓✔◆◇∙·*]\s*$/;

export function stripBullet(s: string): string {
  return s.replace(BULLET_PREFIX, "").trim();
}

export function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function truncate(s: string, max = 160): string {
  const c = collapse(s);
  if (c.length <= max) return c;
  const cut = c.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–-]+$/, "") + "…";
}

export function wordCount(s: string): number {
  const m = s.match(/[\p{L}\p{N}][\p{L}\p{N}'’.+#&/-]*/gu);
  return m ? m.length : 0;
}

export function words(s: string): string[] {
  return s.match(/[\p{L}\p{N}][\p{L}\p{N}'’+#&-]*/gu) ?? [];
}

export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
export const EMAIL_RE_G = new RegExp(EMAIL_RE.source, "g");

export const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub|profile)\/[A-Za-z0-9\-_%.]+\/?/i;

const PHONE_CANDIDATE = /(?:\+|00)?\(?\d[\d\s().\-–]{5,20}\d/g;

/**
 * Find a phone number. Accepts international formats (+92 300 1234567,
 * +44 20 7946 0958, (555) 123-4567, 07700 900123, 404.555.0123) and rejects
 * date ranges and years ("2019 - 2021", "2016 – 2020").
 */
export function findPhone(text: string): string | null {
  const t = text.replace(EMAIL_RE_G, " ");
  PHONE_CANDIDATE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PHONE_CANDIDATE.exec(t))) {
    let cand = m[0].trim().replace(/[\s.\-–(]+$/, "");
    // A dangling "(" at the end or unbalanced parens: trim to something sane.
    if ((cand.match(/\(/g)?.length ?? 0) !== (cand.match(/\)/g)?.length ?? 0)) cand = cand.replace(/^\(/, "");
    const digits = cand.replace(/\D/g, "");
    const intl = /^(\+|00)/.test(cand);
    if (digits.length < 7 || digits.length > 15) continue;
    // Reject year ranges / dates such as "2019 - 2021", "03/2019", "2016–2020".
    if (/^(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}$/.test(cand)) continue;
    if (/^\d{1,2}[./-]\d{4}/.test(cand) || /\d{4}\s*[-–]\s*\d{1,2}[./-]/.test(cand)) continue;
    if (/(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}/.test(cand)) continue;
    if (!intl && digits.length < 9 && !/\(\d+\)/.test(cand)) continue;
    // Groups must look like phone groups (no group longer than 8 digits unless the whole thing is short).
    const groups = cand.split(/[\s().\-–]+/).filter(Boolean);
    if (groups.some((g) => g.replace(/\D/g, "").length > 10)) continue;
    // Numbers preceded by currency/percent context are not phones.
    const before = t.slice(Math.max(0, m.index - 2), m.index);
    if (/[$£€₹%]/.test(before)) continue;
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 2);
    if (/^\s?%/.test(after)) continue;
    return collapse(cand);
  }
  return null;
}

const URL_RE = /\b(?:https?:\/\/[^\s|,;<>()]+|www\.[^\s|,;<>()]+|(?:github|gitlab|bitbucket)\.(?:com|org)\/[^\s|,;<>()]+|(?:behance\.net|dribbble\.com|medium\.com|kaggle\.com|stackoverflow\.com|x\.com|twitter\.com)\/[^\s|,;<>()]+|[a-z0-9][a-z0-9-]{1,62}\.(?:dev|io|me|design|portfolio|site|page|tech|app)\b(?:\/[^\s|,;<>()]*)?)/gi;

/** URLs other than LinkedIn and email addresses. */
export function findLinks(text: string): string[] {
  const t = text.replace(EMAIL_RE_G, " ");
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of t.matchAll(URL_RE)) {
    const u = m[0].replace(/[.,;:)\]]+$/, "");
    if (LINKEDIN_RE.test(u)) continue;
    if (/^(?:node|vue|next|nuxt|react|three|d3|chart|express)\.js$/i.test(u)) continue;
    const key = u.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

export function isAllCaps(s: string): boolean {
  const letters = s.replace(/[^\p{L}]/gu, "");
  return letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

export function titleCaseName(s: string): string {
  if (!isAllCaps(s)) return s;
  return s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

/** Stable, locale-independent string comparison. */
export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function quoteList(items: string[], max = 4): string {
  const q = items.slice(0, max).map((x) => `“${x}”`);
  const rest = items.length - q.length;
  if (rest > 0) q.push(`${rest} more`);
  if (q.length <= 1) return q.join("");
  return q.slice(0, -1).join(", ") + " and " + q[q.length - 1];
}

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}
