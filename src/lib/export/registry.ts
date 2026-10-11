/**
 * Client-safe template registry: metadata only, no renderer code and no
 * node-only imports. Imported by client components (template picker,
 * builder, template library) and by the export library.
 */
import type { TemplateId } from "@/lib/types";

export type TemplateCategory = "ats-classic" | "ats-modern" | "creative";

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  category: TemplateCategory;
  /** False only for creative designs meant for emailing a human, never for ATS uploads. */
  atsSafe: boolean;
  /** One or two sentences: what it looks like and how it is built. */
  description: string;
  /** Short card line. */
  blurb: string;
  bestFor: string;
  /** Font family as written into the DOCX. */
  font: string;
  /** Accent colour, "#rrggbb". */
  accent: string;
  /** "/templates/<id>.png" */
  preview: string;
}

export const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  "ats-classic": "ATS classic",
  "ats-modern": "ATS modern",
  creative: "Creative",
};

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "standard",
    name: "Standard Professional",
    category: "ats-classic",
    atsSafe: true,
    description:
      "A calm, centred header and ruled section headings in Calibri. Single column, no tables, contact details in the body.",
    blurb: "Summary, experience, education, skills. The safe default.",
    bestFor: "Most roles with two or more years of experience.",
    font: "Calibri",
    accent: "#1f2328",
    preview: "/templates/standard.png",
  },
  {
    id: "technical",
    name: "Technical",
    category: "ats-classic",
    atsSafe: true,
    description:
      "Left-aligned and compact in Arial, with skills near the top as plain grouped lines (Programming Languages: Python, Go).",
    blurb: "Skills grouped as plain text lines, never a grid.",
    bestFor: "Engineering, data and IT roles where tools are searched for by name.",
    font: "Arial",
    accent: "#1d4e89",
    preview: "/templates/technical.png",
  },
  {
    id: "entry",
    name: "Entry Level",
    category: "ats-classic",
    atsSafe: true,
    description: "Education first, then experience and skills, set in Georgia with a quiet green accent.",
    blurb: "Education first, then experience and skills.",
    bestFor: "Graduates, career changers and internship applications.",
    font: "Georgia",
    accent: "#2c4a3e",
    preview: "/templates/entry.png",
  },
  {
    id: "executive",
    name: "Executive",
    category: "ats-classic",
    atsSafe: true,
    description:
      "Cambria serif with a letter-spaced name, navy small-caps headings and a Core Competencies line under the summary. Reads well over two pages.",
    blurb: "Leadership summary first, competencies on one plain line.",
    bestFor: "Directors, VPs and senior managers with long track records.",
    font: "Cambria",
    accent: "#1f3b5c",
    preview: "/templates/executive.png",
  },
  {
    id: "compact",
    name: "Compact",
    category: "ats-classic",
    atsSafe: true,
    description:
      "Dense one-page layout in Arial: narrow margins, one-line role headers and grouped skill lines, without shrinking text below 9.5 pt.",
    blurb: "Fits a lot on one page and stays readable.",
    bestFor: "Clinical, trades and technical roles with many certifications or short stints.",
    font: "Arial",
    accent: "#2b3a4a",
    preview: "/templates/compact.png",
  },
  {
    id: "modern",
    name: "Modern Accent",
    category: "ats-modern",
    atsSafe: true,
    description:
      "A teal name, teal headings with a short accent bar and soft grey dates in Calibri. Still one column, real text and standard headings.",
    blurb: "Colour where it helps, nothing a parser trips on.",
    bestFor: "Design, product, marketing and tech roles at modern companies.",
    font: "Calibri",
    accent: "#0f7c78",
    preview: "/templates/modern.png",
  },
  {
    id: "minimal",
    name: "Minimal",
    category: "ats-modern",
    atsSafe: true,
    description:
      "Garamond with generous margins, letter-spaced small-caps headings and light grey dates. No rules, no colour, just calm typography.",
    blurb: "Quiet, spacious and confident.",
    bestFor: "Writers, editors, consultants and anyone whose words should carry it.",
    font: "Garamond",
    accent: "#4a4a4a",
    preview: "/templates/minimal.png",
  },
  {
    id: "bold",
    name: "Bold Header",
    category: "ats-modern",
    atsSafe: true,
    description:
      "Name, headline and contact details on a navy band (paragraph shading behind real body text, not a header or text box), with orange accent bars under headings.",
    blurb: "A strong first impression that still parses.",
    bestFor: "Sales, business development and client-facing roles.",
    font: "Arial",
    accent: "#c2410c",
    preview: "/templates/bold.png",
  },
  {
    id: "timeline",
    name: "Timeline",
    category: "ats-modern",
    atsSafe: true,
    description:
      "Dates sit in a left column set with tab stops (not a table), so the page scans like a timeline and still reads in one column. Georgia with a violet accent.",
    blurb: "Your career at a glance, down the left edge.",
    bestFor: "Project managers, teachers and steady career progressions.",
    font: "Georgia",
    accent: "#4c3f91",
    preview: "/templates/timeline.png",
  },
  {
    id: "sidebar",
    name: "Sidebar",
    category: "creative",
    atsSafe: false,
    description:
      "Not for ATS uploads: a two-column design with a deep teal sidebar for contact details, skills and education. Use it when you email or hand your resume to a person.",
    blurb: "Eye-catching two-column design for humans, not parsers.",
    bestFor: "Networking, direct emails to hiring managers, portfolio links.",
    font: "Calibri",
    accent: "#d9653b",
    preview: "/templates/sidebar.png",
  },
  {
    id: "studio",
    name: "Studio",
    category: "creative",
    atsSafe: false,
    description:
      "Not for ATS uploads: a large serif name over two columns, with skills as shaded tags in a blush side panel. Made for sending directly to a person.",
    blurb: "Editorial two-column layout with skill tags.",
    bestFor: "Creative roles, freelance pitches and in-person handouts.",
    font: "Georgia",
    accent: "#9c3d5b",
    preview: "/templates/studio.png",
  },
];

const BY_ID = new Map<string, TemplateMeta>(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): TemplateMeta | undefined {
  return BY_ID.get(id);
}

export const TEMPLATE_IDS: TemplateId[] = TEMPLATES.map((t) => t.id);

export const isTemplateId = (v: unknown): v is TemplateId => typeof v === "string" && BY_ID.has(v);
