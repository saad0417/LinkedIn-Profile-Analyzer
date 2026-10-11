import type { Check, Scores } from "@/lib/types";

/**
 * One headline "ATS score" out of 100, built only from the measured
 * sub-scores so it always decomposes. Weights follow docs/research/ats-criteria.md:
 * parse/format + sections/contact ≈ 55, content/impact ≈ 45; with a job
 * description, Job Match takes 35 and the rest scale down proportionally.
 *
 * Caps, because some failures make everything else irrelevant:
 *  - no readable text (image-only or garbled): at most 30;
 *  - neither an email nor a phone number found: at most 60.
 */
export const ATS_WEIGHTS = {
  noJd: { parseIntegrity: 0.55, content: 0.45, jobMatch: 0 },
  withJd: { parseIntegrity: 0.36, content: 0.29, jobMatch: 0.35 },
} as const;

export const ATS_CAPS = { noText: 30, noContact: 60 } as const;

export function atsScore(s: Scores, checks: Check[] = []): number {
  const w = s.jobMatch === null ? ATS_WEIGHTS.noJd : ATS_WEIGHTS.withJd;
  let score = s.parseIntegrity * w.parseIntegrity + s.content * w.content + (s.jobMatch ?? 0) * w.jobMatch;
  const failed = (id: string) => checks.some((c) => c.id === id && c.status === "fail");
  if (failed("extraction.text") || s.parseIntegrity <= 10) score = Math.min(score, ATS_CAPS.noText);
  if (failed("extraction.email") && failed("extraction.phone")) score = Math.min(score, ATS_CAPS.noContact);
  return Math.round(score);
}

export function atsBand(score: number): { label: string; tone: "pass" | "warn" | "fail"; note: string } {
  if (score >= 85)
    return { label: "ATS friendly", tone: "pass", note: "Parses cleanly and reads well. Polish the details below." };
  if (score >= 70)
    return { label: "Mostly ATS friendly", tone: "warn", note: "A few fixes stand between you and a clean parse." };
  if (score >= 50)
    return {
      label: "Needs work",
      tone: "fail",
      note: "Parts of your resume are being lost or weakened. Start with the high-impact fixes.",
    };
  return {
    label: "Not ATS friendly",
    tone: "fail",
    note: "A parser loses much of this resume. Rebuilding it in a clean template will help most.",
  };
}
