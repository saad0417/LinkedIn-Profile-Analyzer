// Shared contracts between the analysis engine, the API routes and the UI.
// Everything here must be JSON-serialisable: it crosses the network as-is.
import type { LinkedInProfile, LinkedInReview } from "@/lib/linkedin/types";

export type DocKind = "pdf" | "docx";

export type CheckStatus = "pass" | "warn" | "fail";
/** How much a failure of this check hurts. Drives sort order and colour. */
export type Severity = "high" | "medium" | "low";
/**
 * extraction + layout  -> Parse Integrity score
 * content              -> Content score
 * match                -> Job Match score (only when a JD was supplied)
 */
export type CheckCategory = "extraction" | "layout" | "content" | "match" | "profile";

/** A snippet of the user's own text that a check points at. */
export interface Evidence {
  text: string;
  /** Optional context, e.g. "Experience · Acme Ltd" or "page 1, right column". */
  where?: string;
}

/** Something the user can click to fix inline with the LLM. */
export interface RewriteTarget {
  kind: "bullet" | "summary";
  text: string;
}

export interface Check {
  /** Stable, dotted id, e.g. "layout.multi-column". Used as React key and for "explain". */
  id: string;
  category: CheckCategory;
  /** Short, neutral title, e.g. "Single-column layout". Reads correctly whatever the status. */
  title: string;
  status: CheckStatus;
  severity: Severity;
  /** Points this check is worth inside its score. pass = weight, warn = weight/2, fail = 0. */
  weight: number;
  /** One or two sentences: what we found, in plain language. */
  summary: string;
  /** Why this matters to a parser or recruiter. One or two sentences. */
  why?: string;
  /** Specific action to take. Omit when status is "pass". */
  fix?: string;
  evidence?: Evidence[];
  rewriteTargets?: RewriteTarget[];
}

export type SectionKind =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "certifications"
  | "projects"
  | "other";

export interface ExtractedSection {
  /** Heading exactly as it appears in the document. */
  heading: string;
  /** Dictionary match, or null if the heading is non-standard ("My Journey"). */
  kind: SectionKind | null;
  text: string;
}

export interface ExtractedRole {
  title: string | null;
  company: string | null;
  location: string | null;
  /** Date range as written, e.g. "03/2021 – Present". */
  dates: string | null;
  /** Normalised "YYYY-MM", or null if unparseable. "present" for ongoing roles. */
  start: string | null;
  end: string | null;
  bullets: string[];
}

export interface ExtractedEducation {
  institution: string | null;
  degree: string | null;
  dates: string | null;
  details: string[];
}

export interface ExtractedProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  location: string | null;
  /** Other URLs (portfolio, GitHub). */
  links: string[];
  summary: string | null;
  sections: ExtractedSection[];
  experience: ExtractedRole[];
  education: ExtractedEducation[];
  skills: string[];
  certifications: string[];
}

export interface DocumentInfo {
  kind: DocKind;
  pageCount: number | null;
  wordCount: number;
  /** Font families found in the file (PDF font names / DOCX run fonts). */
  fonts: string[];
  /** Number of text columns detected on the busiest page (PDF only, 1 for DOCX). */
  columns: number;
}

export interface KeywordHit {
  term: string;
  /** "hard" = tool, technology, certification, hard skill. "soft" = everything else worth matching. */
  kind: "hard" | "soft";
  inJd: number;
  inResume: number;
}

export interface MatchResult {
  score: number;
  jobTitle: string | null;
  /** Whether the JD job title (or a close variant) appears in the resume. */
  titleFound: boolean;
  keywords: KeywordHit[];
}

export interface Scores {
  parseIntegrity: number;
  content: number;
  /** null when no job description was supplied. */
  jobMatch: number | null;
}

export interface AnalysisResult {
  version: 1;
  document: DocumentInfo;
  /** Plain text exactly as the parser extracted it, in reading order. "What the parser saw". */
  rawText: string;
  /** DOCX only: mammoth HTML of the body so the UI can show "your document". PDF renders client-side. */
  sourceHtml: string | null;
  profile: ExtractedProfile;
  checks: Check[];
  scores: Scores;
  match: MatchResult | null;
}

/* ---------- Export / templates ---------- */

/** Every template in the library. Metadata: src/lib/export/registry.ts. */
export type TemplateId =
  // ATS classic
  | "standard"
  | "technical"
  | "entry"
  | "executive"
  | "compact"
  // ATS modern
  | "modern"
  | "minimal"
  | "bold"
  | "timeline"
  // Creative (not for ATS uploads)
  | "sidebar"
  | "studio";

/** Clean, editable resume content that templates render. Built from ExtractedProfile. */
export interface ResumeContent {
  name: string;
  headline: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  links: string[];
  summary: string | null;
  experience: {
    title: string;
    company: string;
    location: string | null;
    start: string;
    end: string;
    bullets: string[];
  }[];
  education: {
    institution: string;
    degree: string;
    dates: string;
    details: string[];
  }[];
  skills: string[];
  certifications: string[];
}

/* ---------- LLM ---------- */

export type LLMTask =
  | { task: "rewrite-bullet"; bullet: string; role?: string | null }
  | { task: "rewrite-summary"; summary: string; targetRole: string; context?: string }
  | { task: "explain"; checkId: string; title: string; summary: string; evidence?: string[] }
  /** Batch version for "improve my resume": up to 15 bullets, one LLM call. */
  | { task: "rewrite-bullets"; bullets: string[]; role?: string | null }
  /** Structured LinkedIn profile review. Never affects the rule-based score. */
  | { task: "linkedin-review"; profile: LinkedInProfile; score: number; findings: string[] }
  /**
   * Resume generator: the user's own facts (roles with rough notes as bullets,
   * education, skills) polished into ATS-friendly content for a target role.
   */
  | { task: "generate-resume"; targetRole: string; draft: ResumeContent; jobDescription?: string | null };

export type LLMResponse =
  | {
      ok: true;
      /** Plain-text result (rewrite-bullet, rewrite-summary, explain). Empty string for structured tasks. */
      text: string;
      /** rewrite-bullets: same length and order as the input; an item equals the input when no rewrite was needed. */
      items?: string[];
      /** linkedin-review */
      review?: LinkedInReview;
      /** generate-resume: same people, employers, dates and schools as the draft; only wording improved. */
      content?: ResumeContent;
    }
  | { ok: false; error: string; code: "rate_limited" | "daily_limit" | "unavailable" | "bad_request" };

/* ---------- API ---------- */

export type AnalyzeResponse =
  | { ok: true; result: AnalysisResult }
  | { ok: false; error: string; code: "rate_limited" | "too_large" | "bad_type" | "unreadable" | "bad_request" };
