// Tiny raw-OOXML builder used to generate the DOCX fixture corpus.
// Writing the XML by hand (rather than via a high-level library) lets the
// fixtures contain exactly the structures real CV templates use and parsers
// trip over: header contacts, borderless layout tables, VML text boxes,
// inline images, multi-column sections and decorative fonts.
import JSZip from "jszip";

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Points. */
  size?: number;
  font?: string;
  color?: string;
}

export interface Para {
  type: "p";
  runs: Run[];
  style?: "Title" | "Heading1" | "Heading2";
  bullet?: boolean;
  align?: "left" | "center" | "right";
  /** Adds a right-aligned tab stop at the text margin (for right-aligned dates). */
  rightTab?: boolean;
  /** Twips of spacing after the paragraph. */
  after?: number;
  before?: number;
  /** Section break carried by this paragraph (ends a section). */
  sectionCols?: number;
}

export interface Table {
  type: "table";
  rows: Block[][][];
  borders?: boolean;
  /** Column widths in twips. */
  widths: number[];
  shading?: (string | null)[];
}

export interface TextBox {
  type: "textbox";
  content: Para[];
  widthPt: number;
  heightPt: number;
}

export interface ImageRow {
  type: "images";
  images: { png: Buffer; widthPt: number; heightPt: number }[];
  /** Optional text before the images in the same paragraph. */
  label?: Run[];
  rightTab?: boolean;
}

export interface PageBreak {
  type: "pagebreak";
}

export type Block = Para | Table | TextBox | ImageRow | PageBreak;

export interface DocSpec {
  font: string;
  /** Body size in points. */
  size: number;
  header?: Para[];
  footer?: Para[];
  /** Columns for the final section. */
  cols?: number;
  body: Block[];
  /** Page margins in twips (default 1000 ≈ 1.76 cm). */
  margin?: number;
  /** Extra fonts to mention in styles (e.g. heading font). */
  headingFont?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PAGE_W = 11906; // A4 twips
const PAGE_H = 16838;

export const p = (text: string | Run[], opts: Omit<Para, "type" | "runs"> = {}): Para => ({
  type: "p",
  runs: typeof text === "string" ? [{ text }] : text,
  ...opts,
});
export const h = (text: string, opts: Omit<Para, "type" | "runs"> = {}): Para => p([{ text }], { style: "Heading1", ...opts });
export const b = (text: string): Para => p(text, { bullet: true });

class Ctx {
  rels: { id: string; type: string; target: string }[] = [];
  media: { name: string; data: Buffer }[] = [];
  shapeId = 1;
  addImage(png: Buffer): string {
    const n = this.media.length + 1;
    const name = `image${n}.png`;
    this.media.push({ name, data: png });
    const id = `rIdImg${n}`;
    this.rels.push({ id, type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image", target: `media/${name}` });
    return id;
  }
}

function runXml(r: Run): string {
  const props: string[] = [];
  if (r.font) props.push(`<w:rFonts w:ascii="${esc(r.font)}" w:hAnsi="${esc(r.font)}" w:cs="${esc(r.font)}"/>`);
  if (r.bold) props.push("<w:b/>");
  if (r.italic) props.push("<w:i/>");
  if (r.color) props.push(`<w:color w:val="${r.color}"/>`);
  if (r.size) props.push(`<w:sz w:val="${Math.round(r.size * 2)}"/>`);
  const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
  const parts = r.text.split(/(\t|\n)/);
  const inner = parts
    .map((t) => (t === "\t" ? "<w:tab/>" : t === "\n" ? "<w:br/>" : t ? `<w:t xml:space="preserve">${esc(t)}</w:t>` : ""))
    .join("");
  return `<w:r>${rPr}${inner}</w:r>`;
}

function pPr(para: Pick<Para, "style" | "bullet" | "align" | "rightTab" | "after" | "before">, sect?: string): string {
  const props: string[] = [];
  if (para.style) props.push(`<w:pStyle w:val="${para.style}"/>`);
  if (para.bullet) props.push(`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>`);
  if (para.rightTab) props.push(`<w:tabs><w:tab w:val="right" w:pos="9900"/></w:tabs>`);
  if (para.after !== undefined || para.before !== undefined)
    props.push(`<w:spacing w:before="${para.before ?? 0}" w:after="${para.after ?? 80}"/>`);
  if (para.align && para.align !== "left") props.push(`<w:jc w:val="${para.align}"/>`);
  if (sect) props.push(sect);
  return props.length ? `<w:pPr>${props.join("")}</w:pPr>` : "";
}

function paraXml(para: Para, ctx: Ctx, margin: number): string {
  const sect = para.sectionCols ? sectPr(ctx, para.sectionCols, margin, false) : undefined;
  return `<w:p>${pPr(para, sect)}${para.runs.map(runXml).join("")}</w:p>`;
}

function imageXml(id: string, wPt: number, hPt: number, ctx: Ctx): string {
  const cx = Math.round(wPt * 12700);
  const cy = Math.round(hPt * 12700);
  const n = ctx.shapeId++;
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="img${n}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function blockXml(block: Block, ctx: Ctx, margin: number): string {
  switch (block.type) {
    case "p":
      return paraXml(block, ctx, margin);
    case "pagebreak":
      return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    case "images": {
      const runs = (block.label ?? []).map(runXml).join("");
      const imgs = block.images.map((im) => imageXml(ctx.addImage(im.png), im.widthPt, im.heightPt, ctx)).join(`<w:r><w:t xml:space="preserve"> </w:t></w:r>`);
      const tab = block.rightTab ? `<w:r><w:tab/></w:r>` : "";
      return `<w:p>${pPr({ rightTab: block.rightTab, after: 60 })}${runs}${tab}${imgs}</w:p>`;
    }
    case "textbox": {
      const n = ctx.shapeId++;
      const inner = block.content.map((c) => paraXml(c, ctx, margin)).join("");
      return `<w:p><w:r><w:pict><v:shape id="TextBox${n}" o:spid="_x0000_s${1024 + n}" type="#_x0000_t202" style="width:${block.widthPt}pt;height:${block.heightPt}pt" strokecolor="#999999"><v:textbox><w:txbxContent>${inner}</w:txbxContent></v:textbox></v:shape></w:pict></w:r></w:p>`;
    }
    case "table": {
      const borderVal = block.borders ? `w:val="single" w:sz="4" w:space="0" w:color="999999"` : `w:val="nil"`;
      const borders = ["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} ${borderVal}/>`).join("");
      const grid = block.widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
      const rows = block.rows
        .map(
          (row) =>
            `<w:tr>${row
              .map((cell, i) => {
                const shade = block.shading?.[i] ? `<w:shd w:val="clear" w:color="auto" w:fill="${block.shading[i]}"/>` : "";
                const content = cell.length ? cell.map((c) => blockXml(c, ctx, margin)).join("") : "<w:p/>";
                return `<w:tc><w:tcPr><w:tcW w:w="${block.widths[i]}" w:type="dxa"/>${shade}</w:tcPr>${content}</w:tc>`;
              })
              .join("")}</w:tr>`,
        )
        .join("");
      return `<w:tbl><w:tblPr><w:tblW w:w="${block.widths.reduce((a, c) => a + c, 0)}" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`;
    }
  }
}

function sectPr(ctx: Ctx, cols: number, margin: number, withRefs: boolean, refs: string[] = []): string {
  const refXml = withRefs ? refs.join("") : "";
  return `<w:sectPr>${refXml}<w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="500" w:footer="500" w:gutter="0"/><w:cols w:num="${cols}" w:space="500"/></w:sectPr>`;
}

const NS = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"`;

export async function buildDocx(spec: DocSpec): Promise<Buffer> {
  const ctx = new Ctx();
  const margin = spec.margin ?? 1000;
  const zip = new JSZip();
  const refs: string[] = [];
  const extraParts: { path: string; xml: string; ct: string }[] = [];

  if (spec.header) {
    const hctx = new Ctx();
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${spec.header.map((x) => paraXml(x, hctx, margin)).join("")}</w:hdr>`;
    extraParts.push({ path: "word/header1.xml", xml, ct: "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml" });
    ctx.rels.push({ id: "rIdH1", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header", target: "header1.xml" });
    refs.push(`<w:headerReference w:type="default" r:id="rIdH1"/>`);
  }
  if (spec.footer) {
    const fctx = new Ctx();
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${spec.footer.map((x) => paraXml(x, fctx, margin)).join("")}</w:ftr>`;
    extraParts.push({ path: "word/footer1.xml", xml, ct: "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml" });
    ctx.rels.push({ id: "rIdF1", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer", target: "footer1.xml" });
    refs.push(`<w:footerReference w:type="default" r:id="rIdF1"/>`);
  }

  const body = spec.body.map((blk) => blockXml(blk, ctx, margin)).join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${sectPr(ctx, spec.cols ?? 1, margin, true, refs)}</w:body></w:document>`;

  const hf = spec.headingFont ?? spec.font;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${esc(spec.font)}" w:hAnsi="${esc(spec.font)}" w:cs="${esc(spec.font)}"/><w:sz w:val="${spec.size * 2}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:rFonts w:ascii="${esc(hf)}" w:hAnsi="${esc(hf)}"/><w:b/><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:rFonts w:ascii="${esc(hf)}" w:hAnsi="${esc(hf)}"/><w:b/><w:color w:val="1F3864"/><w:sz w:val="${Math.round(spec.size * 2 * 1.25)}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="40"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
</w:styles>`;

  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="260"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

  ctx.rels.push({ id: "rIdStyles", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles", target: "styles.xml" });
  ctx.rels.push({ id: "rIdNum", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering", target: "numbering.xml" });

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${ctx.rels
    .map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`)
    .join("")}</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>${extraParts
    .map((x) => `<Override PartName="/${x.path}" ContentType="${x.ct}"/>`)
    .join("")}</Types>`;

  zip.file("[Content_Types].xml", contentTypes);
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file("word/document.xml", doc);
  zip.file("word/styles.xml", styles);
  zip.file("word/numbering.xml", numbering);
  zip.file("word/_rels/document.xml.rels", rels);
  for (const x of extraParts) zip.file(x.path, x.xml);
  for (const m of ctx.media) zip.file(`word/media/${m.name}`, m.data);
  // Fixed date so output bytes are reproducible.
  const date = new Date("2024-01-01T00:00:00Z");
  zip.forEach((_, f) => {
    f.date = date;
  });
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
