/**
 * DOCX renderer.
 *
 * ATS-safe templates: one section, one column, no tables, no text boxes, no
 * images, nothing in headers/footers. Bullets are real Word list numbering;
 * section headings use the Heading 1 style. Decoration is paragraph-level:
 * colour, borders, shading behind body paragraphs, tab stops.
 *
 * Creative templates (style.columns) use a borderless two-cell table with a
 * shaded side cell. They are labelled "not for ATS uploads".
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  HeightRule,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  ShadingType,
  Tab,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
  type IParagraphOptions,
} from "docx";
import type { ResumeContent, TemplateId } from "@/lib/types";
import { buildDocument, contactRows, initials, normalizeContent, splitContactRows, type Block, type Run } from "./layout";
import { TEMPLATES, type TemplateStyle } from "./templates";

/** US Letter. Twips. */
const PAGE = { width: 12240, height: 15840 };

const pt = (n: number) => Math.round(n * 20); // points -> twips
const NBSP = "\u00a0";
const hp = (n: number) => Math.round(n * 2); // points -> half-points

type Colors = TemplateStyle["color"];

interface Ctx {
  style: TemplateStyle;
  colors: Colors;
  /** Text width available, twips. */
  width: number;
  timeline: boolean;
  /** Narrow side column: stacked contact parts and entries. */
  side: boolean;
  bulletRef: string;
}

function runs(list: Run[], ctx: Ctx, size: number, base?: string): TextRun[] {
  const c = ctx.colors;
  return list.map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic,
        size: hp(size),
        color: r.tone === "muted" ? c.muted : r.tone === "accent" ? c.accent : (base ?? c.text),
      }),
  );
}

/* ------------------------------ header ------------------------------ */

const displayFont = (style: TemplateStyle) => style.display?.docx ?? style.docxFont;
/** Rough average glyph width in em, for estimating contact-row breaks. Word does the real layout. */
const emOf = (font: string) => (/georgia|cambria|garamond|palatino|antiqua|trebuchet|tahoma|verdana|century/i.test(font) ? 0.55 : 0.52);

function nameRun(text: string, style: TemplateStyle, color: string, size = style.size.name): TextRun {
  return new TextRun({
    text,
    font: style.display ? displayFont(style) : undefined,
    bold: style.name.bold ?? true,
    allCaps: style.name.caps || undefined,
    characterSpacing: style.name.tracking ? pt(style.name.tracking) : undefined,
    size: hp(size),
    color,
  });
}

function headlineRun(text: string, style: TemplateStyle, color: string): TextRun {
  return new TextRun({
    text,
    bold: style.headline.bold || undefined,
    italics: style.headline.italic || undefined,
    allCaps: style.headline.caps || undefined,
    characterSpacing: style.headline.tracking ? pt(style.headline.tracking) : undefined,
    size: hp(style.size.headline),
    color,
  });
}

/** Space after the name line: a little more for very large names, so the headline never crowds it. */
const nameAfter = (style: TemplateStyle) => 2 + Math.max(0, style.size.name - 28) * 0.4;

/** Rule under the header block: a bottom border on its last paragraph. */
function headerRuleBorder(style: TemplateStyle): IParagraphOptions["border"] | undefined {
  const r = style.headerRule;
  if (!r) return undefined;
  return {
    bottom: {
      style: r.double ? BorderStyle.DOUBLE : BorderStyle.SINGLE,
      size: Math.max(2, Math.round(r.weight * 8)),
      color: r.color,
      space: Math.min(31, Math.round(r.space)),
    },
  };
}

/**
 * Split header: name and headline on the left, contact rows right-aligned on
 * the same lines with a right tab stop. One paragraph per line, no table.
 */
function splitHeader(blocks: Block[], ctx: Ctx): Paragraph[] {
  const { style } = ctx;
  const s = style.size;
  const name = blocks.find((b) => b.kind === "name");
  const headline = blocks.find((b) => b.kind === "headline");
  const contact = blocks.find((b) => b.kind === "contact");
  const rows = contact && contact.kind === "contact" ? splitContactRows(contact.parts, style.contactSep, (ctx.width / 20) * 0.56, s.contact) : [];
  const left: { runs: TextRun[]; after: number; line?: number }[] = [];
  if (name && name.kind === "name") left.push({ runs: [nameRun(name.text, style, ctx.colors.name)], after: nameAfter(style), line: 240 });
  if (headline && headline.kind === "headline") left.push({ runs: [headlineRun(headline.text, style, ctx.colors.headline)], after: 2 });
  const n = Math.max(left.length, rows.length);
  const out: Paragraph[] = [];
  for (let i = 0; i < n; i++) {
    const l = left[i];
    const last = i === n - 1;
    out.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: ctx.width }],
        spacing: { after: pt(last ? 0 : (l?.after ?? 1)), line: l?.line },
        border: last ? headerRuleBorder(style) : undefined,
        children: [
          ...(l?.runs ?? []),
          ...(rows[i] ? [new TextRun({ children: [new Tab(), rows[i]], size: hp(s.contact), color: ctx.colors.muted })] : []),
        ],
      }),
    );
  }
  return out;
}

/**
 * Monogram header: large initials as coloured text, then a tab to the name.
 * Headline and contact lines are indented to line up with the name.
 */
function monogramHeader(blocks: Block[], ctx: Ctx): Paragraph[] {
  const { style } = ctx;
  const m = style.monogram!;
  const s = style.size;
  const out: Paragraph[] = [];
  const name = blocks.find((b) => b.kind === "name");
  const mono = name && name.kind === "name" ? initials(name.text) : "";
  // Same rule as the PDF: wide initials push the name block right (estimated capital widths).
  const monoW = [...mono].reduce((w, ch) => w + (/[MW]/.test(ch) ? 0.92 : /[IJ]/.test(ch) ? 0.38 : 0.64), 0) * m.size + mono.length;
  const col = pt(Math.max(m.width, monoW + 1.6 * s.name));
  for (const b of blocks) {
    if (b.kind === "name") {
      out.push(
        new Paragraph({
          indent: { left: col, hanging: col },
          tabStops: [{ type: TabStopType.LEFT, position: col }],
          spacing: { after: pt(nameAfter(style)), line: 240 },
          children: [
            ...(mono
              ? [
                  new TextRun({ text: mono, font: displayFont(style), size: hp(m.size), color: m.color, characterSpacing: pt(1) }),
                  new TextRun({ children: [new Tab()], size: hp(s.name) }),
                ]
              : []),
            nameRun(b.text, style, ctx.colors.name),
          ],
        }),
      );
    } else if (b.kind === "headline") {
      out.push(new Paragraph({ indent: { left: col }, spacing: { after: pt(3) }, children: [headlineRun(b.text, style, ctx.colors.headline)] }));
    } else if (b.kind === "contact") {
      const rows = contactRows(b.parts, style.contactSep, (ctx.width - col) / 20, (t) => t.length * s.contact * emOf(style.docxFont));
      out.push(
        new Paragraph({
          indent: { left: col },
          spacing: { after: pt(4) },
          children: rows.map((text, i) => new TextRun({ text, break: i > 0 ? 1 : undefined, size: hp(s.contact), color: ctx.colors.muted })),
        }),
      );
    }
  }
  if (out.length && style.headerRule) {
    // Full-width rule (the paragraphs above are indented): a 2 pt paragraph carrying the border.
    out.push(new Paragraph({ border: headerRuleBorder(style), spacing: { before: 0, after: 0, line: 40, lineRule: LineRuleType.EXACT }, children: [new TextRun({ text: "", size: 2 })] }));
  }
  return out;
}

function headerParagraphs(blocks: Block[], ctx: Ctx, opts: { stack?: boolean; noRule?: boolean } = {}): Paragraph[] {
  const { style } = ctx;
  const s = style.size;
  if (!ctx.side && !opts.stack && !style.band && blocks.length) {
    if (style.headerStyle === "split") return splitHeader(blocks, ctx);
    // No usable initials (no name): fall back to the plain stacked header.
    const name = blocks.find((b) => b.kind === "name");
    if (style.headerStyle === "monogram" && style.monogram && name?.kind === "name" && initials(name.text)) return monogramHeader(blocks, ctx);
  }
  const band = ctx.side ? null : style.band;
  const align = style.headerAlign === "center" && !opts.stack ? AlignmentType.CENTER : AlignmentType.LEFT;
  const out: Paragraph[] = [];

  // Band: identical shading + same-colour borders on every header paragraph,
  // so Word and LibreOffice merge them into one padded block of colour.
  const bandBorder: IBorderOptions | undefined = band
    ? { style: BorderStyle.SINGLE, size: 4, color: band.fill, space: Math.min(31, band.pad) }
    : undefined;
  const bandProps: Partial<IParagraphOptions> = band
    ? {
        shading: { type: ShadingType.CLEAR, color: "auto", fill: band.fill },
        border: { top: bandBorder, bottom: bandBorder, left: bandBorder, right: bandBorder },
      }
    : {};
  const nameColor = band ? band.name : ctx.colors.name;
  const headlineColor = band ? band.headline : ctx.colors.headline;
  const contactColor = band ? band.contact : ctx.colors.muted;
  // Rule under the header: bottom border of the last header paragraph.
  const rule = !band && !opts.stack && !opts.noRule && !ctx.side ? headerRuleBorder(style) : undefined;
  const lastIdx = blocks.length - 1;

  blocks.forEach((b, idx) => {
    const border = idx === lastIdx ? rule : undefined;
    if (b.kind === "name") {
      out.push(
        new Paragraph({
          ...bandProps,
          ...(border ? { border } : {}),
          alignment: align,
          spacing: { after: pt(nameAfter(style)), line: 240 },
          children: [nameRun(b.text, style, nameColor)],
        }),
      );
    } else if (b.kind === "headline") {
      out.push(
        new Paragraph({
          ...bandProps,
          ...(border ? { border } : {}),
          alignment: align,
          spacing: { after: pt(opts.stack ? 10 : 3) },
          children: [headlineRun(b.text, style, headlineColor)],
        }),
      );
    } else if (b.kind === "contact") {
      if (opts.stack) {
        b.parts.forEach((part, i) =>
          out.push(
            new Paragraph({
              spacing: { after: pt(i === b.parts.length - 1 ? 4 : 2.5) },
              children: [new TextRun({ text: part, size: hp(s.contact), color: contactColor })],
            }),
          ),
        );
        return;
      }
      // Estimate widths (Word does the real layout) and break between parts,
      // so the line never wraps inside an email/URL or leaves a dangling "|".
      const rows = contactRows(b.parts, style.contactSep, ctx.width / 20, (t) => t.length * s.contact * emOf(style.docxFont));
      out.push(
        new Paragraph({
          ...bandProps,
          ...(border ? { border } : {}),
          alignment: align,
          spacing: { after: pt(4) },
          children: rows.map(
            (text, i) => new TextRun({ text, break: i > 0 ? 1 : undefined, size: hp(s.contact), color: contactColor }),
          ),
        }),
      );
    }
  });
  return out;
}

/* ------------------------------ body ------------------------------ */

function bodyParagraphs(blocks: Block[], ctx: Ctx, prevInit: Block["kind"] | null): Paragraph[] {
  const { style } = ctx;
  const s = style.size;
  const col = ctx.timeline ? pt(style.dateColumn) : 0;
  const out: Paragraph[] = [];
  let prev = prevInit;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    switch (b.kind) {
      case "name":
      case "headline":
      case "contact":
        break;

      case "heading": {
        const h = style.heading;
        const short = h.rule > 0 && h.ruleStyle === "short";
        const center = h.align === "center";
        const ruleSize = Math.max(2, Math.round(h.rule * 8));
        // Side columns keep plain headings: bands and bars are for the single-column templates.
        const fill = !ctx.side && h.fill ? h.fill : null;
        const bar = !ctx.side && h.bar ? h.bar : 0;
        const border: { top?: IBorderOptions; bottom?: IBorderOptions; left?: IBorderOptions; right?: IBorderOptions } = {};
        if (h.rule > 0 && h.ruleStyle === "full") border.bottom = { style: BorderStyle.SINGLE, size: ruleSize, color: ctx.colors.rule, space: 2 };
        if (h.rule > 0 && h.ruleStyle === "top") border.top = { style: BorderStyle.SINGLE, size: ruleSize, color: ctx.colors.rule, space: 5 };
        if (fill) {
          // Same-colour borders pad the shading into a band around the heading text.
          const pad = (space: number): IBorderOptions => ({ style: BorderStyle.SINGLE, size: 4, color: fill, space });
          Object.assign(border, { top: pad(3), bottom: pad(3), left: pad(5), right: pad(5) });
        }
        if (bar) border.left = { style: BorderStyle.SINGLE, size: Math.min(96, Math.round(bar * 8)), color: ctx.colors.accent, space: 6 };
        const firstGap = prev === null ? 0 : prev === "contact" ? Math.max(8, h.before - 4) : h.before;
        out.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            keepNext: true,
            keepLines: true,
            alignment: center ? AlignmentType.CENTER : undefined,
            indent: col ? { left: col } : bar ? { left: pt(bar + 6) } : undefined,
            shading: fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined,
            spacing: {
              before: pt(firstGap + (fill ? 3 : 0)),
              after: short ? 0 : pt(h.after + (fill ? 3 : 0)),
            },
            border: Object.keys(border).length ? border : undefined,
            children: [new TextRun({ text: b.text, color: ctx.colors.heading })],
          }),
        );
        if (short) {
          // A short accent bar: an empty, 2 pt paragraph with a bottom border and a large right indent
          // (or equal indents either side under a centred heading).
          const barW = pt(30);
          const avail = ctx.width - col;
          out.push(
            new Paragraph({
              keepNext: true,
              spacing: { before: pt(1), after: pt(h.after + 1), line: 40, lineRule: LineRuleType.EXACT },
              indent: center
                ? { left: col + Math.round((avail - barW) / 2), right: Math.round((avail - barW) / 2) }
                : { left: col || undefined, right: Math.max(0, avail - barW) },
              border: { bottom: { style: BorderStyle.SINGLE, size: Math.round(h.rule * 8), color: ctx.colors.rule, space: 0 } },
              children: [new TextRun({ text: "", size: 2 })],
            }),
          );
        }
        break;
      }

      case "entry": {
        const before = pt(b.first ? 0 : style.entryGap);
        if (b.stack) {
          out.push(new Paragraph({ keepNext: true, keepLines: true, spacing: { before, after: 0 }, children: runs(b.left, ctx, s.body) }));
          if (b.sub) out.push(new Paragraph({ keepNext: true, spacing: { after: 0 }, children: runs(b.sub, ctx, s.sub) }));
          if (b.right) {
            out.push(
              new Paragraph({
                keepNext: true,
                spacing: { after: pt(2) },
                children: [new TextRun({ text: b.right, size: hp(s.sub), color: ctx.colors.muted })],
              }),
            );
          }
          break;
        }
        const date = b.right ? [new TextRun({ text: b.right, size: hp(s.body), color: ctx.colors.date })] : [];
        const head = ctx.timeline
          ? new Paragraph({
              keepNext: true,
              keepLines: true,
              spacing: { before, after: pt(b.sub ? 0 : 2) },
              indent: { left: col, hanging: col },
              tabStops: [{ type: TabStopType.LEFT, position: col }],
              children: [...date, new TextRun({ children: [new Tab()], size: hp(s.body) }), ...runs(b.left, ctx, s.body)],
            })
          : new Paragraph({
              keepNext: true,
              keepLines: true,
              spacing: { before, after: pt(b.sub ? 0 : 2) },
              tabStops: [{ type: TabStopType.RIGHT, position: ctx.width }],
              children: [
                ...runs(b.left, ctx, s.body),
                ...(b.right
                  ? [new TextRun({ children: [new Tab(), b.right], size: hp(s.body), color: ctx.colors.date })]
                  : []),
              ],
            });
        out.push(head);
        if (b.sub) {
          out.push(
            new Paragraph({
              keepNext: true,
              keepLines: true,
              spacing: { after: pt(2) },
              indent: col ? { left: col } : undefined,
              children: runs(b.sub, ctx, s.sub),
            }),
          );
        }
        break;
      }

      case "bullet":
        out.push(
          new Paragraph({
            numbering: { reference: ctx.bulletRef, level: 0 },
            spacing: { after: pt(1.5) },
            children: runs(b.runs, ctx, s.body),
          }),
        );
        break;

      case "para":
        out.push(
          new Paragraph({
            spacing: { after: pt(2) },
            indent: col ? { left: col } : undefined,
            children: runs(b.runs, ctx, s.body),
          }),
        );
        break;

      case "line": {
        let size = s.body;
        // Side column: shrink a single unbreakable token (a long URL or email) to fit rather than split it.
        if (ctx.side && b.runs.length === 1 && !/\s/.test(b.runs[0].text.trim())) {
          const est = b.runs[0].text.length * s.body * 0.5 * 20;
          if (est > ctx.width) size = Math.max(s.body * 0.72, (s.body * ctx.width) / est);
        }
        out.push(
          new Paragraph({
            spacing: { after: pt(b.last ? 2 : ctx.side ? 2.5 : 1.5) },
            indent: col ? { left: col } : undefined,
            children: runs(b.runs, ctx, Math.round(size * 2) / 2),
          }),
        );
        break;
      }

      case "chips": {
        const fill = style.columns?.chipFill ?? "EEEEEE";
        const size = hp(s.sub * 0.92);
        const children: TextRun[] = [];
        b.items.forEach((item, idx) => {
          if (idx > 0) children.push(new TextRun({ text: "   ", size }));
          // Non-breaking spaces pad the shaded run and keep multi-word tags together.
          children.push(
            new TextRun({
              text: `${NBSP}${NBSP}${item.replace(/ /g, NBSP)}${NBSP}${NBSP}`,
              size,
              color: ctx.colors.text,
              shading: { type: ShadingType.CLEAR, color: "auto", fill },
            }),
          );
        });
        out.push(new Paragraph({ spacing: { after: pt(4), line: 400, lineRule: LineRuleType.AT_LEAST }, children }));
        break;
      }
    }
    prev = b.kind;
  }
  return out;
}

/**
 * Empty fixed-height paragraph used as vertical padding inside table cells.
 * Word counts top/bottom cell margins inside a row's height but LibreOffice
 * adds them on top, so padding as content keeps both apps on one page.
 */
const spacer = (height: number) =>
  new Paragraph({ spacing: { before: 0, after: 0, line: Math.max(20, Math.round(height)), lineRule: LineRuleType.EXACT }, children: [new TextRun({ text: "", size: 2 })] });

/* ------------------------------ band header (creative) ------------------------------ */

/**
 * Full-bleed dark band: name, headline and contact in the left cell, a
 * monogram tile above the side column on the right. Creative only.
 */
function bandTable(
  header: Block[],
  style: TemplateStyle,
  cols: NonNullable<TemplateStyle["columns"]>,
  g: { mainW: number; sideW: number; height: number; padLeft: number },
): Table {
  const band = cols.band!;
  const s = style.size;
  const textW = g.mainW - g.padLeft - pt(26);
  const info: Paragraph[] = [];
  let nameText = "";
  for (const b of header) {
    if (b.kind === "name") {
      nameText = b.text;
      info.push(new Paragraph({ spacing: { after: pt(nameAfter(style)), line: 240 }, children: [nameRun(b.text, style, band.name)] }));
    } else if (b.kind === "headline") {
      info.push(new Paragraph({ spacing: { after: pt(5) }, children: [headlineRun(b.text, style, band.headline)] }));
    } else if (b.kind === "contact") {
      const rows = contactRows(b.parts, style.contactSep, textW / 20, (t) => t.length * s.contact * emOf(style.docxFont));
      info.push(
        new Paragraph({
          children: rows.map((text, i) => new TextRun({ text, break: i > 0 ? 1 : undefined, size: hp(s.contact), color: band.contact })),
        }),
      );
    }
  }
  const mono = initials(nameText);
  const infoCell = new TableCell({
    width: { size: g.mainW, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.CLEAR, color: "auto", fill: band.fill },
    margins: { top: 0, bottom: 0, left: g.padLeft, right: pt(26), marginUnitType: WidthType.DXA },
    children: [spacer(pt(16)), ...info, spacer(pt(16))],
  });
  const tileCell = new TableCell({
    width: { size: g.sideW, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.CLEAR, color: "auto", fill: band.tile },
    margins: { top: 0, bottom: 0, left: 0, right: 0, marginUnitType: WidthType.DXA },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 240 },
        children: mono
          ? [new TextRun({ text: mono, font: displayFont(style), size: hp(Math.min(64, band.height * 0.42)), color: band.tileText, characterSpacing: pt(2) })]
          : [],
      }),
    ],
  });
  return new Table({
    width: { size: g.mainW + g.sideW, type: WidthType.DXA },
    columnWidths: cols.side === "right" ? [g.mainW, g.sideW] : [g.sideW, g.mainW],
    layout: TableLayoutType.FIXED,
    borders: TableBorders.NONE,
    rows: [
      new TableRow({
        // Exact, so the body row below can be sized to end at the page foot in Word and LibreOffice alike.
        // g.height is a generous estimate of the text block (see renderDocx), so nothing is clipped.
        height: { value: pt(g.height), rule: HeightRule.EXACT },
        cantSplit: true,
        children: cols.side === "right" ? [infoCell, tileCell] : [tileCell, infoCell],
      }),
    ],
  });
}

/* ------------------------------ document ------------------------------ */

const bulletLevel = (font: string, left: number, color: string) => ({
  level: 0,
  format: LevelFormat.BULLET,
  text: "•",
  alignment: AlignmentType.LEFT,
  style: {
    paragraph: { indent: { left, hanging: 240 } },
    run: { font, color },
  },
});

export async function renderDocx(input: ResumeContent, template: TemplateId): Promise<Uint8Array> {
  const style = TEMPLATES[template];
  const content = normalizeContent(input);
  const blocks = buildDocument(content, template);
  const s = style.size;
  const cols = style.columns;

  const marginX = cols?.bleed ? 0 : pt(style.margin.x);
  const marginY = cols?.bleed ? 0 : pt(style.margin.y);
  const contentWidth = PAGE.width - marginX * 2;

  const mainCtx: Ctx = {
    style,
    colors: style.color,
    width: contentWidth,
    timeline: style.layout === "timeline",
    side: false,
    bulletRef: style.layout === "timeline" ? "timeline-bullets" : "resume-bullets",
  };

  let children: (Paragraph | Table)[];

  if (!cols) {
    children = [...headerParagraphs(blocks.header, mainCtx), ...bodyParagraphs(blocks.main, mainCtx, "contact")];
    if (style.band) {
      // Clear air between the band and the first heading.
      children.splice(blocks.header.length, 0, new Paragraph({ spacing: { after: 0, line: 160, lineRule: LineRuleType.EXACT }, children: [] }));
    }
  } else {
    const gutter = pt(26);
    // Divider layouts have no panel: no outer padding, the gutter is split around the rule.
    const inner = pt(cols.divider ? 0 : cols.bleed ? 24 : 14);
    const innerIn = cols.divider ? pt(13) : inner;
    const mainGap = cols.divider ? pt(13) : gutter;
    const sideW = pt(cols.width);
    const mainW = contentWidth - sideW;
    const sideCtx: Ctx = {
      style,
      colors: { ...style.color, text: cols.text, muted: cols.muted, heading: cols.heading, accent: cols.heading, rule: cols.heading, date: cols.muted },
      width: sideW - inner - innerIn,
      timeline: false,
      side: true,
      bulletRef: "side-bullets",
    };
    const mainInnerCtx: Ctx = { ...mainCtx, width: mainW - mainGap - (cols.bleed ? pt(style.margin.x) : 0) };

    const sideChildren =
      cols.header === "side"
        ? [...headerParagraphs(blocks.header, sideCtx, { stack: true }), ...bodyParagraphs(blocks.side, sideCtx, "contact")]
        : bodyParagraphs(blocks.side, sideCtx, null);
    // "main": name and headline open the main column; contact details sit in the side column.
    const mainChildren =
      cols.header === "main"
        ? [...headerParagraphs(blocks.header, mainInnerCtx), ...bodyParagraphs(blocks.main, mainInnerCtx, "contact")]
        : bodyParagraphs(blocks.main, mainInnerCtx, null);

    const bandTop = cols.header === "band" ? pt(22) : 0;
    const top = cols.bleed ? (bandTop || pt(style.margin.y)) : pt(cols.divider ? 4 : 14);
    const outerLeft = cols.side === "left";
    const dividerBorder = cols.divider ? { style: BorderStyle.SINGLE, size: 4, color: cols.divider } : undefined;
    const sideCell = new TableCell({
      width: { size: sideW, type: WidthType.DXA },
      shading: cols.divider ? undefined : { type: ShadingType.CLEAR, color: "auto", fill: cols.fill },
      borders: dividerBorder ? (outerLeft ? { right: dividerBorder } : { left: dividerBorder }) : undefined,
      // Vertical padding is a spacer paragraph, not a cell margin (see `spacer`).
      margins: {
        top: 0,
        bottom: 0,
        left: outerLeft ? inner : innerIn,
        right: outerLeft ? innerIn : inner,
        marginUnitType: WidthType.DXA,
      },
      children: [spacer(top), ...sideChildren],
    });
    const mainCell = new TableCell({
      width: { size: mainW, type: WidthType.DXA },
      margins: {
        top: 0,
        bottom: 0,
        left: outerLeft ? mainGap : cols.bleed ? pt(style.margin.x) : 0,
        right: outerLeft ? (cols.bleed ? pt(style.margin.x) : 0) : mainGap,
        marginUnitType: WidthType.DXA,
      },
      children: [spacer(cols.bleed ? bandTop || pt(style.margin.y) : pt(4)), ...mainChildren],
    });

    // Estimated header height (top / band header) so the side panel reaches the page foot
    // without spilling onto a blank page. Errs on the short side.
    let headerPt = 0;
    const lead = 1.17 * style.leading;
    const contact = blocks.header.find((b) => b.kind === "contact");
    const contactRowCount = (w: number) =>
      contact && contact.kind === "contact" ? contactRows(contact.parts, style.contactSep, w / 20, (t) => t.length * s.contact * emOf(style.docxFont)).length : 0;
    if (cols.header === "top") {
      headerPt = s.name * 1.2 + nameAfter(style) + (content.headline ? s.headline * lead + 3 : 0) + contactRowCount(contentWidth) * s.contact * lead + 4 + 18;
      if (cols.topRule) headerPt += cols.topRule.weight;
    } else if (cols.header === "band" && cols.band) {
      // Generous line heights (fallback fonts run taller) plus 2 x 16 pt spacers and air.
      const l = 1.3 * style.leading;
      const textH = s.name * 1.3 + nameAfter(style) + (content.headline ? s.headline * l + 5 : 0) + contactRowCount(mainW - pt(style.margin.x) - mainGap) * s.contact * l;
      headerPt = Math.max(cols.band.height, textH + 44);
    }
    const rowHeight = PAGE.height - marginY * 2 - pt(headerPt) - pt(cols.bleed ? 2 : 16);

    const table = new Table({
      width: { size: contentWidth, type: WidthType.DXA },
      columnWidths: cols.side === "left" ? [sideW, mainW] : [mainW, sideW],
      layout: TableLayoutType.FIXED,
      borders: TableBorders.NONE,
      rows: [
        new TableRow({
          height: { value: rowHeight, rule: HeightRule.ATLEAST },
          children: cols.side === "left" ? [sideCell, mainCell] : [mainCell, sideCell],
        }),
      ],
    });

    // Word needs a paragraph after a table; keep it 1 pt so it never makes a page of its own.
    const tail = new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, children: [new TextRun({ text: "", size: 2 })] });

    if (cols.header === "top") {
      const head = headerParagraphs(blocks.header, mainCtx);
      const tr = cols.topRule ?? { weight: 1.2, color: style.color.accent };
      const rule = new Paragraph({
        spacing: { before: pt(2), after: pt(14), line: 40, lineRule: LineRuleType.EXACT },
        border: { bottom: { style: BorderStyle.SINGLE, size: Math.min(96, Math.round(tr.weight * 8)), color: tr.color, space: 0 } },
        children: [new TextRun({ text: "", size: 2 })],
      });
      children = [...head, rule, table, tail];
    } else if (cols.header === "band" && cols.band) {
      children = [bandTable(blocks.header, style, cols, { mainW, sideW, height: headerPt, padLeft: pt(style.margin.x) }), table, tail];
    } else {
      children = [table, tail];
    }
  }

  const h = style.heading;
  const doc = new Document({
    creator: content.name || "Resume",
    lastModifiedBy: content.name || "Resume",
    title: content.name ? `${content.name} – Resume` : "Resume",
    description: "Resume",
    styles: {
      default: {
        document: {
          run: { font: style.docxFont, size: hp(s.body), color: style.color.text },
          paragraph: { spacing: { line: Math.round(240 * style.leading), after: 0, before: 0 } },
        },
        heading1: {
          run: {
            font: displayFont(style),
            size: hp(s.heading),
            bold: true,
            allCaps: h.caps === "all" || undefined,
            smallCaps: h.caps === "small" || undefined,
            characterSpacing: pt(h.tracking),
            color: style.color.heading,
          },
          paragraph: { spacing: { before: pt(h.before), after: pt(h.after) }, keepNext: true },
        },
      },
    },
    numbering: {
      config: [
        { reference: "resume-bullets", levels: [bulletLevel(style.docxFont, 360, style.color.accent)] },
        { reference: "timeline-bullets", levels: [bulletLevel(style.docxFont, pt(style.dateColumn) + 360, style.color.accent)] },
        { reference: "side-bullets", levels: [bulletLevel(style.docxFont, 300, cols?.heading ?? style.color.accent)] },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: {
              top: marginY,
              right: marginX,
              bottom: marginY,
              left: marginX,
              header: cols?.bleed ? 0 : 720,
              footer: cols?.bleed ? 0 : 720,
            },
          },
        },
        children,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
