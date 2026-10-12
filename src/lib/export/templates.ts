/**
 * Template style specs. Each spec is consumed by both the DOCX and the PDF
 * renderer, so the two formats share one hierarchy and one look.
 *
 * ATS-safe templates (every category except "creative") obey: single column
 * reading order, no tables, no text boxes or shapes holding text (a shaded
 * paragraph background is fine), contact details in the body, dictionary
 * section headings, system-safe fonts, simple bullets, one date format.
 * "Fancy" is colour, typography and spacing only.
 *
 * Creative templates use a two-column layout (a DOCX table / two PDF
 * columns). They are labelled "not for ATS uploads" everywhere.
 */
import type { TemplateId } from "@/lib/types";
import { TEMPLATES as META, TEMPLATE_IDS, isTemplateId, getTemplate } from "./registry";

export { TEMPLATE_IDS, isTemplateId, getTemplate };

export type SectionKey = "summary" | "experience" | "education" | "skills" | "certifications";

/** Section headings exactly as the parser dictionary expects them. */
export const SECTION_HEADINGS: Record<SectionKey, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
};

type Hex = string; // "rrggbb", no '#'

export interface TemplateStyle {
  id: TemplateId;
  /** Font family written into the DOCX. */
  docxFont: string;
  /** Standard-14 family used by the PDF renderer. */
  pdfFont: "helvetica" | "times";
  /**
   * Optional second family for the name, monogram and section headings
   * (e.g. Cambria headings over Calibri body text). Defaults to the body font.
   */
  display?: { docx: string; pdf: "helvetica" | "times" };
  /** PDF sizes are DOCX sizes x this factor (Helvetica runs wider than Calibri, Times narrower than Georgia). */
  pdfScale: number;
  /** Page margins in points. */
  margin: { x: number; y: number };
  /** Point sizes. */
  size: { name: number; headline: number; contact: number; heading: number; body: number; sub: number };
  /** Body line spacing as a multiple of "single". */
  leading: number;
  /** Name / headline / contact alignment. Body text is always left-aligned. */
  headerAlign: "left" | "center";
  color: {
    text: Hex;
    muted: Hex;
    accent: Hex;
    rule: Hex;
    heading: Hex;
    headline: Hex;
    name: Hex;
    date: Hex;
  };
  /** `bold` defaults to true. */
  name: { caps: boolean; tracking: number; bold?: boolean };
  headline: { caps: boolean; tracking: number; bold: boolean; italic?: boolean };
  heading: {
    /** "small" = DOCX small caps / PDF reduced-size capitals. Text stays "Experience" either way. */
    caps: "all" | "small" | "none";
    tracking: number;
    /** Bottom rule thickness in points. 0 = none. */
    rule: number;
    /**
     * "full" = across the column; "short" = a short accent bar under the heading
     * start (centred under a centred heading); "top" = a full rule above the heading.
     */
    ruleStyle: "full" | "short" | "top";
    /** Heading alignment. Default "left". */
    align?: "left" | "center";
    /** Vertical accent bar at the heading's left edge (DOCX left paragraph border), width in points. */
    bar?: number;
    /** Tinted band behind the heading (DOCX paragraph shading, PDF rectangle behind real text). */
    fill?: Hex;
    /** Space before a section heading, points. */
    before: number;
    after: number;
  };
  /** Separator between contact parts. */
  contactSep: string;
  /**
   * Coloured band behind name / headline / contact (DOCX paragraph shading,
   * PDF filled rectangle behind real text). Text stays in the body.
   */
  band: { fill: Hex; name: Hex; headline: Hex; contact: Hex; pad: number } | null;
  /**
   * Header arrangement (ATS-safe; all real body text):
   * "stack"    = name, headline, contact on their own lines (default);
   * "split"    = name + headline on the left, contact right-aligned on the same
   *              lines via a right tab stop (not a table);
   * "monogram" = large initials as coloured text on the name line, name block
   *              indented beside them via a tab stop.
   */
  headerStyle?: "stack" | "split" | "monogram";
  /** Monogram initials: colour, size (pt) and width of the initials column (pt). */
  monogram?: { color: Hex; size: number; width: number };
  /** Rule under the whole header block (DOCX paragraph border). */
  headerRule?: { weight: number; color: Hex; double?: boolean; space: number };
  /** "timeline" = dates in a left column via tab stops (not a table). */
  layout: "single" | "timeline";
  /** Timeline date-column width in points. */
  dateColumn: number;
  sections: SectionKey[];
  headings: Partial<Record<SectionKey, string>>;
  /** grouped = "Label: a, b" lines; inline = comma paragraph; pipe = "a | b | c" line(s). */
  skills: "inline" | "grouped" | "pipe";
  /** Which fact leads an experience entry's first line. Title-first parses most reliably. */
  experienceLead: "title" | "company";
  /** Styling of the entry's second line (company · location). "inline" = no second line, one header line. */
  entrySub: "italic" | "accent" | "muted" | "inline";
  educationLead: "degree" | "institution";
  /** Space between entries, points. */
  entryGap: number;
  /** Two-column creative layout. null for every ATS-safe template. */
  columns: ColumnSpec | null;
}

export interface ColumnSpec {
  side: "left" | "right";
  /** Side column width in points (PDF) / proportion source for DOCX. */
  width: number;
  /** Side column background. */
  fill: Hex;
  /** Colours inside the side column. */
  text: Hex;
  muted: Hex;
  heading: Hex;
  /**
   * Where name + headline live: top of the side column ("side"), a full-width
   * header ("top"), the top of the main column with contact details in the side
   * column ("main"), or a full-bleed dark band with a monogram tile ("band").
   */
  header: "side" | "top" | "main" | "band";
  /** "band" header: band fill, monogram tile fill, and text colours on the band. */
  band?: { fill: Hex; tile: Hex; tileText: Hex; name: Hex; headline: Hex; contact: Hex; height: number };
  /** Rule under a "top" header. Default 1.2 pt in the accent colour. */
  topRule?: { weight: number; color: Hex };
  /** Thin vertical rule between the columns instead of a filled panel. */
  divider?: Hex;
  sideSections: SectionKey[];
  /** Skills in the side column: one per line, or shaded chips. */
  skills: "list" | "chips";
  chipFill: Hex;
  /** Bleed the side column to the page edges (zero page margin). */
  bleed: boolean;
}

const base = {
  pdfScale: 1,
  margin: { x: 54, y: 54 },
  leading: 1.05,
  name: { caps: false, tracking: 0 },
  headline: { caps: false, tracking: 0, bold: false },
  contactSep: "  |  ",
  band: null,
  layout: "single" as const,
  dateColumn: 0,
  headings: {},
  entryGap: 7,
  columns: null,
} satisfies Partial<TemplateStyle>;

const ALL: SectionKey[] = ["summary", "experience", "education", "skills", "certifications"];

export const TEMPLATES: Record<TemplateId, TemplateStyle> = {
  /* ------------------------------ ATS classic ------------------------------ */
  standard: {
    ...base,
    id: "standard",
    docxFont: "Calibri",
    pdfFont: "helvetica",
    pdfScale: 0.93,
    size: { name: 22, headline: 11.5, contact: 10, heading: 11, body: 10.5, sub: 10.5 },
    headerAlign: "center",
    color: { text: "1F2328", muted: "57606A", accent: "1F2328", rule: "8C959F", heading: "1F2328", headline: "57606A", name: "1F2328", date: "1F2328" },
    heading: { caps: "all", tracking: 0.6, rule: 0.75, ruleStyle: "full", before: 12, after: 5 },
    sections: ALL,
    skills: "inline",
    experienceLead: "title",
    entrySub: "italic",
    educationLead: "degree",
  },
  technical: {
    ...base,
    id: "technical",
    docxFont: "Arial",
    pdfFont: "helvetica",
    size: { name: 20, headline: 11.5, contact: 9.5, heading: 10.5, body: 10, sub: 10 },
    headerAlign: "left",
    color: { text: "1B1F24", muted: "5A6270", accent: "1D4E89", rule: "1D4E89", heading: "1D4E89", headline: "1D4E89", name: "1B1F24", date: "1B1F24" },
    heading: { caps: "all", tracking: 0.8, rule: 0.75, ruleStyle: "full", before: 12, after: 5 },
    sections: ["summary", "skills", "experience", "education", "certifications"],
    skills: "grouped",
    experienceLead: "title",
    entrySub: "accent",
    educationLead: "degree",
  },
  entry: {
    ...base,
    id: "entry",
    docxFont: "Georgia",
    pdfFont: "times",
    pdfScale: 1.04,
    size: { name: 22, headline: 11.5, contact: 10, heading: 11, body: 10.5, sub: 10.5 },
    headerAlign: "center",
    color: { text: "1E2422", muted: "5B6461", accent: "2C4A3E", rule: "2C4A3E", heading: "2C4A3E", headline: "5B6461", name: "1E2422", date: "1E2422" },
    heading: { caps: "all", tracking: 1, rule: 0.5, ruleStyle: "full", before: 12, after: 5 },
    sections: ["summary", "education", "experience", "skills", "certifications"],
    skills: "inline",
    experienceLead: "title",
    entrySub: "italic",
    educationLead: "institution",
  },
  executive: {
    ...base,
    id: "executive",
    docxFont: "Cambria",
    pdfFont: "times",
    pdfScale: 1.02,
    margin: { x: 58, y: 50 },
    size: { name: 23, headline: 10.5, contact: 9.5, heading: 11, body: 10.5, sub: 10.5 },
    leading: 1.08,
    headerAlign: "center",
    color: { text: "1C1E21", muted: "5C6168", accent: "1F3B5C", rule: "1F3B5C", heading: "1F3B5C", headline: "1F3B5C", name: "1C1E21", date: "3A3F45" },
    name: { caps: true, tracking: 2.2 },
    headline: { caps: true, tracking: 1.6, bold: true },
    contactSep: "  ·  ",
    heading: { caps: "small", tracking: 1.2, rule: 1, ruleStyle: "full", before: 13, after: 5 },
    sections: ["summary", "skills", "experience", "education", "certifications"],
    headings: { summary: "Executive Summary", skills: "Core Competencies" },
    skills: "pipe",
    experienceLead: "title",
    entrySub: "italic",
    educationLead: "degree",
    entryGap: 8,
  },
  compact: {
    ...base,
    id: "compact",
    docxFont: "Arial",
    pdfFont: "helvetica",
    pdfScale: 0.98,
    margin: { x: 40, y: 36 },
    size: { name: 17, headline: 10, contact: 9, heading: 9.5, body: 9.5, sub: 9.5 },
    leading: 1,
    headerAlign: "left",
    color: { text: "16191D", muted: "555B63", accent: "2B3A4A", rule: "2B3A4A", heading: "16191D", headline: "2B3A4A", name: "16191D", date: "40464D" },
    heading: { caps: "all", tracking: 0.7, rule: 0.6, ruleStyle: "full", before: 8, after: 3 },
    sections: ALL,
    skills: "grouped",
    experienceLead: "title",
    entrySub: "inline",
    educationLead: "degree",
    entryGap: 4,
  },

  corporate: {
    ...base,
    id: "corporate",
    docxFont: "Calibri",
    pdfFont: "helvetica",
    pdfScale: 0.93,
    display: { docx: "Cambria", pdf: "times" },
    margin: { x: 60, y: 52 },
    size: { name: 25, headline: 10.5, contact: 9.5, heading: 12.5, body: 10.5, sub: 10.5 },
    leading: 1.07,
    headerAlign: "center",
    color: { text: "1D232B", muted: "56606C", accent: "14365D", rule: "A7B1BD", heading: "14365D", headline: "3E4A57", name: "14365D", date: "3E4A57" },
    name: { caps: false, tracking: 0.4 },
    headline: { caps: true, tracking: 1.5, bold: false },
    contactSep: "  |  ",
    headerRule: { weight: 0.6, color: "14365D", double: true, space: 7 },
    heading: { caps: "small", tracking: 0.6, rule: 0.6, ruleStyle: "full", before: 13, after: 5 },
    sections: ALL,
    skills: "pipe",
    experienceLead: "title",
    entrySub: "italic",
    educationLead: "degree",
    entryGap: 8,
  },
  senior: {
    ...base,
    id: "senior",
    docxFont: "Tahoma",
    pdfFont: "helvetica",
    pdfScale: 0.97,
    margin: { x: 56, y: 50 },
    size: { name: 23, headline: 10.5, contact: 9.5, heading: 10.5, body: 10, sub: 10 },
    leading: 1.1,
    headerAlign: "left",
    color: { text: "1E2124", muted: "5D646B", accent: "0B5A6E", rule: "1E2124", heading: "1E2124", headline: "0B5A6E", name: "1E2124", date: "3D4349" },
    headline: { caps: true, tracking: 1.3, bold: true },
    contactSep: "  |  ",
    heading: { caps: "all", tracking: 1.4, rule: 1.75, ruleStyle: "top", before: 15, after: 6 },
    sections: ["summary", "skills", "experience", "education", "certifications"],
    headings: { summary: "Professional Summary", skills: "Core Competencies" },
    skills: "grouped",
    experienceLead: "company",
    entrySub: "accent",
    educationLead: "degree",
    entryGap: 11,
  },
  serif: {
    ...base,
    id: "serif",
    docxFont: "Georgia",
    pdfFont: "times",
    pdfScale: 1.04,
    margin: { x: 64, y: 46 },
    size: { name: 26, headline: 11.5, contact: 9.5, heading: 11, body: 10.5, sub: 10.5 },
    leading: 1.06,
    headerAlign: "center",
    color: { text: "26221F", muted: "6B625B", accent: "7A2E2A", rule: "7A2E2A", heading: "7A2E2A", headline: "5A514A", name: "1E1A17", date: "6B625B" },
    name: { caps: false, tracking: 0.8, bold: false },
    headline: { caps: false, tracking: 0.3, bold: false, italic: true },
    contactSep: "  ·  ",
    headerRule: { weight: 0.5, color: "C9BBAE", space: 7 },
    heading: { caps: "small", tracking: 2, rule: 0.9, ruleStyle: "short", align: "center", before: 13, after: 6 },
    sections: ALL,
    skills: "inline",
    experienceLead: "title",
    entrySub: "italic",
    educationLead: "degree",
    entryGap: 8,
  },

  /* ------------------------------ ATS modern ------------------------------ */
  modern: {
    ...base,
    id: "modern",
    docxFont: "Calibri",
    pdfFont: "helvetica",
    pdfScale: 0.93,
    margin: { x: 54, y: 50 },
    size: { name: 26, headline: 12, contact: 9.5, heading: 11.5, body: 10.5, sub: 10.5 },
    headerAlign: "left",
    color: { text: "1E2329", muted: "5E6773", accent: "0F7C78", rule: "0F7C78", heading: "0F7C78", headline: "0F7C78", name: "0F7C78", date: "5E6773" },
    headline: { caps: false, tracking: 0, bold: true },
    contactSep: "  ·  ",
    heading: { caps: "all", tracking: 1.1, rule: 1.5, ruleStyle: "short", before: 14, after: 6 },
    sections: ALL,
    skills: "pipe",
    experienceLead: "title",
    entrySub: "accent",
    educationLead: "degree",
    entryGap: 8,
  },
  minimal: {
    ...base,
    id: "minimal",
    docxFont: "Garamond",
    pdfFont: "times",
    pdfScale: 0.98,
    margin: { x: 68, y: 62 },
    size: { name: 24, headline: 11.5, contact: 10, heading: 11.5, body: 11, sub: 11 },
    leading: 1.12,
    headerAlign: "left",
    color: { text: "222222", muted: "6F6F6F", accent: "222222", rule: "D0D0D0", heading: "4A4A4A", headline: "6F6F6F", name: "111111", date: "8A8A8A" },
    name: { caps: false, tracking: 0.4 },
    headline: { caps: false, tracking: 0.2, bold: false },
    contactSep: "  |  ",
    heading: { caps: "small", tracking: 2.4, rule: 0, ruleStyle: "full", before: 20, after: 7 },
    sections: ALL,
    skills: "inline",
    experienceLead: "title",
    entrySub: "muted",
    educationLead: "degree",
    entryGap: 10,
  },
  bold: {
    ...base,
    id: "bold",
    docxFont: "Arial",
    pdfFont: "helvetica",
    margin: { x: 54, y: 40 },
    size: { name: 25, headline: 11.5, contact: 9.5, heading: 11, body: 10, sub: 10 },
    headerAlign: "left",
    color: { text: "1A1F2B", muted: "5B6475", accent: "C2410C", rule: "C2410C", heading: "1E2A44", headline: "FDBA74", name: "FFFFFF", date: "5B6475" },
    headline: { caps: true, tracking: 1.4, bold: true },
    contactSep: "  |  ",
    band: { fill: "1E2A44", name: "FFFFFF", headline: "FDBA74", contact: "D9DEE8", pad: 16 },
    heading: { caps: "all", tracking: 1, rule: 2, ruleStyle: "short", before: 14, after: 6 },
    sections: ALL,
    skills: "pipe",
    experienceLead: "title",
    entrySub: "accent",
    educationLead: "degree",
    entryGap: 8,
  },
  timeline: {
    ...base,
    id: "timeline",
    docxFont: "Georgia",
    pdfFont: "times",
    pdfScale: 1.03,
    margin: { x: 54, y: 48 },
    size: { name: 24, headline: 11.5, contact: 9.5, heading: 10.5, body: 10, sub: 10 },
    leading: 1.05,
    headerAlign: "left",
    color: { text: "1F2430", muted: "5D6577", accent: "4C3F91", rule: "C9C4E3", heading: "4C3F91", headline: "4C3F91", name: "1F2430", date: "4C3F91" },
    headline: { caps: false, tracking: 0.2, bold: false },
    contactSep: "  ·  ",
    heading: { caps: "all", tracking: 1.6, rule: 0.75, ruleStyle: "full", before: 14, after: 7 },
    layout: "timeline",
    dateColumn: 112,
    sections: ALL,
    skills: "pipe",
    experienceLead: "title",
    entrySub: "italic",
    educationLead: "degree",
    entryGap: 9,
  },

  accent: {
    ...base,
    id: "accent",
    docxFont: "Calibri",
    pdfFont: "helvetica",
    pdfScale: 0.93,
    margin: { x: 56, y: 50 },
    size: { name: 27, headline: 12, contact: 9.5, heading: 13.5, body: 10.5, sub: 10.5 },
    leading: 1.08,
    headerAlign: "left",
    color: { text: "1F2430", muted: "5F6878", accent: "3554C8", rule: "3554C8", heading: "1F2430", headline: "3554C8", name: "1F2430", date: "5F6878" },
    contactSep: "  ·  ",
    headerRule: { weight: 0.5, color: "D3D8E2", space: 9 },
    heading: { caps: "none", tracking: 0.2, rule: 0, ruleStyle: "full", bar: 3.5, before: 15, after: 6 },
    sections: ALL,
    skills: "pipe",
    experienceLead: "title",
    entrySub: "accent",
    educationLead: "degree",
    entryGap: 8,
  },
  split: {
    ...base,
    id: "split",
    docxFont: "Arial",
    pdfFont: "helvetica",
    margin: { x: 52, y: 48 },
    size: { name: 25, headline: 11.5, contact: 9, heading: 10.5, body: 10, sub: 10 },
    leading: 1.06,
    headerAlign: "left",
    color: { text: "1B2026", muted: "5C6670", accent: "2E7D5B", rule: "2E7D5B", heading: "2E7D5B", headline: "2E7D5B", name: "1B2026", date: "5C6670" },
    headline: { caps: false, tracking: 0.2, bold: true },
    contactSep: "  ·  ",
    headerStyle: "split",
    headerRule: { weight: 2, color: "2E7D5B", space: 8 },
    heading: { caps: "all", tracking: 1.2, rule: 0.5, ruleStyle: "full", before: 14, after: 6 },
    sections: ALL,
    skills: "pipe",
    experienceLead: "title",
    entrySub: "muted",
    educationLead: "degree",
    entryGap: 8,
  },
  monogram: {
    ...base,
    id: "monogram",
    docxFont: "Palatino Linotype",
    pdfFont: "times",
    pdfScale: 1.03,
    margin: { x: 58, y: 52 },
    size: { name: 24, headline: 11.5, contact: 9.5, heading: 11, body: 10.5, sub: 10.5 },
    leading: 1.08,
    headerAlign: "left",
    color: { text: "24211E", muted: "6A635C", accent: "A2552A", rule: "DCCBBD", heading: "A2552A", headline: "6A635C", name: "24211E", date: "6A635C" },
    headline: { caps: true, tracking: 1.4, bold: false },
    contactSep: "  ·  ",
    headerStyle: "monogram",
    monogram: { color: "A2552A", size: 40, width: 90 },
    headerRule: { weight: 1, color: "A2552A", space: 8 },
    heading: { caps: "all", tracking: 1.8, rule: 0.6, ruleStyle: "full", before: 15, after: 6 },
    sections: ALL,
    skills: "inline",
    experienceLead: "title",
    entrySub: "italic",
    educationLead: "degree",
    entryGap: 9,
  },
  band: {
    ...base,
    id: "band",
    docxFont: "Trebuchet MS",
    pdfFont: "helvetica",
    pdfScale: 0.98,
    margin: { x: 54, y: 48 },
    size: { name: 26, headline: 11.5, contact: 9.5, heading: 10.5, body: 10, sub: 10 },
    leading: 1.08,
    headerAlign: "center",
    color: { text: "1C2A33", muted: "5A6B76", accent: "17617A", rule: "17617A", heading: "124A5D", headline: "17617A", name: "124A5D", date: "5A6B76" },
    headline: { caps: true, tracking: 1.4, bold: false },
    contactSep: "  ·  ",
    heading: { caps: "all", tracking: 1.4, rule: 0, ruleStyle: "full", fill: "E2EEF2", before: 13, after: 7 },
    sections: ALL,
    skills: "pipe",
    experienceLead: "title",
    entrySub: "accent",
    educationLead: "degree",
    entryGap: 8,
  },

  /* ------------------------------ Creative ------------------------------ */
  sidebar: {
    ...base,
    id: "sidebar",
    docxFont: "Calibri",
    pdfFont: "helvetica",
    pdfScale: 0.93,
    margin: { x: 36, y: 44 },
    size: { name: 26, headline: 11, contact: 9.5, heading: 11.5, body: 10.5, sub: 10.5 },
    leading: 1.14,
    headerAlign: "left",
    color: { text: "1F2933", muted: "5F6B7A", accent: "D9653B", rule: "D9653B", heading: "1F3A44", headline: "F4B393", name: "FFFFFF", date: "5F6B7A" },
    headline: { caps: true, tracking: 1.2, bold: true },
    heading: { caps: "all", tracking: 1.4, rule: 2, ruleStyle: "short", before: 14, after: 6 },
    sections: ["summary", "experience"],
    skills: "inline",
    experienceLead: "title",
    entrySub: "accent",
    educationLead: "degree",
    entryGap: 12,
    columns: {
      side: "left",
      width: 200,
      fill: "1F3A44",
      text: "F2F5F7",
      muted: "B8C7CE",
      heading: "F4B393",
      header: "side",
      sideSections: ["skills", "education", "certifications"],
      skills: "list",
      chipFill: "2C4F5B",
      bleed: true,
    },
  },
  studio: {
    ...base,
    id: "studio",
    docxFont: "Georgia",
    pdfFont: "times",
    pdfScale: 1.03,
    margin: { x: 48, y: 46 },
    size: { name: 34, headline: 12.5, contact: 9.5, heading: 11, body: 10.5, sub: 10.5 },
    leading: 1.12,
    headerAlign: "left",
    color: { text: "2A2230", muted: "6E6475", accent: "9C3D5B", rule: "9C3D5B", heading: "9C3D5B", headline: "9C3D5B", name: "2A2230", date: "6E6475" },
    headline: { caps: false, tracking: 0.3, bold: false },
    contactSep: "  ·  ",
    heading: { caps: "all", tracking: 1.6, rule: 0.75, ruleStyle: "full", before: 14, after: 6 },
    sections: ["summary", "experience"],
    skills: "inline",
    experienceLead: "title",
    entrySub: "accent",
    educationLead: "degree",
    entryGap: 12,
    columns: {
      side: "right",
      width: 176,
      fill: "F6EEF1",
      text: "2A2230",
      muted: "6E6475",
      heading: "9C3D5B",
      header: "top",
      sideSections: ["skills", "education", "certifications"],
      skills: "chips",
      chipFill: "EBD7DF",
      bleed: false,
    },
  },
  rail: {
    ...base,
    id: "rail",
    docxFont: "Arial",
    pdfFont: "helvetica",
    pdfScale: 1,
    margin: { x: 44, y: 46 },
    size: { name: 30, headline: 11, contact: 9.5, heading: 11, body: 10, sub: 10 },
    leading: 1.14,
    headerAlign: "left",
    color: { text: "1E2623", muted: "5E6A65", accent: "A8761C", rule: "A8761C", heading: "1F3D36", headline: "A8761C", name: "1F3D36", date: "5E6A65" },
    headline: { caps: true, tracking: 1.6, bold: true },
    headerRule: { weight: 2.5, color: "1F3D36", space: 10 },
    heading: { caps: "all", tracking: 1.4, rule: 2, ruleStyle: "short", before: 15, after: 6 },
    sections: ["summary", "experience"],
    skills: "inline",
    experienceLead: "title",
    entrySub: "accent",
    educationLead: "degree",
    entryGap: 11,
    columns: {
      side: "right",
      width: 196,
      fill: "1F3D36",
      text: "EEF3F0",
      muted: "B7C8C0",
      heading: "E3B65A",
      header: "main",
      sideSections: ["skills", "education", "certifications"],
      skills: "chips",
      chipFill: "2E5A4F",
      bleed: true,
    },
  },
  magazine: {
    ...base,
    id: "magazine",
    docxFont: "Arial",
    pdfFont: "helvetica",
    margin: { x: 46, y: 44 },
    size: { name: 40, headline: 13, contact: 9, heading: 10.5, body: 10, sub: 10 },
    leading: 1.12,
    headerAlign: "left",
    color: { text: "161616", muted: "5E5E5E", accent: "D22B3F", rule: "D22B3F", heading: "161616", headline: "D22B3F", name: "161616", date: "5E5E5E" },
    name: { caps: true, tracking: 0.6 },
    headline: { caps: false, tracking: 0.2, bold: false },
    contactSep: "   /   ",
    heading: { caps: "all", tracking: 1.8, rule: 2, ruleStyle: "short", before: 15, after: 6 },
    sections: ["summary", "experience"],
    skills: "inline",
    experienceLead: "title",
    entrySub: "accent",
    educationLead: "degree",
    entryGap: 11,
    columns: {
      side: "left",
      width: 170,
      fill: "FFFFFF",
      text: "161616",
      muted: "5E5E5E",
      heading: "D22B3F",
      header: "top",
      topRule: { weight: 4, color: "161616" },
      divider: "C8C8C8",
      sideSections: ["skills", "education", "certifications"],
      skills: "list",
      chipFill: "F1F1F1",
      bleed: false,
    },
  },
  noir: {
    ...base,
    id: "noir",
    docxFont: "Georgia",
    pdfFont: "times",
    pdfScale: 1.03,
    margin: { x: 44, y: 40 },
    size: { name: 30, headline: 12, contact: 9.5, heading: 11, body: 10.5, sub: 10.5 },
    leading: 1.12,
    headerAlign: "left",
    color: { text: "1E1F24", muted: "61646E", accent: "D45F43", rule: "D45F43", heading: "1E1F24", headline: "F2A58E", name: "FFFFFF", date: "61646E" },
    headline: { caps: false, tracking: 0.3, bold: false, italic: true },
    contactSep: "  ·  ",
    heading: { caps: "all", tracking: 1.8, rule: 1.5, ruleStyle: "short", before: 15, after: 6 },
    sections: ["summary", "experience"],
    skills: "inline",
    experienceLead: "title",
    entrySub: "accent",
    educationLead: "degree",
    entryGap: 11,
    columns: {
      side: "right",
      width: 184,
      fill: "F3F1EE",
      text: "1E1F24",
      muted: "61646E",
      heading: "B9472D",
      header: "band",
      band: { fill: "17181C", tile: "D45F43", tileText: "FFFFFF", name: "FFFFFF", headline: "F2A58E", contact: "C9CBD1", height: 136 },
      sideSections: ["skills", "education", "certifications"],
      skills: "chips",
      chipFill: "E6E2DC",
      bleed: true,
    },
  },
};

/** Public metadata for a templates page (derived from the registry). */
export const TEMPLATE_LIST = META.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  preview: t.preview,
}));

export const headingText = (style: TemplateStyle, key: SectionKey) => style.headings[key] ?? SECTION_HEADINGS[key];
