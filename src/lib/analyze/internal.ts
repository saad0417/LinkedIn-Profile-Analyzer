// Internal structures shared between the parsers, profile extraction and checks.
// Nothing here crosses the API boundary; see src/lib/types.ts for that.
import type { DocKind } from "@/lib/types";

/** One line of text in reading order, as a parser would see it. */
export interface Line {
  /** Text with whitespace collapsed. Wide horizontal gaps are kept as three spaces. */
  text: string;
  /** Pieces of the line separated by wide gaps (PDF) or tabs (DOCX). */
  segments: string[];
  /** Starts with a bullet glyph or is a Word list item. */
  bullet: boolean;
  /** Font size relative to the document's body text (1 = body size). Null when unknown. */
  relSize: number | null;
  /** Every character on the line is bold. */
  bold: boolean;
  /** Paragraph uses a Word heading/title style. */
  styledHeading: boolean;
  /** Horizontal offset from the page's left text edge, in points (PDF only). */
  indent: number | null;
  page: number;
  /** PDF only: the line runs to (near) the right edge of the page's text block, so the next line may continue it. */
  fillsWidth: boolean | null;
  /** A visible paragraph break precedes this line. */
  gapBefore: boolean;
}

export interface PlacedGraphic {
  kind: "image" | "shape";
  widthPt: number;
  heightPt: number;
  page: number;
  /** Area as a fraction of the page area (PDF only, else null). */
  pageFraction: number | null;
}

export interface HiddenText {
  where: "header" | "footer" | "text box";
  text: string;
}

export interface TableInfo {
  rows: number;
  maxCells: number;
  borderless: boolean;
  /** A row places large blocks of content side by side (sidebar / column layout). */
  layoutColumns: boolean;
  hasDates: boolean;
  /** Text of the first non-empty row, for evidence. */
  sample: string;
}

export interface ColumnEvidence {
  page: number;
  /** Lines where text from both columns was merged by a left-to-right read. */
  mixedLines: string[];
}

export interface ParsedDocument {
  kind: DocKind;
  pageCount: number | null;
  /** Lines in naive left-to-right order: exactly what `rawText` shows. */
  lines: Line[];
  /**
   * Lines in column-aware reading order (PDF pages with a detected gutter read
   * left column, then right column). Same as `lines` when there are no columns.
   */
  readingLines: Line[];
  rawText: string;
  sourceHtml: string | null;
  fonts: string[];
  columns: number;
  columnEvidence: ColumnEvidence[];
  /** Pages with (almost) no extractable text. 1-based. */
  textlessPages: number[];
  graphics: PlacedGraphic[];
  /** DOCX only. Text the body-only reading skipped. */
  hidden: HiddenText[];
  /** DOCX only. Null for PDF (not evaluated). */
  tables: TableInfo[] | null;
  /** DOCX only: number of sections laid out in 2+ newspaper columns. */
  sectionColumns: number;
}
