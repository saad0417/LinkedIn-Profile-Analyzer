import type { Check, CheckCategory, CheckStatus, Severity } from "@/lib/types";

export const statusText: Record<CheckStatus, string> = { pass: "Pass", warn: "Warning", fail: "Fail" };
export const severityText: Record<Severity, string> = {
  high: "High impact",
  medium: "Medium impact",
  low: "Low impact",
};
export const categoryText: Record<CheckCategory, string> = {
  extraction: "Extraction",
  layout: "Layout",
  content: "Content",
  match: "Job match",
  profile: "Profile",
};

export const statusColor: Record<CheckStatus, string> = {
  pass: "text-good",
  warn: "text-warn",
  fail: "text-bad",
};
export const statusBg: Record<CheckStatus, string> = {
  pass: "bg-good",
  warn: "bg-warn",
  fail: "bg-bad",
};

/** A small drawn mark rather than an emoji or icon font. */
export function StatusMark({ status, className = "" }: { status: CheckStatus; className?: string }) {
  const c = `${statusColor[status]} shrink-0 ${className}`;
  if (status === "pass")
    return (
      <svg className={c} width="14" height="14" viewBox="0 0 14 14" aria-label="Pass" role="img">
        <path d="M2.5 7.5 5.5 10.5 11.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
      </svg>
    );
  if (status === "warn")
    return (
      <svg className={c} width="14" height="14" viewBox="0 0 14 14" aria-label="Warning" role="img">
        <rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="2" y="7" width="10" height="5" fill="currentColor" />
      </svg>
    );
  return (
    <svg className={c} width="14" height="14" viewBox="0 0 14 14" aria-label="Fail" role="img">
      <rect x="2" y="2" width="10" height="10" fill="currentColor" />
    </svg>
  );
}

const statusRank: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2 };
const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Fails before warnings, high impact first, then heavier weight. Stable for equal keys. */
export function sortChecks(checks: Check[]) {
  return checks
    .map((c, i) => ({ c, i }))
    .sort(
      (a, b) =>
        statusRank[a.c.status] - statusRank[b.c.status] ||
        severityRank[a.c.severity] - severityRank[b.c.severity] ||
        b.c.weight - a.c.weight ||
        a.i - b.i,
    )
    .map((x) => x.c);
}

export type ScoreKind = "parse" | "content" | "match";

export function scoreBand(kind: ScoreKind, score: number): { label: string; tone: CheckStatus } {
  if (kind === "parse") {
    if (score >= 85) return { label: "Parses cleanly", tone: "pass" };
    if (score >= 65) return { label: "Mostly readable", tone: "warn" };
    if (score >= 40) return { label: "Partly lost in parsing", tone: "fail" };
    return { label: "Largely unreadable", tone: "fail" };
  }
  if (kind === "content") {
    if (score >= 85) return { label: "Strong", tone: "pass" };
    if (score >= 60) return { label: "Room to sharpen", tone: "warn" };
    return { label: "Needs work", tone: "fail" };
  }
  if (score >= 75) return { label: "Strong match", tone: "pass" };
  if (score >= 50) return { label: "Partial match", tone: "warn" };
  return { label: "Weak match", tone: "fail" };
}

export function anchorFor(checkId: string) {
  return `check-${checkId.replace(/[^a-z0-9]+/gi, "-")}`;
}
