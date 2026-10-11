// DOCX parsing.
//
// mammoth gives us clean body HTML for "your document". Everything structural
// (headers/footers, tables, text boxes, images, fonts, section columns) comes
// from reading the raw OOXML ourselves, because mammoth deliberately hides it.
//
// What `rawText` contains, and why: it is what a body-only parser sees.
// - Body paragraphs in document order. Word list items get a "• " prefix
//   (most parsers keep list markers or treat list items as separate lines).
// - Tables are flattened in XML order: a row whose cells each hold one
//   paragraph becomes one line ("Title   Dates"); otherwise each cell's
//   paragraphs follow one another, cell by cell. That is what common text
//   extractors produce, and why sidebar tables do not interleave in DOCX.
// - Text boxes and page headers/footers are LEFT OUT. Many ATS parsers skip
//   them entirely, and that silent loss is exactly what we warn about; the
//   layout checks quote the skipped text so the user can see what went missing.
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import mammoth from "mammoth";
import type { HiddenText, Line, ParsedDocument, PlacedGraphic, TableInfo } from "./internal";
import { UnreadableDocumentError } from "./errors";
import { collapse, normaliseText, truncate, wordCount } from "./text";
import { cleanFontName } from "./fonts";
import { findDateRanges } from "./dates";

type XNode = Record<string, unknown>;

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
  htmlEntities: false,
});

function tagOf(n: XNode): string | null {
  for (const k in n) if (k !== ":@") return k;
  return null;
}
function kids(n: XNode): XNode[] {
  const t = tagOf(n);
  if (!t || t === "#text") return [];
  const v = n[t];
  return Array.isArray(v) ? (v as XNode[]) : [];
}
function attr(n: XNode, name: string): string | undefined {
  const a = n[":@"] as Record<string, string> | undefined;
  return a?.[name];
}
function child(n: XNode, tag: string): XNode | undefined {
  return kids(n).find((k) => tagOf(k) === tag);
}
function findAll(n: XNode, tag: string, out: XNode[] = []): XNode[] {
  for (const k of kids(n)) {
    if (tagOf(k) === tag) out.push(k);
    findAll(k, tag, out);
  }
  return out;
}
function textOf(n: XNode): string {
  const t = tagOf(n);
  if (t === "#text") return String(n["#text"] ?? "");
  return kids(n).map(textOf).join("");
}
function onOff(n: XNode | undefined): boolean {
  if (!n) return false;
  const v = attr(n, "w:val");
  return v === undefined || !/^(0|false|off|none)$/i.test(v);
}

interface StyleInfo {
  id: string;
  name: string;
  type: string;
  basedOn?: string;
  sz?: number;
  bold?: boolean;
  fonts: string[];
  heading: boolean;
  list: boolean;
  bordered?: boolean;
}

interface Ctx {
  styles: Map<string, StyleInfo>;
  theme: { major?: string; minor?: string };
  defaultSize: number;
  fonts: Set<string>;
  usedStyles: Set<string>;
  hidden: HiddenText[];
  graphics: PlacedGraphic[];
  tables: TableInfo[];
  maxCols: number;
  sectionColumns: number;
  /** Collecting a text box's paragraphs (nested). */
  inTextBox: number;
}

interface Para {
  text: string;
  segments: string[];
  bullet: boolean;
  heading: boolean;
  bold: boolean;
  size: number;
}

/* ---------------- styles / theme ---------------- */

function fontsFromRFonts(rf: XNode | undefined, theme: Ctx["theme"]): string[] {
  if (!rf) return [];
  const out: string[] = [];
  for (const a of ["w:ascii", "w:hAnsi"]) {
    const v = attr(rf, a);
    if (v) out.push(v);
  }
  for (const a of ["w:asciiTheme", "w:hAnsiTheme"]) {
    const v = attr(rf, a);
    if (v?.startsWith("major") && theme.major) out.push(theme.major);
    if (v?.startsWith("minor") && theme.minor) out.push(theme.minor);
  }
  return out;
}

function parseTheme(xml: string | null): Ctx["theme"] {
  if (!xml) return {};
  const major = xml.match(/<a:majorFont>\s*<a:latin typeface="([^"]*)"/);
  const minor = xml.match(/<a:minorFont>\s*<a:latin typeface="([^"]*)"/);
  return { major: major?.[1] || undefined, minor: minor?.[1] || undefined };
}

function parseStyles(xml: string | null, theme: Ctx["theme"]): { styles: Map<string, StyleInfo>; defaultSize: number; defaultFonts: string[] } {
  const styles = new Map<string, StyleInfo>();
  let defaultSize = 11;
  let defaultFonts: string[] = [];
  if (!xml) return { styles, defaultSize, defaultFonts };
  const root = (parser.parse(xml) as XNode[]).find((n) => tagOf(n) === "w:styles");
  if (!root) return { styles, defaultSize, defaultFonts };
  const dd = child(root, "w:docDefaults");
  const drpr = dd && child(child(dd, "w:rPrDefault") ?? {}, "w:rPr");
  if (drpr) {
    const sz = child(drpr, "w:sz");
    if (sz && attr(sz, "w:val")) defaultSize = Number(attr(sz, "w:val")) / 2 || 11;
    defaultFonts = fontsFromRFonts(child(drpr, "w:rFonts"), theme);
  } else if (theme.minor) defaultFonts = [theme.minor];
  for (const s of kids(root)) {
    if (tagOf(s) !== "w:style") continue;
    const id = attr(s, "w:styleId") ?? "";
    const name = attr(child(s, "w:name") ?? {}, "w:val") ?? id;
    const rPr = child(s, "w:rPr");
    const pPr = child(s, "w:pPr");
    const tblPr = child(s, "w:tblPr");
    const sz = rPr && child(rPr, "w:sz");
    const info: StyleInfo = {
      id,
      name,
      type: attr(s, "w:type") ?? "paragraph",
      basedOn: attr(child(s, "w:basedOn") ?? {}, "w:val"),
      sz: sz && attr(sz, "w:val") ? Number(attr(sz, "w:val")) / 2 : undefined,
      bold: rPr ? (child(rPr, "w:b") ? onOff(child(rPr, "w:b")) : undefined) : undefined,
      fonts: fontsFromRFonts(rPr && child(rPr, "w:rFonts"), theme),
      heading: /^(heading\s*\d|heading)$/i.test(name) || !!(pPr && child(pPr, "w:outlineLvl") && Number(attr(child(pPr, "w:outlineLvl")!, "w:val")) < 9),
      list: !!(pPr && child(pPr, "w:numPr")),
    };
    if (tblPr) {
      const b = child(tblPr, "w:tblBorders");
      info.bordered = b ? kids(b).some((e) => !/^(nil|none)$/i.test(attr(e, "w:val") ?? "nil")) : /grid/i.test(name);
    }
    styles.set(id, info);
  }
  return { styles, defaultSize, defaultFonts };
}

function styleChain(ctx: Ctx, id: string | undefined): StyleInfo[] {
  const out: StyleInfo[] = [];
  const seen = new Set<string>();
  let cur = id;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const s = ctx.styles.get(cur);
    if (!s) break;
    out.push(s);
    cur = s.basedOn;
  }
  return out;
}

/* ---------------- graphics & text boxes ---------------- */

const EMU_PER_PT = 12700;

function vmlSize(style: string | undefined): { w: number; h: number } {
  const get = (k: string) => {
    const m = style?.match(new RegExp(`${k}:\\s*([\\d.]+)(pt|in|px|cm|mm)?`));
    if (!m) return 0;
    const v = Number(m[1]);
    switch (m[2]) {
      case "in":
        return v * 72;
      case "px":
        return v * 0.75;
      case "cm":
        return (v / 2.54) * 72;
      case "mm":
        return (v / 25.4) * 72;
      default:
        return v;
    }
  };
  return { w: get("width"), h: get("height") };
}

function collectTextBox(ctx: Ctx, content: XNode) {
  ctx.inTextBox++;
  const paras: string[] = [];
  for (const k of kids(content)) {
    if (tagOf(k) === "w:p") {
      const p = readParagraph(ctx, k);
      if (p.text.trim()) paras.push(p.text.replace(/^• /, ""));
    } else if (tagOf(k) === "w:tbl") {
      for (const l of readTable(ctx, k)) paras.push(l.text);
    }
  }
  ctx.inTextBox--;
  const text = paras.join("\n").trim();
  if (text) ctx.hidden.push({ where: "text box", text });
}

function handleDrawing(ctx: Ctx, n: XNode) {
  const holder = child(n, "wp:inline") ?? child(n, "wp:anchor");
  if (!holder) return;
  const ext = child(holder, "wp:extent");
  const w = Number(attr(ext ?? {}, "cx") ?? 0) / EMU_PER_PT;
  const h = Number(attr(ext ?? {}, "cy") ?? 0) / EMU_PER_PT;
  const txbx = findAll(holder, "w:txbxContent");
  if (txbx.length) {
    for (const t of txbx) collectTextBox(ctx, t);
    return;
  }
  const isPic = findAll(holder, "pic:pic").length > 0 || findAll(holder, "a:blip").length > 0;
  if (!ctx.inTextBox) ctx.graphics.push({ kind: isPic ? "image" : "shape", widthPt: round1(w), heightPt: round1(h), page: 1, pageFraction: null });
}

function handlePict(ctx: Ctx, n: XNode) {
  for (const shape of kids(n)) {
    const t = tagOf(shape);
    if (!t || !t.startsWith("v:")) continue;
    const { w, h } = vmlSize(attr(shape, "style"));
    const tb = findAll(shape, "w:txbxContent");
    if (tb.length) {
      for (const c of tb) collectTextBox(ctx, c);
      continue;
    }
    if (t === "v:line" || t === "v:shapetype") continue;
    const img = findAll(shape, "v:imagedata").length > 0;
    if (!ctx.inTextBox && (w > 0 || h > 0)) ctx.graphics.push({ kind: img ? "image" : "shape", widthPt: round1(w), heightPt: round1(h), page: 1, pageFraction: null });
  }
}

/* ---------------- paragraphs ---------------- */

function readSectPr(ctx: Ctx, sect: XNode | undefined) {
  if (!sect) return;
  const cols = child(sect, "w:cols");
  const num = Number(attr(cols ?? {}, "w:num") ?? 1) || 1;
  if (num >= 2) {
    ctx.sectionColumns++;
    ctx.maxCols = Math.max(ctx.maxCols, num);
  }
}

function readParagraph(ctx: Ctx, p: XNode): Para {
  const pPr = child(p, "w:pPr");
  const styleId = pPr ? attr(child(pPr, "w:pStyle") ?? {}, "w:val") : undefined;
  if (styleId) ctx.usedStyles.add(styleId);
  const chain = styleChain(ctx, styleId ?? "Normal");
  const styleSize = chain.find((s) => s.sz !== undefined)?.sz ?? ctx.defaultSize;
  const styleBold = chain.find((s) => s.bold !== undefined)?.bold ?? false;
  const heading = chain.some((s) => s.heading) || !!(pPr && child(pPr, "w:outlineLvl") && Number(attr(child(pPr, "w:outlineLvl")!, "w:val")) < 9);
  const numPr = pPr && child(pPr, "w:numPr");
  const numId = numPr ? attr(child(numPr, "w:numId") ?? {}, "w:val") : undefined;
  const bullet = numPr ? numId !== "0" : chain.some((s) => s.list);
  if (pPr) readSectPr(ctx, child(pPr, "w:sectPr"));

  let text = "";
  let maxSize = 0;
  let letterRuns = 0;
  let boldRuns = 0;

  const visit = (n: XNode) => {
    const t = tagOf(n);
    switch (t) {
      case "w:pPr":
      case "w:del":
      case "w:moveFrom":
      case "w:proofErr":
      case "w:bookmarkStart":
      case "w:bookmarkEnd":
        return;
      case "mc:AlternateContent": {
        const choice = child(n, "mc:Choice") ?? child(n, "mc:Fallback");
        if (choice) kids(choice).forEach(visit);
        return;
      }
      case "w:r": {
        const rPr = child(n, "w:rPr");
        let size = styleSize;
        let bold = styleBold;
        if (rPr) {
          const sz = child(rPr, "w:sz");
          if (sz && attr(sz, "w:val")) size = Number(attr(sz, "w:val")) / 2;
          if (child(rPr, "w:b")) bold = onOff(child(rPr, "w:b"));
          const rStyle = attr(child(rPr, "w:rStyle") ?? {}, "w:val");
          if (rStyle) ctx.usedStyles.add(rStyle);
          for (const f of fontsFromRFonts(child(rPr, "w:rFonts"), ctx.theme)) ctx.fonts.add(f);
        }
        let runText = "";
        for (const k of kids(n)) {
          const kt = tagOf(k);
          if (kt === "w:t") runText += textOf(k);
          else if (kt === "w:tab" || kt === "w:ptab") runText += "\t";
          else if (kt === "w:br" || kt === "w:cr") {
            if (attr(k, "w:type") !== "page" && attr(k, "w:type") !== "column") runText += "\n";
          } else if (kt === "w:noBreakHyphen") runText += "-";
          else if (kt === "w:drawing") handleDrawing(ctx, k);
          else if (kt === "w:pict" || kt === "w:object") handlePict(ctx, k);
          else if (kt === "mc:AlternateContent") {
            const choice = child(k, "mc:Choice") ?? child(k, "mc:Fallback");
            for (const c of choice ? kids(choice) : []) {
              if (tagOf(c) === "w:drawing") handleDrawing(ctx, c);
              else if (tagOf(c) === "w:pict") handlePict(ctx, c);
            }
          }
        }
        if (/\p{L}/u.test(runText)) {
          letterRuns++;
          if (bold) boldRuns++;
          maxSize = Math.max(maxSize, size);
        }
        text += runText;
        return;
      }
      default:
        // w:hyperlink, w:ins, w:smartTag, w:fldSimple, w:sdt/w:sdtContent, w:customXml, w:moveTo, …
        kids(n).forEach(visit);
    }
  };
  kids(p).forEach(visit);

  text = normaliseText(text);
  const segments = text
    .split(/\t+/)
    .map((s) => collapse(s))
    .filter(Boolean);
  return {
    text: segments.join("   "),
    segments,
    bullet,
    heading,
    bold: letterRuns > 0 && boldRuns === letterRuns,
    size: maxSize || styleSize,
  };
}

/* ---------------- tables ---------------- */

function tableBordered(ctx: Ctx, tbl: XNode): boolean {
  const tblPr = child(tbl, "w:tblPr");
  const visible = (b: XNode | undefined) => !!b && kids(b).some((e) => !/^(nil|none)$/i.test(attr(e, "w:val") ?? "nil"));
  const own = tblPr && child(tblPr, "w:tblBorders");
  if (own) {
    if (visible(own)) return true;
  } else {
    const styleId = tblPr ? attr(child(tblPr, "w:tblStyle") ?? {}, "w:val") : undefined;
    if (styleId && styleChain(ctx, styleId).some((s) => s.bordered)) return true;
  }
  return findAll(tbl, "w:tcBorders").some((b) => visible(b));
}

function readTable(ctx: Ctx, tbl: XNode): Line[] {
  const out: Line[] = [];
  const rows = kids(tbl).filter((k) => tagOf(k) === "w:tr");
  let maxCells = 0;
  let layoutColumns = false;
  let hasDates = false;
  let sample = "";
  for (const tr of rows) {
    const cells = kids(tr).filter((k) => tagOf(k) === "w:tc" || tagOf(k) === "w:sdt");
    maxCells = Math.max(maxCells, cells.length);
    const cellLines = cells.map((tc) => readBlocks(ctx, tagOf(tc) === "w:sdt" ? (child(tc, "w:sdtContent") ?? tc) : tc));
    const nonEmpty = cellLines.filter((c) => c.length > 0);
    const big = nonEmpty.filter((c) => c.length >= 4);
    const words = nonEmpty.flat().reduce((n, l) => n + wordCount(l.text), 0);
    if (big.length >= 2 && words >= 60) layoutColumns = true;
    if (nonEmpty.flat().some((l) => findDateRanges(l.text).length > 0)) hasDates = true;
    if (nonEmpty.length > 0 && nonEmpty.every((c) => c.length === 1)) {
      const segs = nonEmpty.flatMap((c) => c[0].segments);
      const first = nonEmpty[0][0];
      out.push({ ...first, text: segs.join("   "), segments: segs, gapBefore: false });
      if (!sample) sample = truncate(segs.join(" | "));
    } else {
      for (const c of nonEmpty) out.push(...c);
      if (!sample && nonEmpty.length) sample = truncate(nonEmpty.map((c) => c.map((l) => l.text).join(" ")).join(" | "));
    }
  }
  if (!ctx.inTextBox) ctx.tables.push({ rows: rows.length, maxCells, borderless: !tableBordered(ctx, tbl), layoutColumns, hasDates, sample });
  return out;
}

/** Read a container (body, cell, sdtContent) into lines. */
function readBlocks(ctx: Ctx, container: XNode): Line[] {
  const out: Line[] = [];
  let pendingGap = false;
  for (const k of kids(container)) {
    const t = tagOf(k);
    if (t === "w:p") {
      const p = readParagraph(ctx, k);
      if (!p.text.trim()) {
        pendingGap = true;
        continue;
      }
      // Soft line breaks split a paragraph into several lines.
      const parts = p.text.split("\n").map((s) => s.trim()).filter(Boolean);
      parts.forEach((part, i) => {
        const segments = part.split(/ {3,}/).filter(Boolean);
        const bullet = p.bullet && i === 0;
        out.push({
          text: (bullet ? "• " : "") + part,
          segments: bullet ? [`• ${segments[0]}`, ...segments.slice(1)] : segments,
          bullet,
          relSize: p.size / ctx.defaultSize,
          bold: p.bold,
          styledHeading: p.heading,
          indent: null,
          page: 1,
          fillsWidth: null,
          gapBefore: pendingGap || (p.heading && i === 0),
        });
        pendingGap = false;
      });
    } else if (t === "w:tbl") {
      const lines = readTable(ctx, k);
      if (lines.length) lines[0] = { ...lines[0], gapBefore: true };
      out.push(...lines);
    } else if (t === "w:sdt") {
      const c = child(k, "w:sdtContent");
      if (c) out.push(...readBlocks(ctx, c));
    } else if (t === "w:customXml") {
      out.push(...readBlocks(ctx, k));
    } else if (t === "w:sectPr") {
      readSectPr(ctx, k);
    } else if (t === "mc:AlternateContent") {
      const choice = child(k, "mc:Choice") ?? child(k, "mc:Fallback");
      if (choice) out.push(...readBlocks(ctx, choice));
    }
  }
  return out;
}

/* ---------------- entry ---------------- */

export async function parseDocx(buf: Uint8Array): Promise<ParsedDocument> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new UnreadableDocumentError("corrupt");
  }
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new UnreadableDocumentError("corrupt");
  const read = async (path: string) => (zip.file(path) ? await zip.file(path)!.async("string") : null);

  let docXml: string;
  let docTree: XNode[];
  try {
    docXml = await docFile.async("string");
    docTree = parser.parse(docXml) as XNode[];
  } catch {
    throw new UnreadableDocumentError("corrupt");
  }
  const docRoot = docTree.find((n) => tagOf(n) === "w:document");
  const body = docRoot && child(docRoot, "w:body");
  if (!body) throw new UnreadableDocumentError("corrupt");

  const theme = parseTheme(await read("word/theme/theme1.xml"));
  const { styles, defaultSize, defaultFonts } = parseStyles(await read("word/styles.xml"), theme);
  const ctx: Ctx = {
    styles,
    theme,
    defaultSize,
    fonts: new Set(defaultFonts),
    usedStyles: new Set(["Normal"]),
    hidden: [],
    graphics: [],
    tables: [],
    maxCols: 1,
    sectionColumns: 0,
    inTextBox: 0,
  };

  const lines = readBlocks(ctx, body);
  const bodyGraphics = ctx.graphics.length;

  // Headers and footers: read separately; their text is "hidden" from a body-only parser.
  const hfPaths = Object.keys(zip.files)
    .filter((p) => /^word\/(header|footer)\d*\.xml$/.test(p))
    .sort();
  const seenHf = new Set<string>();
  for (const path of hfPaths) {
    const xml = await read(path);
    if (!xml) continue;
    const root = (parser.parse(xml) as XNode[]).find((n) => tagOf(n) === "w:hdr" || tagOf(n) === "w:ftr");
    if (!root) continue;
    const hiddenBefore = ctx.hidden.length;
    const tablesBefore = ctx.tables.length;
    const hfLines = readBlocks(ctx, root);
    // Tables inside headers are not body tables; text boxes inside headers count as header text.
    ctx.tables.length = tablesBefore;
    const boxed = ctx.hidden.splice(hiddenBefore).map((h) => h.text);
    const text = [...hfLines.map((l) => l.text.replace(/^• /, "")), ...boxed].join("\n").trim();
    const where = path.includes("header") ? "header" : "footer";
    if (!text || seenHf.has(`${where}:${text}`)) continue;
    seenHf.add(`${where}:${text}`);
    ctx.hidden.push({ where, text });
  }
  ctx.graphics.length = bodyGraphics; // header logos are not in the content flow

  for (const id of ctx.usedStyles) for (const s of styleChain(ctx, id)) for (const f of s.fonts) ctx.fonts.add(f);

  const fonts = new Set<string>();
  for (const f of ctx.fonts) {
    const c = cleanFontName(f);
    if (c) fonts.add(c);
  }

  let sourceHtml: string | null = null;
  try {
    const res = await mammoth.convertToHtml(
      { buffer: Buffer.from(buf) },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const b64 = await image.read("base64");
          // Keep small images inline so the preview looks right; drop large ones to bound the payload.
          if (b64.length > 150_000) return { src: "", alt: "Image" };
          return { src: `data:${image.contentType};base64,${b64}` };
        }),
      },
    );
    sourceHtml = res.value
      .replace(/<img src=""[^>]*>/g, "")
      .replace(/href="(?!https?:|mailto:|tel:|#)[^"]*"/gi, 'href="#"');
  } catch {
    sourceHtml = null;
  }

  // Page count as last saved by Word (docProps/app.xml). Absent in many generated files: then unknown.
  let pageCount: number | null = null;
  try {
    const app = await read("docProps/app.xml");
    const m = app?.match(/<(?:\w+:)?Pages>\s*(\d{1,3})\s*</);
    if (m && Number(m[1]) > 0) pageCount = Number(m[1]);
  } catch {
    pageCount = null;
  }

  // Columns: newspaper sections, or a table that puts two big blocks side by side.
  const tableCols = ctx.tables.some((t) => t.layoutColumns) ? 2 : 1;

  return {
    kind: "docx",
    pageCount,
    lines,
    readingLines: lines,
    rawText: renderRaw(lines),
    sourceHtml,
    fonts: [...fonts].sort(),
    columns: Math.max(ctx.maxCols, tableCols),
    columnEvidence: [],
    textlessPages: [],
    graphics: ctx.graphics,
    hidden: ctx.hidden,
    tables: ctx.tables,
    sectionColumns: ctx.sectionColumns,
  };
}

function renderRaw(lines: Line[]): string {
  const parts: string[] = [];
  for (const l of lines) {
    if (parts.length && l.gapBefore) parts.push("");
    parts.push(l.text);
  }
  return parts.join("\n");
}

const round1 = (n: number) => Math.round(n * 10) / 10;
