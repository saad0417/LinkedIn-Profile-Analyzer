// Contracts for the LinkedIn profile analyzer. JSON-serialisable.
import type { Check } from "@/lib/types";

/** Parsed from LinkedIn's own "Save to PDF" export (More → Save to PDF). */
export interface LinkedInProfile {
  name: string | null;
  headline: string | null;
  location: string | null;
  email: string | null;
  /** linkedin.com/in/... as printed in the PDF. */
  profileUrl: string | null;
  /** Websites listed in the Contact block (portfolio, company, blog). */
  websites: string[];
  topSkills: string[];
  languages: string[];
  certifications: string[];
  honors: string[];
  publications: string[];
  /** The About section, verbatim. */
  summary: string | null;
  experience: LinkedInRole[];
  education: LinkedInEducation[];
}

export interface LinkedInRole {
  title: string | null;
  company: string | null;
  /** As printed, e.g. "March 2021 - Present (3 years 7 months)". */
  dates: string | null;
  /** "YYYY-MM" | "present" | null */
  start: string | null;
  end: string | null;
  location: string | null;
  description: string | null;
}

export interface LinkedInEducation {
  school: string | null;
  degree: string | null;
  dates: string | null;
}

export type LinkedInSectionId =
  | "headline"
  | "about"
  | "experience"
  | "skills"
  | "education"
  | "credentials"
  | "contact";

export interface LinkedInSection {
  id: LinkedInSectionId;
  label: string;
  /** 0–100 for this section. */
  score: number;
  /** Share of the overall score, weights sum to 100. */
  weight: number;
  checks: Check[];
}

export interface LinkedInAnalysis {
  version: 1;
  /** False when the PDF doesn't look like a LinkedIn export (we still analyse best-effort). */
  looksLikeLinkedIn: boolean;
  pageCount: number | null;
  profile: LinkedInProfile;
  rawText: string;
  /** Deterministic, rule-based 0–100. Same PDF → same score. */
  score: number;
  sections: LinkedInSection[];
  /** Profile parts the PDF export doesn't contain, so the score can't rate them (photo, banner, recommendations…). For a "not assessed" note. */
  notAssessed?: string[];
}

export type LinkedInAnalyzeResponse =
  | { ok: true; result: LinkedInAnalysis }
  | { ok: false; error: string; code: "rate_limited" | "too_large" | "bad_type" | "unreadable" | "bad_request" };

/** Structured AI review, generated on request (never used for the score). */
export interface LinkedInReview {
  /** 2–3 sentence overall read. */
  verdict: string;
  strengths: string[];
  improvements: { title: string; detail: string }[];
  /** Three alternative headlines, ≤ 220 chars each, built only from facts in the profile. */
  headlines: string[];
  /** A rewritten About section draft, first person allowed on LinkedIn, [metric] placeholders where numbers belong. */
  about: string;
}
