/**
 * PDF renderer using pdf-lib's standard-14 fonts (Helvetica / Times).
 * Real, selectable text drawn in reading order, with word-wrapping, page
 * breaks and the same hierarchy as the DOCX.
 *
 * ATS-safe templates draw one column. Decoration (header band, rules,
 * accent bars) is vector paint underneath real text. Creative templates
 * draw two columns (side column first, then main).
 *
 * Standard fonts only cover WinAnsi, so every string goes through the
 * sanitiser in sanitize.ts first. It never throws on input text.
 */
import {
  PDFDocument,
  StandardFonts,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setCharacterSpacing,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import type { ResumeContent, TemplateId } from "@/lib/types";
import { buildDocument, contactRows, initials, normalizeContent, splitContactRows, type Block, type Run } from "./layout";
import { makeSanitizer } from "./sanitize";
import { TEMPLATES, type TemplateStyle } from "./templates";

export { makeSanitizer };

/** US Letter. Points. */
const PAGE_W = 612;
const PAGE_H = 792;

/* ------------------------------ text primitives ------------------------------ */

interface Family {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
}

interface Fonts extends Family {
  /** Name, monogram and heading family (the body family unless the style sets `display`). */
  display: Family;
}

interface Seg {
  text: string;
  font: PDFFont;
  color: RGB;
}

interface Line {
  segs: Seg[];
  width: number;
}

/**
 * Advance width without kerning. pdf-lib's widthOfTextAtSize applies kern
 * pairs, but drawText emits plain Tj (no kerning), so the two would disagree
 * and following segments / right-aligned text would be misplaced.
 */
const glyphCache = new WeakMap<PDFFont, Map<string, number>>();
function textWidth(font: PDFFont, text: string, size: number, tracking = 0): number {
  let cache = glyphCache.get(font);
  if (!cache) glyphCache.set(font, (cache = new Map()));
  let w = 0;
  let n = 0;
  for (const ch of text) {
    let cw = cache.get(ch);
    if (cw === undefined) cache.set(ch, (cw = font.widthOfTextAtSize(ch, 1000)));
    w += cw;
    n++;
  }
  return (w * size) / 1000 + tracking * n;
}

const hex = (h: string): RGB =>
  rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);

type ColorKey = "text" | "muted" | "accent" | "rule" | "heading" | "headline" | "name" | "date";
type Palette = Record<ColorKey, RGB>;

function palette(c: Record<ColorKey, string>): Palette {
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, hex(v)])) as Palette;
}

/* ------------------------------ pages ------------------------------ */

/** Shared page list for one or two columns; paints backgrounds when a page is created. */
class Pager {
  readonly pages: PDFPage[] = [];
  constructor(
    private readonly doc: PDFDocument,
    private readonly paint: (page: PDFPage, index: number) => void,
  ) {}
  get(i: number): PDFPage {
    while (this.pages.length <= i) {
      const p = this.doc.addPage([PAGE_W, PAGE_H]);
      this.pages.push(p);
      this.paint(p, this.pages.length - 1);
    }
    return this.pages[i];
  }
}

interface Frame {
  left: number;
  width: number;
  /** Top y on the first page / on later pages. */
  firstTop: number;
  top: number;
  bottom: number;
}

interface Ctx {
  pager: Pager;
  fonts: Fonts;
  style: TemplateStyle;
  clean: (s: string) => string;
}

/* ------------------------------ column renderer ------------------------------ */

class Column {
  private pageIndex = 0;
  /** Kind of the last block drawn, for spacing across render calls. */
  private prevKind: Block["kind"] | null = null;
  y: number;
  private readonly lhFactor: number;

  constructor(
    private readonly ctx: Ctx,
    private readonly frame: Frame,
    private readonly colors: Palette,
    private readonly opts: { timeline?: boolean; side?: boolean; startPage?: number } = {},
  ) {
    this.pageIndex = opts.startPage ?? 0;
    this.y = frame.firstTop;
    this.lhFactor = 1.24 * ctx.style.leading;
    ctx.pager.get(this.pageIndex);
  }

  get page() {
    return this.ctx.pager.get(this.pageIndex);
  }
  get pageNumber() {
    return this.pageIndex;
  }
  private get style() {
    return this.ctx.style;
  }
  private get fonts() {
    return this.ctx.fonts;
  }
  private get right() {
    return this.frame.left + this.frame.width;
  }
  /** Left edge of body text (after the timeline date column). */
  private get textLeft() {
    return this.frame.left + (this.opts.timeline ? this.style.dateColumn : 0);
  }

  private sz(n: number) {
    return n * this.style.pdfScale;
  }
  private lh(size: number, factor = this.lhFactor) {
    return size * factor;
  }

  private newPage() {
    this.pageIndex++;
    this.y = this.frame.top;
    this.ctx.pager.get(this.pageIndex);
  }

  private atTop() {
    return this.y >= (this.pageIndex === 0 ? this.frame.firstTop : this.frame.top) - 0.01;
  }

  /** Vertical gap, skipped at the top of a page. */
  gap(pts: number) {
    if (!this.atTop()) this.y -= pts;
  }

  /** Start a new page unless `h` points still fit. */
  private ensure(h: number) {
    if (this.y - h < this.frame.bottom && !this.atTop()) this.newPage();
  }

  private fontFor(r: Run, fam: Family = this.fonts): PDFFont {
    if (r.bold && r.italic) return fam.boldItalic;
    if (r.bold) return fam.bold;
    if (r.italic) return fam.italic;
    return fam.regular;
  }

  private colorFor(r: Run, fallback: RGB): RGB {
    return r.tone === "muted" ? this.colors.muted : r.tone === "accent" ? this.colors.accent : fallback;
  }

  /** Greedy word wrap of styled runs into lines no wider than maxWidth. */
  wrap(runs: Run[], maxWidth: number, size: number, color: RGB = this.colors.text, tracking = 0, fam: Family = this.fonts): Line[] {
    type Tok = Seg & { space: boolean };
    const toks: Tok[] = [];
    for (const r of runs) {
      const text = this.ctx.clean(r.text);
      const font = this.fontFor(r, fam);
      const c = this.colorFor(r, color);
      for (const part of text.split(/( +)/)) {
        if (part) toks.push({ text: part, font, color: c, space: part.trim() === "" });
      }
    }

    const lines: Seg[][] = [];
    let cur: Seg[] = [];
    let curW = 0;
    let pending: Seg | null = null;
    const w = (s: Seg) => textWidth(s.font, s.text, size, tracking);
    const flush = () => {
      if (cur.length) lines.push(cur);
      cur = [];
      curW = 0;
      pending = null;
    };

    for (const t of toks) {
      if (t.space) {
        if (cur.length) pending = { text: t.text, font: t.font, color: t.color };
        continue;
      }
      let word: Seg = { text: t.text, font: t.font, color: t.color };
      let ww = w(word);
      const spaceW = pending ? w(pending) : 0;
      if (cur.length && curW + spaceW + ww > maxWidth) flush();

      // Words wider than the line (long URLs): hard-break by character.
      while (ww > maxWidth && word.text.length > 1) {
        let n = word.text.length - 1;
        while (n > 1 && textWidth(word.font, word.text.slice(0, n), size, tracking) > maxWidth - curW) n--;
        cur.push({ ...word, text: word.text.slice(0, n) });
        flush();
        word = { ...word, text: word.text.slice(n) };
        ww = w(word);
      }

      if (pending && cur.length) {
        cur.push(pending);
        curW += w(pending);
      }
      pending = null;
      cur.push(word);
      curW += ww;
    }
    flush();

    // Merge neighbouring segments that share font and colour (cleaner text extraction).
    return lines.map((segs) => {
      const merged: Seg[] = [];
      for (const s of segs) {
        const last = merged[merged.length - 1];
        if (last && last.font === s.font && last.color === s.color) last.text += s.text;
        else merged.push({ ...s });
      }
      return { segs: merged, width: merged.reduce((a, s) => a + w(s), 0) };
    });
  }

  private baselineFor(size: number, lh: number) {
    return this.y - lh / 2 - size * 0.34;
  }

  /** Draw one line in a box of height lh at the cursor, then advance. Returns the baseline. */
  private drawLine(line: Line, x: number, size: number, lh: number, tracking = 0) {
    const baseline = this.baselineFor(size, lh);
    let cx = x;
    if (tracking) this.page.pushOperators(pushGraphicsState(), setCharacterSpacing(tracking));
    for (const s of line.segs) {
      this.page.drawText(s.text, { x: cx, y: baseline, size, font: s.font, color: s.color });
      cx += textWidth(s.font, s.text, size, tracking);
    }
    if (tracking) this.page.pushOperators(popGraphicsState());
    this.y -= lh;
    return baseline;
  }

  private alignedX(width: number, center: boolean) {
    return center ? this.frame.left + (this.frame.width - width) / 2 : this.frame.left;
  }

  /* ---------------- header ---------------- */

  /** Lay out name / headline / contact. `stack` puts each contact part on its own line (side column). */
  private headerItems(blocks: Block[], colors: { name: RGB; headline: RGB; contact: RGB }, stack: boolean, maxWidth = this.frame.width) {
    const s = this.style.size;
    const items: { kind: Block["kind"]; lines: Line[]; size: number; lh: number; tracking: number; gapAfter: number }[] = [];
    for (const b of blocks) {
      if (b.kind === "name") {
        const size = this.sz(s.name);
        const tracking = this.style.name.tracking;
        const text = this.style.name.caps ? b.text.toUpperCase() : b.text;
        const lines = this.wrap([{ text, bold: this.style.name.bold ?? true }], maxWidth, size, colors.name, tracking, this.fonts.display);
        items.push({ kind: b.kind, lines, size, lh: size * 1.18, tracking, gapAfter: 3 });
      } else if (b.kind === "headline") {
        const size = this.sz(s.headline);
        const h = this.style.headline;
        const text = h.caps ? b.text.toUpperCase() : b.text;
        items.push({ kind: b.kind, lines: this.wrap([{ text, bold: h.bold, italic: h.italic }], maxWidth, size, colors.headline, h.tracking), size, lh: this.lh(size, 1.3), tracking: h.tracking, gapAfter: stack ? 10 : 3 });
      } else if (b.kind === "contact") {
        const size = this.sz(s.contact);
        const parts = b.parts.map(this.ctx.clean).filter(Boolean);
        const rows = stack
          ? parts
          : contactRows(parts, this.style.contactSep, maxWidth, (t) => textWidth(this.fonts.regular, t, size));
        const lines = rows.flatMap((r) => this.wrap([{ text: r }], maxWidth, size, colors.contact));
        items.push({ kind: b.kind, lines, size, lh: this.lh(size, stack ? 1.45 : 1.35), tracking: 0, gapAfter: 0 });
      }
    }
    return items;
  }

  private headerHeight(items: ReturnType<Column["headerItems"]>) {
    return items.reduce((h, it, i) => h + it.lines.length * it.lh + (i < items.length - 1 ? it.gapAfter : 0), 0);
  }

  private drawHeaderItems(items: ReturnType<Column["headerItems"]>, center: boolean) {
    items.forEach((it, i) => {
      for (const line of it.lines) {
        this.ensure(it.lh);
        this.drawLine(line, this.alignedX(line.width, center), it.size, it.lh, it.tracking);
      }
      if (i < items.length - 1) this.y -= it.gapAfter;
    });
  }

  renderHeader(blocks: Block[], { stack = false }: { stack?: boolean } = {}) {
    if (!blocks.length) return;
    const colors = { name: this.colors.name, headline: this.colors.headline, contact: this.colors.muted };
    if (!stack && this.style.headerStyle === "split") this.drawSplitHeader(blocks, colors);
    else if (!stack && this.style.headerStyle === "monogram" && this.style.monogram && this.hasInitials(blocks)) this.drawMonogramHeader(blocks, colors);
    else {
      const center = this.style.headerAlign === "center" && !stack;
      this.drawHeaderItems(this.headerItems(blocks, colors, stack), center);
    }
    this.y -= 3;
    if (!stack) this.headerRule();
    this.prevKind = "contact";
  }

  /** A monogram needs a name with usable initials; otherwise the plain stacked header is drawn. */
  private hasInitials(blocks: Block[]) {
    const name = blocks.find((b) => b.kind === "name");
    return name?.kind === "name" && !!this.ctx.clean(initials(name.text)).trim();
  }

  /** Rule under the header block (single or double). */
  private headerRule() {
    const r = this.style.headerRule;
    if (!r) return;
    this.y -= Math.max(0, r.space - 3);
    const x0 = this.frame.left;
    const x1 = this.right;
    const color = hex(r.color);
    if (r.double) {
      this.page.drawLine({ start: { x: x0, y: this.y }, end: { x: x1, y: this.y }, thickness: r.weight, color });
      this.y -= r.weight + 1.6;
      this.page.drawLine({ start: { x: x0, y: this.y }, end: { x: x1, y: this.y }, thickness: r.weight, color });
    } else {
      this.page.drawLine({ start: { x: x0, y: this.y - r.weight / 2 }, end: { x: x1, y: this.y - r.weight / 2 }, thickness: r.weight, color });
    }
    this.y -= r.weight + 2;
  }

  /** Name and headline on the left; contact rows right-aligned on the same baselines. */
  private drawSplitHeader(blocks: Block[], colors: { name: RGB; headline: RGB; contact: RGB }) {
    const size = this.sz(this.style.size.contact);
    const contact = blocks.find((b) => b.kind === "contact");
    const parts = contact && contact.kind === "contact" ? contact.parts.map(this.ctx.clean).filter(Boolean) : [];
    const measure = (t: string) => textWidth(this.fonts.regular, t, size);
    const rows = splitContactRows(parts, this.style.contactSep, this.frame.width * 0.56, this.style.size.contact);
    const rightW = rows.reduce((m, r) => Math.max(m, measure(r)), 0);
    const leftItems = this.headerItems(blocks.filter((b) => b.kind !== "contact"), colors, false, this.frame.width - rightW - 18);
    const left = leftItems.flatMap((it) => it.lines.map((line, i) => ({ line, it, last: i === it.lines.length - 1 })));
    const contactLh = this.lh(size, 1.35);
    const n = Math.max(left.length, rows.length);
    for (let i = 0; i < n; i++) {
      const l = left[i];
      const lh = l ? l.it.lh : contactLh;
      this.ensure(lh);
      const baseline = l ? this.drawLine(l.line, this.frame.left, l.it.size, lh, l.it.tracking) : this.baselineFor(size, lh);
      if (!l) this.y -= lh;
      if (rows[i]) this.page.drawText(rows[i], { x: this.right - measure(rows[i]), y: baseline, size, font: this.fonts.regular, color: colors.contact });
      if (l && l.last && i < n - 1) this.y -= l.it.gapAfter - 1;
    }
  }

  /** Large initials on the name line; name, headline and contact indented beside them. */
  private drawMonogramHeader(blocks: Block[], colors: { name: RGB; headline: RGB; contact: RGB }) {
    const m = this.style.monogram!;
    const name = blocks.find((b) => b.kind === "name");
    const mono = name && name.kind === "name" ? this.ctx.clean(initials(name.text)) : "";
    const monoSize = this.sz(m.size);
    // Wide initials ("MW") push the name block right, so a clear gap (wider than
    // text extractors' word spacing) always separates the initials from the name.
    const monoW = mono ? textWidth(this.fonts.display.regular, mono, monoSize, 1) : 0;
    const indent = Math.max(m.width, monoW + 1.6 * this.sz(this.style.size.name));
    const items = this.headerItems(blocks, colors, false, this.frame.width - indent);
    items.forEach((it, idx) => {
      it.lines.forEach((line, li) => {
        // The first name line grows to fit the initials; both share its baseline.
        const withMono = it.kind === "name" && li === 0 && !!mono;
        const lh = withMono ? Math.max(it.lh, monoSize * 1.08) : it.lh;
        this.ensure(lh);
        const baseline = this.baselineFor(withMono ? monoSize : it.size, lh);
        if (withMono) {
          this.page.pushOperators(pushGraphicsState(), setCharacterSpacing(1));
          this.page.drawText(mono, { x: this.frame.left, y: baseline, size: monoSize, font: this.fonts.display.regular, color: hex(m.color) });
          this.page.pushOperators(popGraphicsState());
        }
        let cx = this.frame.left + indent;
        if (it.tracking) this.page.pushOperators(pushGraphicsState(), setCharacterSpacing(it.tracking));
        for (const sgm of line.segs) {
          this.page.drawText(sgm.text, { x: cx, y: baseline, size: it.size, font: sgm.font, color: sgm.color });
          cx += textWidth(sgm.font, sgm.text, it.size, it.tracking);
        }
        if (it.tracking) this.page.pushOperators(popGraphicsState());
        this.y -= lh;
      });
      if (idx < items.length - 1) this.y -= it.gapAfter;
    });
  }

  /** Header on a filled band: a rectangle painted first, real text on top. */
  renderBandHeader(blocks: Block[]) {
    const band = this.style.band!;
    const items = this.headerItems(
      blocks,
      { name: hex(band.name), headline: hex(band.headline), contact: hex(band.contact) },
      false,
    );
    const h = this.headerHeight(items);
    const pad = band.pad;
    this.page.drawRectangle({
      x: this.frame.left - pad,
      y: this.y - h - pad,
      width: this.frame.width + pad * 2,
      height: h + pad * 2,
      color: hex(band.fill),
    });
    this.drawHeaderItems(items, this.style.headerAlign === "center");
    this.y -= pad + 4;
    this.prevKind = "contact";
  }

  /** Height of name / headline / contact for a creative band header. */
  bandHeaderHeight(blocks: Block[]) {
    return this.headerHeight(this.headerItems(blocks, { name: this.colors.name, headline: this.colors.headline, contact: this.colors.muted }, false));
  }

  /** Name / headline / contact in the band's colours, starting at the cursor. */
  renderBandText(blocks: Block[], band: { name: string; headline: string; contact: string }) {
    const items = this.headerItems(blocks, { name: hex(band.name), headline: hex(band.headline), contact: hex(band.contact) }, false);
    this.drawHeaderItems(items, false);
  }

  /* ---------------- headings ---------------- */

  /** Small caps: capitals at full size, lower-case letters as capitals at 78%. */
  private smallCapsRuns(text: string, size: number): { text: string; size: number }[] {
    const out: { text: string; size: number }[] = [];
    for (const ch of text) {
      const lower = ch !== ch.toUpperCase();
      const s = lower ? size * 0.78 : size;
      const t = lower ? ch.toUpperCase() : ch;
      const last = out[out.length - 1];
      if (last && last.size === s) last.text += t;
      else out.push({ text: t, size: s });
    }
    return out;
  }

  private heading(text: string, prev: Block["kind"] | null) {
    const h = this.style.heading;
    const size = this.sz(this.style.size.heading);
    const lh = this.lh(size, 1.35);
    const bodyLh = this.lh(this.sz(this.style.size.body));
    // Side columns keep plain headings: bands and bars are for the single-column templates.
    const fill = !this.opts.side && h.fill ? hex(h.fill) : null;
    const bar = !this.opts.side && h.bar ? h.bar : 0;
    const topRule = h.rule > 0 && h.ruleStyle === "top";
    const padY = fill ? 3.5 : 0;
    this.gap(prev === null ? 0 : prev === "contact" ? Math.max(8, h.before - 4) : h.before);
    // Keep the heading with at least two following lines.
    this.ensure(lh + h.after + bodyLh * 2 + padY * 2 + (topRule ? h.rule + 5 : 0));
    if (topRule) {
      this.page.drawLine({ start: { x: this.textLeft, y: this.y - h.rule / 2 }, end: { x: this.right, y: this.y - h.rule / 2 }, thickness: h.rule, color: this.colors.rule });
      this.y -= h.rule + 4;
    }
    if (fill) {
      // Tinted band behind the heading text, slightly wider than the text column:
      // painted as one thick stroke, like the other rules (no fill shapes).
      const bandH = lh + padY * 2;
      const midY = this.y - bandH / 2;
      this.page.drawLine({ start: { x: this.textLeft - 5, y: midY }, end: { x: this.right + 5, y: midY }, thickness: bandH, color: fill });
      this.y -= padY;
    }
    const baseline = this.baselineFor(size, lh);
    const font = this.fonts.display.bold;
    const color = this.colors.heading;
    // Wide letter-spacing makes PDF text extractors read "S U M M A R Y"; cap it at 0.07 em.
    const tracking = Math.min(h.tracking, size * 0.07);
    const clean = this.ctx.clean(text);
    const runs = h.caps === "small" ? this.smallCapsRuns(clean, size) : [{ text: h.caps === "all" ? clean.toUpperCase() : clean, size }];
    const textW = runs.reduce((w, r) => w + textWidth(font, r.text, r.size, tracking), 0);
    // Timeline: headings sit in the content column so the left column holds only dates.
    const colLeft = this.textLeft;
    const center = h.align === "center";
    const x = center ? colLeft + (this.right - colLeft - textW) / 2 : colLeft + (bar ? bar + 6 : 0);
    if (bar) {
      // Accent bar at the column edge, the height of the heading's capitals.
      this.page.drawLine({ start: { x: colLeft + bar / 2, y: baseline - size * 0.22 }, end: { x: colLeft + bar / 2, y: baseline + size * 0.9 }, thickness: bar, color: this.colors.accent });
    }
    let endX = x;
    this.page.pushOperators(pushGraphicsState(), setCharacterSpacing(tracking));
    for (const r of runs) {
      this.page.drawText(r.text, { x: endX, y: baseline, size: r.size, font, color });
      endX += textWidth(font, r.text, r.size, tracking);
    }
    this.page.pushOperators(popGraphicsState());
    this.y -= lh;
    if (fill) this.y -= padY;
    if (h.rule > 0 && !topRule) {
      const ruleY = baseline - size * 0.42 - (h.ruleStyle === "short" ? 1.5 : 0);
      const barW = Math.min(30, this.frame.width);
      const start = h.ruleStyle === "short" && center ? colLeft + (this.right - colLeft - barW) / 2 : x;
      const end = h.ruleStyle === "short" ? start + barW : this.right;
      this.page.drawLine({ start: { x: h.ruleStyle === "short" ? start : colLeft, y: ruleY }, end: { x: end, y: ruleY }, thickness: h.rule, color: this.colors.rule });
      if (h.ruleStyle === "short") this.y -= 3;
    }
    this.y -= h.after;
  }

  /* ---------------- body ---------------- */

  render(blocks: Block[]) {
    const s = this.style.size;
    const body = this.sz(s.body);
    const bodyLh = this.lh(body);
    const timeline = !!this.opts.timeline;
    const left = this.textLeft;
    const width = this.right - left;
    let prev = this.prevKind;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      switch (b.kind) {
        case "name":
        case "headline":
        case "contact":
          // Header blocks are drawn by renderHeader / renderBandHeader.
          break;

        case "heading":
          this.heading(b.text, prev);
          break;

        case "entry": {
          this.gap(b.first ? 0 : this.style.entryGap);
          const right = this.ctx.clean(b.right);
          const dateFont = this.fonts.regular;
          const rightW = right ? textWidth(dateFont, right, body) : 0;
          const subSize = this.sz(s.sub);
          const subLh = this.lh(subSize);
          const firstBodyLine = blocks[i + 1]?.kind === "bullet" ? bodyLh : 0;

          if (b.stack) {
            // Narrow column: title, sub, then dates on their own muted line.
            const leftLines = this.wrap(b.left, width, body);
            const subLines = b.sub ? this.wrap(b.sub, width, subSize) : [];
            this.ensure(leftLines.length * bodyLh + subLines.length * subLh + (right ? subLh : 0));
            for (const l of leftLines) this.drawLine(l, left, body, bodyLh);
            for (const l of subLines) this.drawLine(l, left, subSize, subLh);
            if (right) {
              const [l] = this.wrap([{ text: right, tone: "muted" }], width, subSize);
              if (l) this.drawLine(l, left, subSize, subLh);
            }
            this.y -= 2;
            break;
          }

          // Timeline: dates in the left column; otherwise right-aligned on line 1.
          const dateInColumn = timeline && rightW <= this.style.dateColumn - 6;
          const leftWidth = timeline ? width : width - (rightW ? rightW + 14 : 0);
          const leftLines = this.wrap(b.left, leftWidth, body);
          const subLines = b.sub ? this.wrap(b.sub, width, subSize) : [];
          if (timeline && right && !dateInColumn) {
            // Date wider than its column: give it its own line above.
            this.ensure(bodyLh * (1 + leftLines.length) + firstBodyLine);
            const [l] = this.wrap([{ text: right }], width, body, this.colors.date);
            if (l) this.drawLine(l, left, body, bodyLh);
          }
          this.ensure(leftLines.length * bodyLh + subLines.length * subLh + firstBodyLine);

          leftLines.forEach((line, idx) => {
            const baseline = this.drawLine(line, left, body, bodyLh);
            if (idx === 0 && right && (!timeline || dateInColumn)) {
              const x = timeline ? this.frame.left : this.right - rightW;
              this.page.drawText(right, { x, y: baseline, size: body, font: dateFont, color: this.colors.date });
            }
          });
          if (!leftLines.length && right && !timeline) {
            const baseline = this.baselineFor(body, bodyLh);
            this.page.drawText(right, { x: this.right - rightW, y: baseline, size: body, font: dateFont, color: this.colors.date });
            this.y -= bodyLh;
          }
          for (const line of subLines) {
            this.ensure(subLh);
            this.drawLine(line, left, subSize, subLh);
          }
          this.y -= 2;
          break;
        }

        case "bullet": {
          const bulletX = left + 6;
          const textX = left + 18;
          const lines = this.wrap(b.runs, this.right - textX, body);
          lines.forEach((line, idx) => {
            this.ensure(bodyLh);
            const baseline = this.drawLine(line, textX, body, bodyLh);
            if (idx === 0) {
              this.page.drawText("•", { x: bulletX, y: baseline, size: body, font: this.fonts.regular, color: this.colors.accent });
            }
          });
          this.y -= 1.5;
          break;
        }

        case "para":
        case "line": {
          let size = body;
          // Side column: shrink a single unbreakable token (a long URL or email) to fit rather than split it.
          if (this.opts.side && b.kind === "line" && b.runs.length === 1 && !/\s/.test(b.runs[0].text.trim())) {
            const w = textWidth(this.fontFor(b.runs[0]), this.ctx.clean(b.runs[0].text), body);
            // 0.99: sized to exactly `width`, float error would wrap the last character.
            if (w > width) size = Math.max(body * 0.72, (body * width * 0.99) / w);
          }
          const lh = size === body ? bodyLh : this.lh(size);
          for (const line of this.wrap(b.runs, width, size)) {
            this.ensure(lh);
            this.drawLine(line, left, size, lh);
          }
          this.y -= b.kind === "line" && !b.last ? (this.opts.side ? 2.5 : 1.5) : 2;
          break;
        }

        case "chips": {
          const size = this.sz(s.sub) * 0.92;
          const padX = 5.5;
          const chipH = size + 7;
          const gapX = 4;
          const gapY = 4.5;
          const fill = hex(this.style.columns?.chipFill ?? "EEEEEE");
          let x = left;
          this.ensure(chipH);
          for (const item of b.items) {
            const text = this.ctx.clean(item);
            if (!text) continue;
            const w = Math.min(textWidth(this.fonts.regular, text, size) + padX * 2, width);
            if (x > left && x + w > this.right + 0.01) {
              x = left;
              this.y -= chipH + gapY;
              this.ensure(chipH);
            }
            const top = this.y;
            this.page.drawRectangle({ x, y: top - chipH, width: w, height: chipH, color: fill });
            this.page.drawText(text, {
              x: x + padX,
              y: top - chipH / 2 - size * 0.34,
              size,
              font: this.fonts.regular,
              color: this.colors.text,
            });
            x += w + gapX;
          }
          this.y -= chipH + 2;
          break;
        }
      }
      prev = b.kind;
    }
    this.prevKind = prev;
  }
}

/* ------------------------------ document ------------------------------ */

export async function renderPdf(input: ResumeContent, template: TemplateId): Promise<Uint8Array> {
  const style = TEMPLATES[template];
  const content = normalizeContent(input);
  const doc = await PDFDocument.create();

  const familyOf = (f: "helvetica" | "times") =>
    f === "times"
      ? [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic]
      : [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique];
  const embed = async (f: "helvetica" | "times"): Promise<Family> => {
    const [regular, bold, italic, boldItalic] = await Promise.all(familyOf(f).map((x) => doc.embedFont(x)));
    return { regular, bold, italic, boldItalic };
  };
  const body = await embed(style.pdfFont);
  const display = style.display && style.display.pdf !== style.pdfFont ? await embed(style.display.pdf) : body;
  const fonts: Fonts = { ...body, display };
  const { regular } = body;
  const clean = makeSanitizer(new Set(regular.getCharacterSet()));
  const blocks = buildDocument(content, template);
  const mx = style.margin.x;
  const my = style.margin.y;
  const main = palette(style.color);

  const cols = style.columns;
  if (!cols) {
    const ctx: Ctx = { pager: new Pager(doc, () => {}), fonts, style, clean };
    const frame: Frame = { left: mx, width: PAGE_W - mx * 2, firstTop: PAGE_H - my, top: PAGE_H - my, bottom: my };
    const col = new Column(ctx, frame, main, { timeline: style.layout === "timeline" });
    if (style.band) col.renderBandHeader(blocks.header);
    else col.renderHeader(blocks.header);
    col.render(blocks.main);
  } else {
    const sidePalette = palette({
      ...style.color,
      text: cols.text,
      muted: cols.muted,
      heading: cols.heading,
      accent: cols.heading,
      rule: cols.heading,
      date: cols.muted,
    });
    const gutter = 26;
    // Divider layouts have no panel: no outer padding, the gutter is split around the rule.
    const inner = cols.divider ? 0 : cols.bleed ? 24 : 14;
    const innerIn = cols.divider ? 13 : inner;
    const mainGap = cols.divider ? 13 : gutter;
    // Side panel geometry (x0..x1) and text frames.
    const panelX0 = cols.bleed ? (cols.side === "left" ? 0 : PAGE_W - cols.width) : cols.side === "left" ? mx : PAGE_W - mx - cols.width;
    const panelX1 = panelX0 + cols.width;
    const mainLeft = cols.side === "left" ? panelX1 + mainGap : mx;
    const mainRight = cols.side === "left" ? PAGE_W - mx : panelX0 - mainGap;
    const sideLeft = cols.side === "left" ? panelX0 + inner : panelX0 + innerIn;
    const sideWidth = cols.width - inner - innerIn;
    let panelTopFirst = cols.bleed ? PAGE_H : PAGE_H - my;

    const paintPanel = (page: PDFPage, index: number) => {
      const top = index === 0 ? panelTopFirst : cols.bleed ? PAGE_H : PAGE_H - my;
      const bottom = cols.bleed ? 0 : my;
      if (cols.divider) {
        const x = cols.side === "left" ? panelX1 : panelX0;
        page.drawLine({ start: { x, y: top }, end: { x, y: bottom }, thickness: 0.6, color: hex(cols.divider) });
      } else page.drawRectangle({ x: panelX0, y: bottom, width: cols.width, height: top - bottom, color: hex(cols.fill) });
    };

    if (cols.header === "band" && cols.band) {
      // Full-bleed dark band with real text on top, a monogram tile above the side column.
      const band = cols.band;
      const ctx: Ctx = { pager: new Pager(doc, (p, i) => i > 0 && paintPanel(p, i)), fonts, style, clean };
      const textLeft = mainLeft;
      const textRight = mainRight;
      const probe = new Column(ctx, { left: textLeft, width: textRight - textLeft, firstTop: PAGE_H, top: PAGE_H, bottom: 0 }, main);
      const h = probe.bandHeaderHeight(blocks.header);
      const bandH = Math.max(band.height, h + 40);
      const page = ctx.pager.pages[0];
      page.drawRectangle({ x: 0, y: PAGE_H - bandH, width: PAGE_W, height: bandH, color: hex(band.fill) });
      const tileX = cols.side === "right" ? panelX0 : 0;
      page.drawRectangle({ x: tileX, y: PAGE_H - bandH, width: cols.width, height: bandH, color: hex(band.tile) });
      const mono = clean(initials(content.name));
      if (mono) {
        const size = Math.min(64, band.height * 0.42) * style.pdfScale;
        const w = textWidth(fonts.display.regular, mono, size, 2);
        page.pushOperators(pushGraphicsState(), setCharacterSpacing(2));
        page.drawText(mono, { x: tileX + (cols.width - w) / 2, y: PAGE_H - bandH / 2 - size * 0.34, size, font: fonts.display.regular, color: hex(band.tileText) });
        page.pushOperators(popGraphicsState());
      }
      probe.y = PAGE_H - (bandH - h) / 2;
      probe.renderBandText(blocks.header, band);
      panelTopFirst = PAGE_H - bandH;
      paintPanel(page, 0);
      const side = new Column(ctx, { left: sideLeft, width: sideWidth, firstTop: panelTopFirst - 22, top: PAGE_H - my - inner, bottom: my }, sidePalette, { side: true });
      side.render(blocks.side);
      const bodyCol = new Column(ctx, { left: mainLeft, width: mainRight - mainLeft, firstTop: panelTopFirst - 22, top: PAGE_H - my, bottom: my }, main);
      bodyCol.render(blocks.main);
    } else if (cols.header === "top") {
      // Full-width header first; page 1's panel starts below it.
      const ctx: Ctx = { pager: new Pager(doc, (p, i) => i > 0 && paintPanel(p, i)), fonts, style, clean };
      const head = new Column(ctx, { left: mx, width: PAGE_W - mx * 2, firstTop: PAGE_H - my, top: PAGE_H - my, bottom: my }, main);
      head.renderHeader(blocks.header);
      const tr = cols.topRule ?? { weight: 1.2, color: style.color.accent };
      const y = head.y - 16 - Math.max(0, tr.weight - 1.2);
      // Rule under the header, then the panel.
      ctx.pager.pages[0].drawLine({ start: { x: mx, y: y + 8 }, end: { x: PAGE_W - mx, y: y + 8 }, thickness: tr.weight, color: hex(tr.color) });
      panelTopFirst = y - 4;
      paintPanel(ctx.pager.pages[0], 0);
      const pad = cols.divider ? 4 : inner;
      const side = new Column(ctx, { left: sideLeft, width: sideWidth, firstTop: panelTopFirst - pad, top: PAGE_H - my - pad, bottom: my + pad }, sidePalette, { side: true });
      side.render(blocks.side);
      const body = new Column(ctx, { left: mainLeft, width: mainRight - mainLeft, firstTop: y - 4, top: PAGE_H - my, bottom: my }, main);
      body.render(blocks.main);
    } else {
      const ctx: Ctx = { pager: new Pager(doc, paintPanel), fonts, style, clean };
      const sideFrame: Frame = { left: sideLeft, width: sideWidth, firstTop: PAGE_H - my, top: PAGE_H - my, bottom: my };
      const side = new Column(ctx, sideFrame, sidePalette, { side: true });
      if (cols.header === "side") side.renderHeader(blocks.header, { stack: true });
      side.render(blocks.side);
      const body = new Column(ctx, { left: mainLeft, width: mainRight - mainLeft, firstTop: PAGE_H - my, top: PAGE_H - my, bottom: my }, main);
      // "main": name and headline open the main column; contact details sit in the side column.
      if (cols.header === "main") body.renderHeader(blocks.header);
      body.render(blocks.main);
    }
  }

  const title = content.name ? `${clean(content.name)} - Resume` : "Resume";
  doc.setTitle(title, { showInWindowTitleBar: false });
  if (content.name) doc.setAuthor(clean(content.name));
  doc.setSubject("Resume");
  doc.setCreator("Parsewise");
  doc.setProducer("Parsewise");
  doc.setLanguage("en-US");

  return doc.save({ useObjectStreams: false });
}
