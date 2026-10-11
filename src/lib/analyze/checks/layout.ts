// Layout checks: is the file built in a way parsers read correctly?
// A check is only emitted when it can actually be evaluated for this file
// type (tables, headers/footers and text boxes are DOCX structures; a PDF
// with no text layer has no layout we can measure).
import type { Check, Evidence } from "@/lib/types";
import { build, type CheckContext, type CheckDef } from "./common";
import { EMAIL_RE, findPhone, joinList, plural, quoteList, truncate, wordCount } from "../text";
import { classifyFont, RECOMMENDED_FONTS } from "../fonts";
import type { PlacedGraphic } from "../internal";

export const LAYOUT_DEFS = {
  columns: {
    id: "layout.columns",
    category: "layout",
    title: "Single-column layout",
    severity: "high",
    weight: 20,
    why: "Most parsers read a page from left to right, line by line. Side-by-side columns get merged into one stream, so sections, dates and job titles end up mixed together.",
  },
  tables: {
    id: "layout.tables",
    category: "layout",
    title: "No layout tables",
    severity: "high",
    weight: 15,
    why: "Many parsers flatten table cells or skip them. When a table lines up titles against dates, the two often end up separated.",
  },
  headerFooter: {
    id: "layout.header-footer",
    category: "layout",
    title: "Contact details in the document body",
    severity: "high",
    weight: 15,
    why: "Most parsers only read the document body and ignore page headers and footers. Contact details placed there silently disappear from your profile.",
  },
  textBoxes: {
    id: "layout.text-boxes",
    category: "layout",
    title: "No text boxes",
    severity: "high",
    weight: 15,
    why: "Text boxes are stored separately from the main text. Many parsers skip them, so whatever is inside never reaches the recruiter.",
  },
  graphics: {
    id: "layout.graphics",
    category: "layout",
    title: "Information in text, not graphics",
    severity: "medium",
    weight: 8,
    why: "Parsers cannot read images or shapes. Skill bars, rating dots and icons carry no text, so the information they show is lost.",
  },
  fonts: {
    id: "layout.fonts",
    category: "layout",
    title: "Standard fonts",
    severity: "low",
    weight: 4,
    why: "Design fonts rarely stop a parser on their own, but they are often missing on recruiters’ machines (so a DOCX displays in a substitute font) and some PDF exports of them extract with broken spacing or characters.",
  },
} satisfies Record<string, CheckDef>;

export function layoutChecks(ctx: CheckContext): Check[] {
  const { doc, noText } = ctx;
  const out: Check[] = [];
  // A PDF without a text layer has no measurable layout; extraction.text already reports it.
  if (doc.kind === "pdf" && noText) return out;

  out.push(columnsCheck(ctx));
  if (doc.kind === "docx") {
    out.push(tablesCheck(ctx));
    out.push(headerFooterCheck(ctx));
    out.push(textBoxCheck(ctx));
  }
  out.push(graphicsCheck(ctx));
  const f = fontsCheck(ctx);
  if (f) out.push(f);
  return out;
}

function columnsCheck(ctx: CheckContext): Check {
  const { doc } = ctx;
  if (doc.kind === "pdf") {
    if (doc.columns >= 2) {
      const pages = doc.columnEvidence.map((e) => e.page);
      const evidence: Evidence[] = doc.columnEvidence.flatMap((e) => e.mixedLines.map((t) => ({ text: t, where: `Page ${e.page}, as the parser read it` }))).slice(0, 4);
      return build(LAYOUT_DEFS.columns, {
        status: "fail",
        summary: `${pages.length === 1 ? `Page ${pages[0]} is` : `Pages ${joinList(pages.map(String))} are`} laid out in two columns. Reading straight across the page, the parser merged lines from both columns${evidence.length ? ", as shown below" : ""}.`,
        fix: "Rebuild the CV as a single column: put contact details under your name and move sidebar content (skills, languages) into ordinary sections below your experience.",
        evidence,
      });
    }
    return build(LAYOUT_DEFS.columns, { status: "pass", summary: "Your text runs in a single column, so a parser reads it in the right order." });
  }
  // DOCX
  if (doc.sectionColumns > 0) {
    return build(LAYOUT_DEFS.columns, {
      status: "fail",
      summary: `${doc.sectionColumns === 1 ? "A section" : `${doc.sectionColumns} sections`} of your document ${doc.sectionColumns === 1 ? "is" : "are"} set in ${doc.columns} newspaper-style columns. Parsers that read the page layout merge the columns line by line.`,
      fix: "Set the layout back to one column (Layout › Columns › One) and let sections follow one another down the page.",
    });
  }
  const layoutTable = doc.tables?.find((t) => t.layoutColumns);
  if (layoutTable) {
    return build(LAYOUT_DEFS.columns, {
      status: "warn",
      summary: "Your two-column look comes from a table that places a sidebar next to the main content. Word stores this in order, but parsers that read the visual layout, and PDF exports of it, mix the two columns.",
      fix: "Move the sidebar content into normal sections in a single column. See “No layout tables”.",
      evidence: [{ text: layoutTable.sample, where: "Table row" }],
    });
  }
  return build(LAYOUT_DEFS.columns, { status: "pass", summary: "Your document body flows in a single column." });
}

function tablesCheck(ctx: CheckContext): Check {
  const tables = ctx.doc.tables ?? [];
  if (!tables.length) return build(LAYOUT_DEFS.tables, { status: "pass", summary: "Your document body contains no tables." });
  const layout = tables.filter((t) => t.layoutColumns);
  const dated = tables.filter((t) => !t.layoutColumns && t.hasDates);
  const evidence: Evidence[] = [...layout, ...dated, ...tables.filter((t) => !t.layoutColumns && !t.hasDates)]
    .slice(0, 4)
    .map((t) => ({ text: t.sample, where: t.layoutColumns ? "Layout table" : t.borderless ? "Borderless table" : "Table" }));
  if (layout.length) {
    return build(LAYOUT_DEFS.tables, {
      status: "fail",
      summary: `Your page layout is built from a table: one row holds a sidebar and the main content side by side${tables.length > 1 ? `, and there ${tables.length - 1 === 1 ? "is 1 other table" : `are ${tables.length - 1} other tables`}` : ""}. Parsers often read such tables cell by cell or skip them.`,
      fix: "Remove the table and lay the CV out as ordinary paragraphs in one column. Copy each cell’s content out first so nothing is lost.",
      evidence,
    });
  }
  if (dated.length) {
    const borderless = dated.filter((t) => t.borderless).length;
    return build(LAYOUT_DEFS.tables, {
      status: "fail",
      summary: `${plural(dated.length, borderless === dated.length ? "borderless table" : "table")} line${dated.length === 1 ? "s" : ""} up job titles against dates. Parsers that flatten tables can separate each date from the role it belongs to.`,
      fix: "Replace the tables with plain lines: put the title, company and dates on one line and use a right-aligned tab stop if you want the dates on the right.",
      evidence,
    });
  }
  return build(LAYOUT_DEFS.tables, {
    status: "warn",
    summary: `Your CV contains ${plural(tables.length, "table")}. Some parsers read table cells out of order or skip them.`,
    fix: "Convert the table content into plain lines or a comma-separated list.",
    evidence,
  });
}

function nameLike(text: string): boolean {
  return text.split(/\n|\s*[|•·]\s*/).some((line) => {
    const w = line.trim().split(/\s+/);
    return w.length >= 2 && w.length <= 4 && w.every((x) => /^[\p{Lu}][\p{L}'’.-]*$/u.test(x)) && !/\d/.test(line);
  });
}

function headerFooterCheck(ctx: CheckContext): Check {
  const { doc, build: b } = ctx;
  const hf = doc.hidden.filter((h) => h.where !== "text box");
  const substantive = hf.filter((h) => !/^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i.test(h.text.trim()) && wordCount(h.text) > 0);
  if (!substantive.length) return build(LAYOUT_DEFS.headerFooter, { status: "pass", summary: "Your page header and footer contain no contact details or content." });

  const lost: string[] = [];
  const p = b.profile;
  const all = substantive.map((h) => h.text).join("\n");
  if (EMAIL_RE.test(all) && !p.email) lost.push("email address");
  if (findPhone(all) && !p.phone) lost.push("phone number");
  if (nameLike(all) && !p.name) lost.push("name");
  const evidence: Evidence[] = [...substantive].sort((a, b) => (a.where < b.where ? 1 : a.where > b.where ? -1 : 0)).slice(0, 3).map((h) => ({ text: truncate(h.text.replace(/\n/g, " · ")), where: h.where === "header" ? "Page header" : "Page footer" }));
  const where = joinList([...new Set(substantive.map((h) => (h.where === "header" ? "page header" : "page footer")))].sort());

  if (lost.length) {
    return build(LAYOUT_DEFS.headerFooter, {
      status: "fail",
      summary: `Your ${joinList(lost)} ${lost.length === 1 ? "is" : "are"} only in the ${where}. Most parsers only read the body, so ${lost.length === 1 ? "it" : "they"} came back empty.`,
      fix: "Move your name and contact details out of the header into the first lines of the document body. Keep the header empty or use it only for page numbers.",
      evidence,
    });
  }
  const contactThere = EMAIL_RE.test(all) || !!findPhone(all);
  return build(LAYOUT_DEFS.headerFooter, {
    status: contactThere ? "pass" : "warn",
    summary: contactThere
      ? `Your ${where} repeats contact details that also appear in the body, so nothing is lost.`
      : `Your ${where} contains text (${quoteList(substantive.map((h) => truncate(h.text, 60)), 2)}) that most parsers will not read.`,
    fix: "Move anything important from the header or footer into the document body.",
    evidence,
  });
}

function textBoxCheck(ctx: CheckContext): Check {
  const boxes = ctx.doc.hidden.filter((h) => h.where === "text box");
  if (!boxes.length) return build(LAYOUT_DEFS.textBoxes, { status: "pass", summary: "Your document contains no text boxes." });
  const words = boxes.reduce((n, h) => n + wordCount(h.text), 0);
  const all = boxes.map((h) => h.text).join("\n");
  const inside: string[] = [];
  if (EMAIL_RE.test(all)) inside.push("your email address");
  if (findPhone(all)) inside.push("your phone number");
  const evidence = boxes.slice(0, 4).map((h) => ({ text: truncate(h.text.replace(/\n/g, " · ")), where: "Text box" }));
  return build(LAYOUT_DEFS.textBoxes, {
    status: words >= 3 ? "fail" : "warn",
    summary: `${plural(boxes.length, "text box", "text boxes")} hold${boxes.length === 1 ? "s" : ""} ${plural(words, "word")}${inside.length ? `, including ${joinList(inside)}` : ""}. Many parsers skip text boxes, so this text is missing from what the parser saw.`,
    fix: "Delete the text boxes and paste their content into ordinary paragraphs in the document body.",
    evidence,
  });
}

interface GraphicSummary {
  bars: number;
  icons: number;
  photos: number;
  large: number;
  images: number;
  shapes: number;
}

function summariseGraphics(gs: PlacedGraphic[]): GraphicSummary {
  const s: GraphicSummary = { bars: 0, icons: 0, photos: 0, large: 0, images: 0, shapes: 0 };
  for (const g of gs) {
    const w = g.widthPt;
    const h = g.heightPt;
    if (w >= 30 && h <= 14 && h > 0 && w / h >= 4) s.bars++;
    else if (g.kind === "image" && g.pageFraction !== null && g.pageFraction >= 0.4) s.large++;
    else if (Math.max(w, h) <= 24 && Math.max(w, h) > 0) s.icons++;
    else if (g.kind === "image" && Math.min(w, h) >= 40) s.photos++;
    else if (g.kind === "image") s.images++;
    else s.shapes++;
  }
  return s;
}

function graphicsCheck(ctx: CheckContext): Check {
  const s = summariseGraphics(ctx.doc.graphics);
  const bits: string[] = [];
  if (s.bars) bits.push(`${plural(s.bars, "bar-shaped graphic")} (likely skill-level bars)`);
  if (s.icons) bits.push(plural(s.icons, "small icon"));
  if (s.photos) bits.push(s.photos === 1 ? "a photo or large image" : `${s.photos} photos or large images`);
  if (s.large) bits.push(plural(s.large, "full-page background image"));
  if (s.images) bits.push(plural(s.images, "other image"));
  if (s.shapes >= 3) bits.push(plural(s.shapes, "decorative shape"));
  if (!bits.length) {
    return build(LAYOUT_DEFS.graphics, {
      status: "pass",
      summary: s.shapes ? "Apart from simple shading, your CV carries its information as text." : "Your CV has no images or graphics; everything is text.",
    });
  }
  const heavy = s.bars >= 3 || s.icons >= 5 || s.large > 0;
  const fixes: string[] = [];
  if (s.bars) fixes.push("Replace skill bars and rating graphics with words, for example “Python (advanced)” or “Spanish (fluent)”.");
  if (s.icons) fixes.push("Remove icons or make sure each one sits next to the text it stands for (write “Email:” rather than an envelope symbol).");
  if (s.photos) fixes.push("Leave out the photo unless it is expected in the country you are applying in.");
  if (s.large) fixes.push("Remove background images.");
  if (!fixes.length) fixes.push("Make sure any information shown in images also appears as text.");
  return build(LAYOUT_DEFS.graphics, {
    status: heavy ? "fail" : "warn",
    summary: `We found ${joinList(bits)}. Parsers ignore graphics, so anything they show${s.bars ? ", such as skill levels," : ""} is lost.`,
    fix: fixes.join(" "),
  });
}

function fontsCheck(ctx: CheckContext): Check | null {
  const fonts = ctx.doc.fonts;
  if (!fonts.length) return null;
  const decorative = fonts.filter((f) => classifyFont(f) === "decorative");
  const icon = fonts.filter((f) => classifyFont(f) === "symbol" && /awesome|icon|material|dingbat|webdings/i.test(f));
  const textFonts = fonts.filter((f) => classifyFont(f) !== "symbol");
  if (!decorative.length && !icon.length) {
    return build(LAYOUT_DEFS.fonts, {
      status: "pass",
      summary: textFonts.length ? `Your CV uses ${joinList(textFonts.slice(0, 4))}, which display and extract reliably.` : "Your CV uses standard fonts.",
    });
  }
  const parts: string[] = [];
  if (decorative.length) parts.push(`Your CV uses ${joinList(decorative)}, ${decorative.length === 1 ? "a design font" : "design fonts"} that most office computers do not have installed.`);
  if (icon.length) parts.push(`It also uses the icon font ${joinList(icon)}; its symbols come out as stray letters or boxes in plain text.`);
  return build(LAYOUT_DEFS.fonts, {
    status: "warn",
    summary: parts.join(" "),
    fix: `Switch to a standard font such as ${joinList(RECOMMENDED_FONTS.slice(0, 3))} or ${RECOMMENDED_FONTS[RECOMMENDED_FONTS.length - 1]}, at 10–12 pt for body text.`,
    evidence: decorative.map((f) => ({ text: f, where: "Font" })),
  });
}
