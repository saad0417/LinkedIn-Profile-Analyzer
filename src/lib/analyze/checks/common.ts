import type { Check, CheckCategory, CheckStatus, Evidence, RewriteTarget, Severity } from "@/lib/types";
import type { ParsedDocument } from "../internal";
import type { ProfileBuild } from "../profile";

export interface CheckContext {
  doc: ParsedDocument;
  build: ProfileBuild;
  /** No extractable body text at all (image-only PDF, or a DOCX whose body is empty). */
  noText: boolean;
}

/** Weights by severity band: high ≈ 15–20, medium ≈ 8–10, low ≈ 3–5. */
export interface CheckDef {
  id: string;
  category: CheckCategory;
  title: string;
  severity: Severity;
  weight: number;
  why: string;
}

export interface Outcome {
  status: CheckStatus;
  summary: string;
  fix?: string;
  evidence?: Evidence[];
  rewriteTargets?: RewriteTarget[];
}

export function build(def: CheckDef, o: Outcome): Check {
  const c: Check = {
    id: def.id,
    category: def.category,
    title: def.title,
    status: o.status,
    severity: def.severity,
    weight: def.weight,
    summary: o.summary,
    why: def.why,
  };
  if (o.status !== "pass" && o.fix) c.fix = o.fix;
  if (o.evidence && o.evidence.length) c.evidence = o.evidence;
  if (o.status !== "pass" && o.rewriteTargets && o.rewriteTargets.length) c.rewriteTargets = o.rewriteTargets;
  return c;
}

export const NOT_EVALUATED = "We could not check this because no text could be extracted from your CV.";
