// PDF parsing with pdf.js (legacy Node build, main-thread "fake worker").
//
// What we reconstruct, and why:
// - Lines are built by grouping text items on the same baseline and sorting
//   them left to right across the WHOLE page. That is how a naive ATS reads a
//   PDF, so in a two-column layout the columns get interleaved. `rawText` keeps
//   that interleaving on purpose: it is what the parser saw.
// - Columns are detected separately (vertical gutter analysis) so we can tell
//   the user why their text came out mixed.
// - The operator list gives images and filled shapes (skill bars, icon rows).
import type { ColumnEvidence, Line, ParsedDocument, PlacedGraphic } from "./internal";
import { UnreadableDocumentError } from "./errors";
import { BULLET_ONLY, BULLET_PREFIX, collapse, normaliseText, truncate, wordCount } from "./text";
import { cleanFontName } from "./fonts";
import { findDateRanges, findDates } from "./dates";

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfJs> | null = null;

/**
 * Load pdf.js once. Registering the worker module on `globalThis.pdfjsWorker`
 * makes pdf.js run its "worker" on the main thread, which works the same
 * under tsx and inside a Next.js server bundle (pdfjs-dist is listed in
 * serverExternalPackages so it is loaded from node_modules, not bundled).
 */
function loadPdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const g = globalThis as { pdfjsWorker?: unknown };
      if (!g.pdfjsWorker) g.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      return import("pdfjs-dist/legacy/build/pdf.mjs");
    })().catch((e) => {
      pdfjsPromise = null;
      throw e;
    });
  }
  return pdfjsPromise;
}

interface Item {
  str: string;
  x: number;
  x1: number;
  y: number;
  size: number;
  bold: boolean;
}

interface RawLine {
  items: Item[];
  y: number;
  size: number;
}

const BOLD_RE = /bold|black|heavy|semibold|demibold|demi\b|extrabold|ultrabold/i;
/** Fewer non-space characters than this on a page means it is effectively an image. */
const TEXTLESS_CHARS = 25;

/**
 * Resource limits for untrusted PDFs (a 5 MB file can still describe a huge
 * amount of work). Pages past the cap are not read (`pageCount` still reports
 * the real number, so the length check works). The time budget is checked
 * around every pdf.js call; the route's maxDuration is the final backstop.
 */
export const PDF_LIMITS = {
  /** Resume analysis: anything past page 15 isn't a resume an ATS reads anyway. */
  pages: 15,
  /** LinkedIn exports of long careers run longer than resumes. */
  linkedinPages: 20,
  /** Whole document, including loading. */
  timeMs: 15_000,
  /** Text items on one page (dense real pages have a few thousand at most). */
  itemsPerPage: 10_000,
} as const;

const TOO_COMPLEX =
  "This PDF is too complex for us to read in time. Export it to PDF again from the app that made it and try once more.";

/** Reject `p` once the deadline passes (pdf.js work is then abandoned and the document destroyed by the caller). */
function withDeadline<T>(p: Promise<T>, deadline: number): Promise<T> {
  const left = deadline - Date.now();
  if (left <= 0) return Promise.reject(new UnreadableDocumentError("corrupt", TOO_COMPLEX));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UnreadableDocumentError("corrupt", TOO_COMPLEX)), left);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

type PdfDoc = Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>;
type PdfPage = Awaited<ReturnType<PdfDoc["getPage"]>>;

/** Open a PDF with pdf.js; maps password and parse failures to UnreadableDocumentError. */
async function openPdf(buf: Uint8Array, deadline: number): Promise<{ pdfjs: PdfJs; doc: PdfDoc; destroy: () => Promise<void> }> {
  const pdfjs = await loadPdfjs();
  // pdf.js may take ownership of the buffer; give it a copy.
  const data = new Uint8Array(buf);
  const task = pdfjs.getDocument({
    data,
    verbosity: 0,
    useSystemFonts: false,
    disableFontFace: true,
    fontExtraProperties: true,
    stopAtErrors: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  });
  const destroy = () => task.destroy().catch(() => {});
  try {
    const doc = await withDeadline(task.promise, deadline);
    return { pdfjs, doc, destroy };
  } catch (e) {
    await destroy();
    if (e instanceof UnreadableDocumentError) throw e;
    const name = (e as { name?: string })?.name;
    if (name === "PasswordException") throw new UnreadableDocumentError("encrypted");
    throw new UnreadableDocumentError("corrupt");
  }
}

/**
 * Positioned, horizontal text items of one page (PDF user space, origin at the
 * page's bottom-left). Requires the page's operator list to have been loaded
 * first so font names resolve. `chars` counts every non-space character,
 * including rotated text that is skipped from `items`.
 */
async function pageText(page: PdfPage, fontNames: Set<string>, deadline: number): Promise<{ items: Item[]; chars: number }> {
  const [vx0, vy0] = page.view;
  const tc = await withDeadline(page.getTextContent(), deadline);
  if (tc.items.length > PDF_LIMITS.itemsPerPage) throw new UnreadableDocumentError("corrupt", TOO_COMPLEX);
  // Font family names (commonObjs holds the real names once the operator list has loaded the fonts).
  const boldById = new Map<string, boolean>();
  for (const it of tc.items) {
    if (!("fontName" in it) || boldById.has(it.fontName)) continue;
    let bold = false;
    try {
      const f = page.commonObjs.get(it.fontName) as { name?: string; bold?: boolean; black?: boolean } | undefined;
      const raw = f?.name ?? "";
      bold = BOLD_RE.test(raw) || !!f?.bold || !!f?.black;
      const fam = raw ? cleanFontName(raw) : null;
      if (fam) fontNames.add(fam);
    } catch {
      /* font not resolved; ignore */
    }
    boldById.set(it.fontName, bold);
  }

  const items: Item[] = [];
  let chars = 0;
  for (const it of tc.items) {
    if (!("str" in it)) continue;
    const str = normaliseText(it.str);
    if (!str || !str.trim()) continue;
    const [a, b, c, d, e, f] = it.transform as number[];
    const size = Math.hypot(c, d) || Math.hypot(a, b) || it.height || 10;
    chars += str.replace(/\s/g, "").length;
    // Skip rotated text (sideways labels); still counted as characters above.
    if (Math.abs(b) > Math.abs(a) * 0.05 || a <= 0) continue;
    items.push({ str, x: e - vx0, x1: e - vx0 + (it.width || str.length * size * 0.5), y: f - vy0, size, bold: boldById.get(it.fontName) ?? false });
  }
  return { items, chars };
}

export type PdfTextItem = Item;

/** Document-info dictionary fields (null when absent). */
export interface PdfInfo {
  title: string | null;
  author: string | null;
  subject: string | null;
  producer: string | null;
}

export interface PdfPageText {
  /** 1-based. */
  page: number;
  width: number;
  height: number;
  items: PdfTextItem[];
  /** Non-space characters on the page (including rotated text). */
  chars: number;
}

/**
 * Low-level positional text of every page, for parsers with their own layout
 * model (the LinkedIn export reader). Same pdf.js setup and error mapping as parsePdf.
 */
export async function readPdfText(buf: Uint8Array): Promise<{ pages: PdfPageText[]; fonts: string[]; info: PdfInfo }> {
  const deadline = Date.now() + PDF_LIMITS.timeMs;
  const { doc, destroy } = await openPdf(buf, deadline);
  try {
    const info: PdfInfo = { title: null, author: null, subject: null, producer: null };
    try {
      const meta = (await withDeadline(doc.getMetadata(), deadline)).info as Record<string, unknown> | undefined;
      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
      info.title = str(meta?.Title);
      info.author = str(meta?.Author);
      info.subject = str(meta?.Subject);
      info.producer = str(meta?.Producer);
    } catch {
      /* no metadata */
    }
    const fontNames = new Set<string>();
    const pages: PdfPageText[] = [];
    for (let p = 1; p <= Math.min(doc.numPages, PDF_LIMITS.linkedinPages); p++) {
      const page = await withDeadline(doc.getPage(p), deadline);
      const [vx0, vy0, vx1, vy1] = page.view;
      await withDeadline(page.getOperatorList(), deadline);
      const { items, chars } = await pageText(page, fontNames, deadline);
      pages.push({ page: p, width: vx1 - vx0, height: vy1 - vy0, items, chars });
      page.cleanup();
    }
    return { pages, fonts: [...fontNames].sort(), info };
  } finally {
    await destroy();
  }
}

/** Group positioned items into baseline-aligned lines, top to bottom, items left to right. */
export function groupPdfLines(items: PdfTextItem[]): { items: PdfTextItem[]; y: number; size: number }[] {
  return groupLines(items);
}

export async function parsePdf(buf: Uint8Array): Promise<ParsedDocument> {
  const deadline = Date.now() + PDF_LIMITS.timeMs;
  const { pdfjs, doc, destroy } = await openPdf(buf, deadline);

  try {
    const OPS = pdfjs.OPS as unknown as Record<string, number>;
    const fontNames = new Set<string>();
    const pageLines: { page: number; lines: RawLine[]; left: number; right: number; chars: number }[] = [];
    const columnPages: typeof pageLines = [];
    const graphics: PlacedGraphic[] = [];
    const columnEvidence: ColumnEvidence[] = [];
    const textlessPages: number[] = [];
    let columns = 1;

    for (let p = 1; p <= Math.min(doc.numPages, PDF_LIMITS.pages); p++) {
      const page = await withDeadline(doc.getPage(p), deadline);
      const [vx0, vy0, vx1, vy1] = page.view;
      const pageW = vx1 - vx0;
      const pageH = vy1 - vy0;
      const ops = await withDeadline(page.getOperatorList(), deadline);
      const { items, chars } = await pageText(page, fontNames, deadline);
      if (chars < TEXTLESS_CHARS) textlessPages.push(p);

      const lines = groupLines(items);
      const left = items.length ? Math.min(...items.map((i) => i.x)) : 0;
      const right = items.length ? Math.max(...items.map((i) => i.x1)) : 0;
      pageLines.push({ page: p, lines, left, right, chars });

      const cols = detectColumns(lines, pageW);
      if (cols) {
        columns = Math.max(columns, 2);
        columnEvidence.push({ page: p, mixedLines: cols.mixed });
        columnPages.push({ page: p, lines: columnOrder(lines, cols.gx, cols.top), left, right, chars });
      } else columnPages.push({ page: p, lines, left, right, chars });

      graphics.push(...collectGraphics(ops.fnArray, ops.argsArray, OPS, p, pageW * pageH));
      page.cleanup();
    }

    const lines = buildLines(pageLines);
    const readingLines = columns > 1 ? buildLines(columnPages) : lines;
    const rawText = renderRaw(lines);

    return {
      kind: "pdf",
      pageCount: doc.numPages,
      lines,
      readingLines,
      rawText,
      sourceHtml: null,
      fonts: [...fontNames].sort(),
      columns,
      columnEvidence,
      textlessPages,
      graphics,
      hidden: [],
      tables: null,
      sectionColumns: 0,
    };
  } finally {
    await destroy();
  }
}

/** Group items into baseline-aligned lines, top to bottom; items left to right. */
function groupLines(items: Item[]): RawLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: RawLine[] = [];
  for (const it of sorted) {
    const cur = lines[lines.length - 1];
    if (cur && Math.abs(cur.y - it.y) <= 0.45 * Math.min(cur.size, it.size)) {
      cur.items.push(it);
      cur.size = Math.max(cur.size, it.size);
    } else {
      lines.push({ items: [it], y: it.y, size: it.size });
    }
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x || b.y - a.y);
    // Drop duplicated items (fake-bold overprinting).
    l.items = l.items.filter((it, i, arr) => !(i > 0 && arr[i - 1].str === it.str && Math.abs(arr[i - 1].x - it.x) < 1));
  }
  return lines;
}

function wideGap(size: number): number {
  return Math.max(1.5 * size, 12);
}

/** Split a raw line into segments at wide horizontal gaps. */
function segmentsOf(line: RawLine): { text: string; x: number; x1: number }[] {
  const segs: { text: string; x: number; x1: number }[] = [];
  let cur: { text: string; x: number; x1: number } | null = null;
  for (const it of line.items) {
    if (!cur) {
      cur = { text: it.str, x: it.x, x1: it.x1 };
      continue;
    }
    const gap = it.x - cur.x1;
    if (gap > wideGap(Math.min(it.size, line.size))) {
      segs.push(cur);
      cur = { text: it.str, x: it.x, x1: it.x1 };
      continue;
    }
    if (gap > 0.12 * it.size && !/\s$/.test(cur.text) && !/^\s/.test(it.str)) cur.text += " ";
    cur.text += it.str;
    cur.x1 = Math.max(cur.x1, it.x1);
  }
  if (cur) segs.push(cur);
  return segs.map((s) => ({ ...s, text: collapse(s.text) })).filter((s) => s.text);
}

function buildLines(pages: { page: number; lines: RawLine[]; left: number; right: number }[]): Line[] {
  // Body font size = the size carrying the most characters.
  const bySize = new Map<number, number>();
  for (const pg of pages)
    for (const l of pg.lines)
      for (const it of l.items) {
        const k = Math.round(it.size * 2) / 2;
        bySize.set(k, (bySize.get(k) ?? 0) + it.str.length);
      }
  let body = 10;
  let best = -1;
  for (const [k, v] of [...bySize.entries()].sort((a, b) => a[0] - b[0]))
    if (v > best) {
      best = v;
      body = k;
    }

  const out: Line[] = [];
  for (const pg of pages) {
    let prev: RawLine | null = null;
    let prevOut: { line: Line; x1: number; size: number } | null = null;
    for (const l of pg.lines) {
      const segs = segmentsOf(l);
      if (!segs.length) continue;
      // A bullet glyph separated from its text by a wide gap belongs to the next segment.
      if (segs.length > 1 && BULLET_ONLY.test(segs[0].text)) {
        segs[1] = { text: `${segs[0].text.trim()} ${segs[1].text}`, x: segs[0].x, x1: segs[1].x1 };
        segs.shift();
      }
      let first = segs[0].text;
      const bullet = BULLET_PREFIX.test(first) && !/^\d/.test(first.trim()) ? true : /^\d{1,2}[.)]\s/.test(first);
      if (bullet) first = first.replace(/^\s*[•●▪‣◦○■□►▸▹➢➤➣✓✔◆◇∙·*‒–—-]\s*/, "• ");
      segs[0] = { ...segs[0], text: first };
      // Indent of the text itself (after the bullet glyph) relative to the page's left text edge.
      const textItem = bullet && l.items.length > 1 && BULLET_ONLY.test(l.items[0].str) ? l.items[1] : l.items[0];
      const indent = textItem.x - pg.left;
      const letters = l.items.filter((i) => /\p{L}/u.test(i.str));
      const gapBefore = prev ? prev.y - l.y > 1.55 * Math.max(prev.size, l.size) || prev.y < l.y : out.length > 0;
      out.push({
        text: segs.map((s) => s.text).join("   "),
        segments: segs.map((s) => s.text),
        bullet,
        relSize: body ? l.size / body : null,
        bold: letters.length > 0 && letters.every((i) => i.bold),
        styledHeading: false,
        indent,
        page: pg.page,
        fillsWidth: segs[segs.length - 1].x1 >= pg.right - 2.5 * l.size,
        gapBefore,
      });
      // Line-break test: the previous line was wrapped if this line's first word would not have fitted after it.
      if (prevOut && !gapBefore) {
        const it = textItem;
        const word = it.str.trim().split(/\s+/)[0] ?? "";
        const wordW = it.str.length ? ((it.x1 - it.x) * word.length) / it.str.length : 0;
        if (prevOut.x1 + 0.3 * prevOut.size + wordW > pg.right - 1) prevOut.line.fillsWidth = true;
      }
      prevOut = { line: out[out.length - 1], x1: segs[segs.length - 1].x1, size: l.size };
      prev = l;
    }
  }
  return out;
}

function renderRaw(lines: Line[]): string {
  const parts: string[] = [];
  let page = lines[0]?.page ?? 1;
  for (const l of lines) {
    if (parts.length && (l.gapBefore || l.page !== page)) parts.push("");
    page = l.page;
    parts.push(l.text);
  }
  return parts.join("\n");
}

/* ---------------- column detection ---------------- */

function isDateLike(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  const ranges = findDateRanges(t);
  const covered = ranges.reduce((n, r) => n + r.text.length, 0);
  if (covered >= t.length * 0.6) return true;
  return wordCount(t) <= 4 && findDates(t).length > 0;
}

/**
 * Two columns exist when a vertical strip of the page (the gutter) is crossed
 * by almost no line within the region where both sides have text, and both
 * sides carry real content (not just right-aligned dates or locations, which
 * single-column CVs have on every role line).
 */
function detectColumns(lines: RawLine[], pageW: number): { mixed: string[]; gx: number; top: number } | null {
  if (lines.length < 10) return null;
  const xs = lines.flatMap((l) => l.items.map((i) => [i.x, i.x1]));
  const minX = Math.min(...xs.map((v) => v[0]));
  const maxX = Math.max(...xs.map((v) => v[1]));
  const width = maxX - minX;
  if (width < pageW * 0.3) return null;
  const topY = Math.max(...lines.map((l) => l.y));
  const botY = Math.min(...lines.map((l) => l.y));
  const height = topY - botY;
  if (height <= 0) return null;

  let best: { score: number; gx: number; top: number } | null = null;
  for (let gx = minX + width * 0.15; gx <= minX + width * 0.85; gx += 1) {
    const leftLines: RawLine[] = [];
    const rightLines: RawLine[] = [];
    for (const l of lines) {
      if (l.items.some((i) => i.x1 <= gx + 0.5)) leftLines.push(l);
      if (l.items.some((i) => i.x >= gx - 0.5)) rightLines.push(l);
    }
    if (leftLines.length < 5 || rightLines.length < 5) continue;
    const lTop = Math.max(...leftLines.map((l) => l.y));
    const lBot = Math.min(...leftLines.map((l) => l.y));
    const rTop = Math.max(...rightLines.map((l) => l.y));
    const rBot = Math.min(...rightLines.map((l) => l.y));
    const oTop = Math.min(lTop, rTop);
    const oBot = Math.max(lBot, rBot);
    if (oTop - oBot < height * 0.4) continue;
    const inOverlap = lines.filter((l) => l.y <= oTop + 0.5 && l.y >= oBot - 0.5);
    const crossing = inOverlap.filter((l) => l.items.some((i) => i.x < gx - 0.5 && i.x1 > gx + 0.5)).length;
    if (crossing > inOverlap.length * 0.08) continue;

    const sideText = (l: RawLine, side: "l" | "r") =>
      l.items
        .filter((i) => (side === "l" ? i.x1 <= gx + 0.5 : i.x >= gx - 0.5))
        .map((i) => i.str)
        .join(" ");
    const lt = leftLines.map((l) => sideText(l, "l"));
    const rt = rightLines.map((l) => sideText(l, "r"));
    const lContent = lt.filter((t) => !isDateLike(t));
    const rContent = rt.filter((t) => !isDateLike(t));
    if (lContent.length < lt.length * 0.6 || rContent.length < rt.length * 0.6) continue;
    const lWordy = lContent.filter((t) => wordCount(t) >= 3).length;
    const rWordy = rContent.filter((t) => wordCount(t) >= 3).length;
    // One side must be a real text column; the other may be a list-like sidebar.
    if (Math.max(lWordy, rWordy) < 5 || lContent.length < 4 || rContent.length < 4) continue;

    const score = Math.min(lContent.length, rContent.length) - crossing * 3;
    if (!best || score > best.score) best = { score, gx, top: oTop };
  }
  if (!best) return null;

  const gx = best.gx;
  const mixed: string[] = [];
  for (const l of lines) {
    const left = l.items.filter((i) => i.x1 <= gx + 0.5);
    const right = l.items.filter((i) => i.x >= gx - 0.5);
    if (left.length && right.length) {
      const segs = segmentsOf(l)
        .map((s) => s.text)
        .join("   ");
      if (wordCount(segs) >= 3) mixed.push(truncate(segs));
    }
    if (mixed.length >= 3) break;
  }
  return { mixed, gx, top: best.top };
}

/**
 * Column-aware reading order for a page with a detected gutter: full-width
 * lines above the columns, then the whole left column, then the right one.
 */
function columnOrder(lines: RawLine[], gx: number, top: number): RawLine[] {
  const head: RawLine[] = [];
  const left: RawLine[] = [];
  const right: RawLine[] = [];
  for (const l of lines) {
    const spans = l.items.some((i) => i.x < gx - 0.5 && i.x1 > gx + 0.5);
    if (spans) {
      (l.y > top + 0.5 ? head : left).push(l);
      continue;
    }
    const li = l.items.filter((i) => i.x1 <= gx + 0.5);
    const ri = l.items.filter((i) => i.x >= gx - 0.5);
    if (li.length) left.push({ ...l, items: li, size: Math.max(...li.map((i) => i.size)) });
    if (ri.length) right.push({ ...l, items: ri, size: Math.max(...ri.map((i) => i.size)) });
  }
  return [...head, ...left, ...right];
}

/* ---------------- graphics ---------------- */

type Mat = [number, number, number, number, number, number];
const mul = (m: Mat, n: number[]): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function bboxOf(m: Mat, x0: number, y0: number, x1: number, y1: number) {
  const pts = [apply(m, x0, y0), apply(m, x1, y0), apply(m, x0, y1), apply(m, x1, y1)];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

function collectGraphics(fnArray: number[], argsArray: unknown[], OPS: Record<string, number>, page: number, pageArea: number): PlacedGraphic[] {
  const out: PlacedGraphic[] = [];
  const imageOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat, OPS.paintSolidColorImageMask].filter((x) => x !== undefined));
  const fillOps = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].filter((x) => x !== undefined));
  const stack: Mat[] = [];
  let ctm: Mat = [1, 0, 0, 1, 0, 0];
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] as unknown[] | null;
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform && args) ctm = mul(ctm, args as number[]);
    else if (fn === OPS.paintFormXObjectBegin && args) {
      stack.push(ctm);
      const m = args[0] as number[] | null;
      if (m && m.length === 6) ctm = mul(ctm, Array.from(m));
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (imageOps.has(fn)) {
      const { w, h } = bboxOf(ctm, 0, 0, 1, 1);
      if (w < 1 || h < 1) continue;
      out.push({ kind: "image", widthPt: round1(w), heightPt: round1(h), page, pageFraction: round3((w * h) / pageArea) });
    } else if (fn === OPS.constructPath && args) {
      const op = args[0] as number;
      const mm = args[2] as ArrayLike<number> | null;
      if (!fillOps.has(op) || !mm || mm.length < 4) continue;
      const { w, h } = bboxOf(ctm, mm[0], mm[1], mm[2], mm[3]);
      // Ignore page backgrounds and hairline rules/borders.
      if (Math.min(w, h) < 2.5 || (w * h) / pageArea > 0.5) continue;
      out.push({ kind: "shape", widthPt: round1(w), heightPt: round1(h), page, pageFraction: round3((w * h) / pageArea) });
    }
  }
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
