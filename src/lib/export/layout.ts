/**
 * Template-independent document model. Both renderers (DOCX, PDF) walk the
 * same Block list, so section order, wording and hierarchy cannot drift
 * between formats.
 */
import type { ResumeContent, TemplateId } from "@/lib/types";
import { formatRange, normalizeDate, normalizeRange } from "./content";
import { TEMPLATES, headingText, type SectionKey, type TemplateStyle } from "./templates";

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  tone?: "muted" | "accent";
}

export type Block =
  | { kind: "name"; text: string }
  | { kind: "headline"; text: string }
  | { kind: "contact"; parts: string[] }
  | { kind: "heading"; key: SectionKey | "contact"; text: string }
  /**
   * Entry header: `left` + right-aligned `right` (dates) on line 1, optional
   * `sub` on line 2. `stack` (narrow side column): dates go on their own line.
   */
  | { kind: "entry"; left: Run[]; right: string; sub: Run[] | null; first: boolean; stack?: boolean }
  | { kind: "bullet"; runs: Run[] }
  | { kind: "para"; runs: Run[] }
  /** Tight single line (grouped skills, side-column lists). */
  | { kind: "line"; runs: Run[]; last: boolean }
  /** Skill tags (creative side column only). */
  | { kind: "chips"; items: string[] };

/* ------------------------------ cleaning ------------------------------ */

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const ZERO_WIDTH = /[​-‍⁠﻿­]/g;
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;

/** Single-line text: strip invisible / XML-invalid characters and collapse whitespace. */
export function cleanText(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFC")
    .replace(LONE_SURROGATE, "")
    .replace(ZERO_WIDTH, "")
    .replace(CONTROL, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const cleanList = (items: string[] | null | undefined) =>
  (items ?? []).map((b) => cleanText(b).replace(/^(?:[-*•·▪◦‣●○■□➢➤►]+)\s*/, "")).filter(Boolean);

const normDate = (s: string) => {
  const c = cleanText(s);
  return normalizeDate(c) ?? c;
};

function normDates(s: string): string {
  const c = cleanText(s);
  const r = normalizeRange(c);
  return r ? formatRange(r.start, r.end) : c;
}

/** Normalise user-edited content: clean text, one date format, no empty items. */
export function normalizeContent(c: ResumeContent): ResumeContent {
  const seen = new Set<string>();
  const skills = cleanList(c.skills).filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    name: cleanText(c.name),
    headline: cleanText(c.headline) || null,
    email: cleanText(c.email) || null,
    phone: cleanText(c.phone) || null,
    location: cleanText(c.location) || null,
    linkedin: cleanText(c.linkedin) || null,
    links: cleanList(c.links),
    summary: cleanText(c.summary) || null,
    experience: (c.experience ?? [])
      .map((e) => ({
        title: cleanText(e.title),
        company: cleanText(e.company),
        location: cleanText(e.location) || null,
        start: normDate(e.start),
        end: normDate(e.end),
        bullets: cleanList(e.bullets),
      }))
      .filter((e) => e.title || e.company || e.bullets.length),
    education: (c.education ?? [])
      .map((e) => ({
        institution: cleanText(e.institution),
        degree: cleanText(e.degree),
        dates: normDates(e.dates),
        details: cleanList(e.details),
      }))
      .filter((e) => e.institution || e.degree || e.details.length),
    skills,
    certifications: cleanList(c.certifications),
  };
}

/* ------------------------------ skills ------------------------------ */

const SKILL_GROUPS: { label: string; terms: string[] }[] = [
  {
    // Not plain "Languages"/"Tools": those read as section headings to some
    // parsers, and "Languages" is ambiguous with spoken languages.
    label: "Programming Languages",
    terms: [
      "python", "java", "javascript", "typescript", "go", "golang", "rust", "c", "c++", "c#", "ruby", "php",
      "swift", "kotlin", "scala", "sql", "r", "bash", "shell", "powershell", "html", "css", "dart", "elixir",
      "haskell", "perl", "matlab", "lua", "objective-c", "julia", "clojure", "f#", "vba", "solidity", "zig",
    ],
  },
  {
    label: "Frameworks & Libraries",
    terms: [
      "react", "react native", "next.js", "nextjs", "vue", "vue.js", "nuxt", "angular", "svelte", "node.js", "nodejs",
      "express", "nestjs", "django", "flask", "fastapi", "spring", "spring boot", "rails", "ruby on rails", ".net",
      "asp.net", "laravel", "pytorch", "tensorflow", "keras", "pandas", "numpy", "scikit-learn", "graphql", "grpc",
      "tailwind css", "tailwind", "jquery", "redux", "flutter", "langchain", "hugging face", "celery", "rxjs",
    ],
  },
  {
    label: "Cloud & DevOps",
    terms: [
      "aws", "amazon web services", "gcp", "google cloud", "azure", "docker", "kubernetes", "k8s", "terraform",
      "ansible", "jenkins", "github actions", "gitlab ci", "circleci", "ci/cd", "linux", "nginx", "helm",
      "prometheus", "grafana", "datadog", "vercel", "heroku", "cloudflare", "serverless", "lambda", "pulumi",
      "argo cd", "argocd", "openshift",
    ],
  },
  {
    label: "Data & Databases",
    terms: [
      "postgresql", "postgres", "mysql", "sqlite", "mongodb", "redis", "elasticsearch", "dynamodb", "cassandra",
      "snowflake", "bigquery", "redshift", "kafka", "spark", "apache spark", "airflow", "dbt", "hadoop", "tableau",
      "power bi", "looker", "etl", "oracle", "sql server", "rabbitmq", "databricks", "clickhouse", "neo4j",
    ],
  },
  {
    label: "Developer Tools",
    terms: [
      "git", "github", "gitlab", "jira", "confluence", "figma", "postman", "vs code", "webpack", "vite", "jest",
      "cypress", "playwright", "selenium", "pytest", "junit", "storybook", "excel", "microsoft excel", "notion",
    ],
  },
];

const SKILL_LOOKUP = new Map<string, string>();
for (const g of SKILL_GROUPS) for (const t of g.terms) SKILL_LOOKUP.set(t, g.label);

export interface SkillGroup {
  /** null when the group should render without a label. */
  label: string | null;
  items: string[];
}

/**
 * Group skills for parse-safe plain-text lines. Entries already written as
 * "Label: a, b" keep their own grouping; the rest are sorted with a small
 * dictionary. If nothing matches the dictionary, one unlabelled group.
 */
export function groupSkills(skills: string[]): SkillGroup[] {
  const groups = new Map<string, SkillGroup>();
  let explicit = false;
  const add = (label: string, item: string) => {
    const key = label.toLowerCase();
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    const g = groups.get(key)!;
    if (!g.items.some((x) => x.toLowerCase() === item.toLowerCase())) g.items.push(item);
  };
  for (const s of skills) {
    const m = s.match(/^([^:]{2,40}):\s*(.+)$/);
    if (m) {
      explicit = true;
      for (const item of m[2].split(/\s*[,;|]\s*/).filter(Boolean)) add(m[1].trim(), item);
    } else {
      add(SKILL_LOOKUP.get(s.toLowerCase()) ?? "Other", s);
    }
  }
  let out = [...groups.values()];
  // The user's own grouping keeps its order; otherwise use dictionary order.
  if (!explicit) {
    const rank = (label: string | null) => {
      const i = SKILL_GROUPS.findIndex((g) => g.label === label);
      return i === -1 ? SKILL_GROUPS.length : i;
    };
    out.sort((a, b) => rank(a.label) - rank(b.label));
  }
  const other = out.find((g) => g.label === "Other");
  if (other) {
    out = [...out.filter((g) => g !== other), other];
    if (out.length === 1) other.label = null;
  }
  return out;
}

/* ------------------------------ blocks ------------------------------ */

/** Strip protocol / "www." / trailing slash for a compact contact line. */
export const displayUrl = (u: string) => u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");

function contactParts(c: ResumeContent): string[] {
  return [c.location, c.email, c.phone, c.linkedin ? displayUrl(c.linkedin) : null, ...c.links.map(displayUrl)].filter(
    (p): p is string => !!p,
  );
}

const join = (...parts: (string | null | undefined)[]) => parts.filter((p) => p && p.trim()).join(" · ");

function sectionBlocks(key: SectionKey, c: ResumeContent, style: TemplateStyle, side: boolean): Block[] {
  const out: Block[] = [];
  switch (key) {
    case "summary":
      if (c.summary) out.push({ kind: "para", runs: [{ text: c.summary }] });
      break;

    case "experience":
      c.experience.forEach((e, i) => {
        const dates = formatRange(e.start, e.end);
        const lead = style.experienceLead === "company" ? e.company || e.title : e.title || e.company;
        const second = style.experienceLead === "company" ? (e.company ? e.title : "") : e.title ? e.company : "";
        const sub: Run[] = [];
        const left: Run[] = [{ text: lead, bold: true }];
        if (style.entrySub === "inline") {
          // One header line: "Title · Company · Location     dates".
          const rest = join(second, e.location);
          if (rest) left.push({ text: ` · ${rest}` });
        } else if (style.entrySub === "accent") {
          if (second) sub.push({ text: second, bold: true, tone: "accent" });
          if (e.location) sub.push({ text: (second ? " · " : "") + e.location, tone: "muted" });
        } else {
          const text = join(second, e.location);
          if (text) sub.push(style.entrySub === "muted" ? { text, tone: "muted" } : { text, italic: true });
        }
        out.push({ kind: "entry", left, right: dates, sub: sub.length ? sub : null, first: i === 0 });
        for (const b of e.bullets) out.push({ kind: "bullet", runs: [{ text: b }] });
      });
      break;

    case "education":
      c.education.forEach((e, i) => {
        const lead = style.educationLead === "institution" ? e.institution || e.degree : e.degree || e.institution;
        const second =
          style.educationLead === "institution" ? (e.institution ? e.degree : "") : e.degree ? e.institution : "";
        const left: Run[] = [{ text: lead, bold: true }];
        let sub: Run[] | null = null;
        if (second && style.entrySub === "inline" && !side) left.push({ text: ` · ${second}` });
        else if (second) sub = [style.entrySub === "muted" || side ? { text: second, tone: "muted" } : { text: second, italic: true }];
        out.push({ kind: "entry", left, right: e.dates, sub, first: i === 0, ...(side ? { stack: true } : {}) });
        for (const d of e.details) out.push({ kind: "bullet", runs: [{ text: d }] });
      });
      break;

    case "skills": {
      if (!c.skills.length) break;
      if (side && style.columns) {
        const items = c.skills.map((x) => x.replace(/^[^:]{2,40}:\s*/, "")).flatMap((x) => x.split(/\s*,\s*/)).filter(Boolean);
        if (style.columns.skills === "chips") out.push({ kind: "chips", items });
        else items.forEach((x, i) => out.push({ kind: "line", runs: [{ text: x }], last: i === items.length - 1 }));
        break;
      }
      const groups = groupSkills(c.skills);
      // Inline templates still honour the user's own "Label: a, b" grouping.
      const useLines = style.skills === "grouped" || c.skills.some((s) => /^[^:]{2,40}:\s*\S/.test(s));
      if (useLines && !(groups.length === 1 && groups[0].label === null)) {
        groups.forEach((g, i) =>
          out.push({
            kind: "line",
            runs: g.label ? [{ text: `${g.label}: `, bold: true }, { text: g.items.join(", ") }] : [{ text: g.items.join(", ") }],
            last: i === groups.length - 1,
          }),
        );
      } else {
        // A separator left at the end of a wrapped line is deliberate: parsers use it to
        // tell a wrapped list from a wrapped phrase.
        out.push({ kind: "para", runs: [{ text: c.skills.join(style.skills === "pipe" ? "  |  " : ", ") }] });
      }
      break;
    }

    case "certifications":
      for (const cert of c.certifications) out.push({ kind: "bullet", runs: [{ text: cert }] });
      break;
  }
  return out;
}

export interface DocumentBlocks {
  /** Name, headline, contact. */
  header: Block[];
  /** Main column (the only column for ATS-safe templates). */
  main: Block[];
  /** Side column of a creative two-column template; empty otherwise. */
  side: Block[];
}

function sections(keys: SectionKey[], content: ResumeContent, style: TemplateStyle, side: boolean): Block[] {
  const out: Block[] = [];
  for (const key of keys) {
    const body = sectionBlocks(key, content, style, side);
    if (!body.length) continue;
    out.push({ kind: "heading", key, text: headingText(style, key) }, ...body);
  }
  return out;
}

/** Build the document for a template. Expects normalised content. */
export function buildDocument(content: ResumeContent, template: TemplateId): DocumentBlocks {
  const style = TEMPLATES[template];
  const header: Block[] = [];
  if (content.name) header.push({ kind: "name", text: content.name });
  if (content.headline) header.push({ kind: "headline", text: content.headline });
  const parts = contactParts(content);
  const side: Block[] = [];
  if (style.columns?.header === "side" || style.columns?.header === "main") {
    // Sidebar: contact details become their own "Contact" block in the side column.
    if (parts.length) {
      side.push({ kind: "heading", key: "contact", text: "Contact" });
      parts.forEach((p, i) => side.push({ kind: "line", runs: [{ text: p, tone: "muted" }], last: i === parts.length - 1 }));
    }
  } else if (parts.length) header.push({ kind: "contact", parts });
  if (style.columns) side.push(...sections(style.columns.sideSections, content, style, true));
  return { header, main: sections(style.sections, content, style, false), side };
}

/** Flat block list in reading order (header, main, side). Expects normalised content. */
export function buildBlocks(content: ResumeContent, template: TemplateId): Block[] {
  const d = buildDocument(content, template);
  return [...d.header, ...d.main, ...d.side];
}

/**
 * Group contact parts into rows that fit `maxWidth` points, breaking only
 * between parts (an email or URL is never split, no dangling separators).
 * `measure` returns the rendered width of a string.
 */
export function contactRows(parts: string[], sep: string, maxWidth: number, measure: (s: string) => number): string[] {
  const rows: string[] = [];
  let row = "";
  for (const p of parts) {
    const next = row ? row + sep + p : p;
    if (row && measure(next) > maxWidth) {
      rows.push(row);
      row = p;
    } else row = next;
  }
  if (row) rows.push(row);
  return rows;
}

/**
 * Contact rows for a split header: parts two per row, in order; a pair whose
 * estimated width exceeds `maxWidth` gets a row per part. Deliberately an
 * estimate (not a measurement) so DOCX and PDF break the rows identically.
 */
export function splitContactRows(parts: string[], sep: string, maxWidth: number, size: number): string[] {
  const est = (t: string) => t.length * size * 0.5;
  const rows: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const pair = parts.slice(i, i + 2);
    const joined = pair.join(sep);
    if (pair.length === 2 && est(joined) > maxWidth) rows.push(...pair);
    else rows.push(joined);
  }
  return rows;
}

/**
 * Monogram initials: first letter of the first and last name words
 * ("Lucia di Ferraro" -> "LF"). Letters only; "" when there is no usable name.
 */
export function initials(name: string | null | undefined): string {
  const all = cleanText(name)
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  // Skip lower-case particles ("di", "van") when the name has capitalised words.
  const caps = all.filter((w) => /^\p{Lu}/u.test(w));
  const words = caps.length ? caps : all;
  if (!words.length) return "";
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/* ------------------------------ file names ------------------------------ */

/** "Maya Okafor" -> "Maya-Okafor-Resume.docx". ASCII only; falls back to "Resume.<ext>". */
export function resumeFileName(name: string | null | undefined, format: "docx" | "pdf"): string {
  const base = cleanText(name)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9 '-]/g, " ")
    .replace(/'/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-")
    .slice(0, 60);
  return `${base ? `${base}-` : ""}Resume.${format}`;
}
