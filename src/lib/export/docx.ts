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
  WidthType,
  type IBorderOptions,
  type IParagraphOptions,
} from "docx";
import type { ResumeContent, TemplateId } from "@/lib/types";
import { buildDocument, contactRows, normalizeContent, type Block, type Run } from "./layout";
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

function headerParagraphs(blocks: Block[], ctx: Ctx, opts: { stack?: boolean } = {}): Paragraph[] {
  const { style } = ctx;
  const s = style.size;
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

  for (const b of blocks) {
    if (b.kind === "name") {
      out.push(
        new Paragraph({
          ...bandProps,
          alignment: align,
          spacing: { after: pt(2), line: 240 },
          children: [
            new TextRun({
              text: b.text,
              bold: true,
              allCaps: style.name.caps || undefined,
              characterSpacing: style.name.tracking ? pt(style.name.tracking) : undefined,
              size: hp(s.name),
              color: nameColor,
            }),
          ],
        }),
      );
    } else if (b.kind === "headline") {
      out.push(
        new Paragraph({
          ...bandProps,
          alignment: align,
          spacing: { after: pt(opts.stack ? 10 : 3) },
          children: [
            new TextRun({
              text: b.text,
              bold: style.headline.bold || undefined,
              allCaps: style.headline.caps || undefined,
              characterSpacing: style.headline.tracking ? pt(style.headline.tracking) : undefined,
              size: hp(s.headline),
              color: headlineColor,
            }),
          ],
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
        continue;
      }
      // Estimate widths (Word does the real layout) and break between parts,
      // so the line never wraps inside an email/URL or leaves a dangling "|".
      const em = /georgia|cambria|garamond/i.test(style.docxFont) ? 0.55 : 0.52;
      const rows = contactRows(b.parts, style.contactSep, ctx.width / 20, (t) => t.length * s.contact * em);
      out.push(
        new Paragraph({
          ...bandProps,
          alignment: align,
          spacing: { after: pt(4) },
          children: rows.map(
            (text, i) => new TextRun({ text, break: i > 0 ? 1 : undefined, size: hp(s.contact), color: contactColor }),
          ),
        }),
      );
    }
  }
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
        out.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            keepNext: true,
            keepLines: true,
            indent: col ? { left: col } : undefined,
            spacing: {
              before: pt(prev === null ? 0 : prev === "contact" ? Math.max(8, h.before - 4) : h.before),
              after: short ? 0 : pt(h.after),
            },
            border:
              h.rule > 0 && !short
                ? { bottom: { style: BorderStyle.SINGLE, size: Math.max(2, Math.round(h.rule * 8)), color: ctx.colors.rule, space: 2 } }
                : undefined,
            children: [new TextRun({ text: b.text, color: ctx.colors.heading })],
          }),
        );
        if (short) {
          // A short accent bar: an empty, 2 pt paragraph with a bottom border and a large right indent.
          out.push(
            new Paragraph({
              keepNext: true,
              spacing: { before: pt(1), after: pt(h.after + 1), line: 40, lineRule: LineRuleType.EXACT },
              indent: { left: col || undefined, right: Math.max(0, ctx.width - col - pt(30)) },
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
    const inner = pt(cols.bleed ? 24 : 14);
    const sideW = pt(cols.width);
    const mainW = contentWidth - sideW;
    const sideCtx: Ctx = {
      style,
      colors: { ...style.color, text: cols.text, muted: cols.muted, heading: cols.heading, accent: cols.heading, rule: cols.heading, date: cols.muted },
      width: sideW - inner * 2,
      timeline: false,
      side: true,
      bulletRef: "side-bullets",
    };
    const mainInnerCtx: Ctx = { ...mainCtx, width: mainW - gutter - (cols.bleed ? pt(style.margin.x) : 0) };

    const sideChildren =
      cols.header === "side"
        ? [...headerParagraphs(blocks.header, sideCtx, { stack: true }), ...bodyParagraphs(blocks.side, sideCtx, "contact")]
        : bodyParagraphs(blocks.side, sideCtx, null);
    const mainChildren = bodyParagraphs(blocks.main, mainInnerCtx, null);

    const top = cols.bleed ? pt(style.margin.y) : pt(14);
    const sideCell = new TableCell({
      width: { size: sideW, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: cols.fill },
      margins: { top, bottom: top, left: inner, right: inner, marginUnitType: WidthType.DXA },
      children: sideChildren.length ? sideChildren : [new Paragraph({ children: [] })],
    });
    const mainCell = new TableCell({
      width: { size: mainW, type: WidthType.DXA },
      margins: {
        top: cols.bleed ? pt(style.margin.y) : pt(4),
        bottom: cols.bleed ? pt(style.margin.y) : 0,
        left: cols.side === "left" ? gutter : 0,
        right: cols.side === "left" ? (cols.bleed ? pt(style.margin.x) : 0) : gutter,
        marginUnitType: WidthType.DXA,
      },
      children: mainChildren.length ? mainChildren : [new Paragraph({ children: [] })],
    });

    // Estimated header height (top header) so the side panel reaches the page foot
    // without spilling onto a blank page. Errs on the short side.
    let headerPt = 0;
    if (cols.header === "top") {
      const contact = blocks.header.find((b) => b.kind === "contact");
      const em = /georgia|cambria|garamond/i.test(style.docxFont) ? 0.55 : 0.52;
      const rows = contact && contact.kind === "contact"
        ? contactRows(contact.parts, style.contactSep, contentWidth / 20, (t) => t.length * s.contact * em).length
        : 0;
      const lead = 1.17 * style.leading;
      headerPt = s.name * 1.2 + 2 + (content.headline ? s.headline * lead + 3 : 0) + rows * s.contact * lead + 4 + 18;
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
      const rule = new Paragraph({
        spacing: { before: pt(2), after: pt(14), line: 40, lineRule: LineRuleType.EXACT },
        border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: style.color.accent, space: 0 } },
        children: [new TextRun({ text: "", size: 2 })],
      });
      children = [...head, rule, table, tail];
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
            font: style.docxFont,
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
