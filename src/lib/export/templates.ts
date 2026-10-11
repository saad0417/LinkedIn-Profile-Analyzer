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
  name: { caps: boolean; tracking: number };
  headline: { caps: boolean; tracking: number; bold: boolean };
  heading: {
    /** "small" = DOCX small caps / PDF reduced-size capitals. Text stays "Experience" either way. */
    caps: "all" | "small" | "none";
    tracking: number;
    /** Bottom rule thickness in points. 0 = none. */
    rule: number;
    /** "full" = across the column; "short" = a short accent bar under the heading start. */
    ruleStyle: "full" | "short";
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
  /** Name + headline live at the top of the side column ("side") or in a full-width header ("top"). */
  header: "side" | "top";
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
};

/** Public metadata for a templates page (derived from the registry). */
export const TEMPLATE_LIST = META.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  preview: t.preview,
}));

export const headingText = (style: TemplateStyle, key: SectionKey) => style.headings[key] ?? SECTION_HEADINGS[key];
