// Date and date-range recognition for CV text.

export type DateFormat = "month-name" | "numeric" | "iso" | "year";

export interface ParsedDate {
  text: string;
  year: number;
  /** 1-12, or null for year-only dates. */
  month: number | null;
  format: DateFormat;
}

export interface DateRange {
  /** The range exactly as written. */
  text: string;
  index: number;
  start: ParsedDate;
  /** null when the range is open ("Present"). */
  end: ParsedDate | null;
  present: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11,
  november: 11, dec: 12, december: 12,
};

const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const YEAR = String.raw`(?:19[5-9]\d|20[0-4]\d)`;
const DATE = String.raw`(?:${MONTH}\s*,?\s*(?:${YEAR}|['’]\d{2})|${YEAR}\s*[-/.]\s*(?:0[1-9]|1[0-2])(?!\d)|(?:0?[1-9]|1[0-2])\s*[/.-]\s*${YEAR}|${YEAR})`;
const PRESENT = String.raw`(?:present|current(?:ly)?|now|today|ongoing|to\s+date|date)`;
const SEP = String.raw`\s*(?:–|—|‒|―|−|-|~|to|until|till|through|thru)\s*`;

const RANGE_RE = new RegExp(String.raw`(?<![\p{L}\d])(${DATE})${SEP}(${DATE}|${PRESENT})(?![\p{L}\d])`, "giu");
const DATE_RE = new RegExp(String.raw`(?<![\p{L}\d])${DATE}(?![\p{L}\d])`, "giu");
const SINCE_RE = new RegExp(String.raw`(?<![\p{L}\d])(?:since|from)\s+(${DATE})(?![\p{L}\d])`, "giu");

export function parseDate(raw: string): ParsedDate | null {
  const text = raw.trim();
  let m = text.match(new RegExp(String.raw`^(${MONTH})\s*,?\s*(?:(${YEAR})|['’](\d{2}))$`, "i"));
  if (m) {
    const month = MONTHS[m[1].toLowerCase().replace(".", "")];
    const year = m[2] ? Number(m[2]) : 2000 + Number(m[3]) > 2049 ? 1900 + Number(m[3]) : 2000 + Number(m[3]);
    if (!month) return null;
    return { text, year, month, format: "month-name" };
  }
  m = text.match(new RegExp(String.raw`^(${YEAR})\s*[-/.]\s*(0[1-9]|1[0-2])$`));
  if (m) return { text, year: Number(m[1]), month: Number(m[2]), format: "iso" };
  m = text.match(new RegExp(String.raw`^(0?[1-9]|1[0-2])\s*[/.-]\s*(${YEAR})$`));
  if (m) return { text, year: Number(m[2]), month: Number(m[1]), format: "numeric" };
  m = text.match(new RegExp(String.raw`^(${YEAR})$`));
  if (m) return { text, year: Number(m[1]), month: null, format: "year" };
  return null;
}

/** All date ranges in a piece of text, in order. "Since 2020" counts as an open range. */
export function findDateRanges(text: string): DateRange[] {
  const out: DateRange[] = [];
  RANGE_RE.lastIndex = 0;
  for (const m of text.matchAll(RANGE_RE)) {
    const start = parseDate(m[1]);
    if (!start) continue;
    const present = new RegExp(`^${PRESENT}$`, "i").test(m[2].trim());
    const end = present ? null : parseDate(m[2]);
    if (!present && !end) continue;
    if (end && (end.year < start.year || (end.year === start.year && end.month !== null && start.month !== null && end.month < start.month))) {
      // Backwards range: still a range as written, but treat as unparseable for normalisation.
    }
    out.push({ text: m[0].trim(), index: m.index ?? 0, start, end, present });
  }
  if (out.length === 0) {
    for (const m of text.matchAll(SINCE_RE)) {
      const start = parseDate(m[1]);
      if (start) out.push({ text: m[0].trim(), index: m.index ?? 0, start, end: null, present: true });
    }
  }
  return out;
}

/** Standalone dates (not part of a range). */
export function findDates(text: string): ParsedDate[] {
  const out: ParsedDate[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const d = parseDate(m[0]);
    if (d) out.push(d);
  }
  return out;
}

export function normaliseDate(d: ParsedDate | null, present = false): string | null {
  if (present) return "present";
  if (!d || d.month === null) return null;
  return `${d.year}-${String(d.month).padStart(2, "0")}`;
}

/** Month index (year*12 + month-1). For year-only dates, `edge` picks January or December. */
export function monthIndex(d: ParsedDate, edge: "start" | "end"): number {
  const month = d.month ?? (edge === "start" ? 1 : 12);
  return d.year * 12 + (month - 1);
}

export function formatLabel(f: DateFormat): string {
  switch (f) {
    case "month-name":
      return "Month YYYY";
    case "numeric":
      return "MM/YYYY";
    case "iso":
      return "YYYY-MM";
    case "year":
      return "year only";
  }
}
