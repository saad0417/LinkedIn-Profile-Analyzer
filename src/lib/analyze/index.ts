// Analysis engine entry point.
//
// analyzeDocument(buf, kind, jd) → AnalysisResult, fully deterministic:
// no LLM, no randomness, no clock, stable ordering. Everything happens in
// memory; nothing is written to disk and no document content is logged.
//
// Scores: each group's score = round(100 × Σ earned / Σ weight) over its
// checks, where pass earns the full weight, warn half, fail nothing.
//   Parse Integrity = extraction + layout checks (capped at 5 when no text can be extracted)
//   Content         = content checks
//   Job Match       = match checks (null without a job description)
//
// Checks that cannot be evaluated: if the file has no extractable text, every
// check about what the parser reads (extraction, content) is reported as a
// fail explaining why; layout checks are only emitted when the layout can
// actually be measured for that file type.
import type { AnalysisResult, Check, DocKind } from "@/lib/types";
import { parsePdf } from "./pdf";
import { parseDocx } from "./docx";
import { extractProfile } from "./profile";
import { extractionChecks } from "./checks/extraction";
import { layoutChecks } from "./checks/layout";
import { contentChecks } from "./checks/content";
import { computeMatch, scoreOf } from "./match";
import { UnreadableDocumentError } from "./errors";
import { wordCount } from "./text";
import type { ParsedDocument } from "./internal";

export { UnreadableDocumentError } from "./errors";
export { WEAK_OPENERS } from "./checks/content";

/** Parse Integrity ceiling when the file has no extractable text at all. */
const NO_TEXT_CAP = 5;

export async function analyzeDocument(buf: Uint8Array, kind: DocKind, jobDescription?: string | null): Promise<AnalysisResult> {
  if (!(buf instanceof Uint8Array) || buf.byteLength === 0) throw new UnreadableDocumentError("corrupt");
  let doc: ParsedDocument;
  if (kind === "pdf") doc = await parsePdf(buf);
  else if (kind === "docx") doc = await parseDocx(buf);
  else throw new UnreadableDocumentError("corrupt");
  return applyMatch(assemble(doc), jobDescription ?? null);
}

/**
 * Recompute only the job-match part of an existing result (for a JD pasted
 * after the first scan). Pure: works from `rawText` + `profile` alone and
 * leaves every other check and score untouched.
 * rematch(analyzeDocument(buf, kind, null), jd) deep-equals analyzeDocument(buf, kind, jd).
 */
export function rematch(result: AnalysisResult, jobDescription: string | null): AnalysisResult {
  if (!result || result.version !== 1 || typeof result.rawText !== "string" || !result.profile) {
    throw new TypeError("rematch expects an AnalysisResult (version 1).");
  }
  const base: AnalysisResult = {
    ...result,
    checks: result.checks.filter((c) => c.category !== "match"),
    scores: { ...result.scores, jobMatch: null },
    match: null,
  };
  return applyMatch(base, jobDescription);
}

function hasNoText(doc: ParsedDocument): boolean {
  if (doc.kind === "pdf" && doc.pageCount && doc.textlessPages.length >= doc.pageCount) return true;
  return wordCount(doc.rawText) < 5;
}

function assemble(doc: ParsedDocument): AnalysisResult {
  // The profile is built from column-aware reading order, so a two-column PDF
  // still yields usable roles and bullets (for content checks and export).
  // rawText stays the naive left-to-right read: that is what simple parsers see,
  // and layout.columns shows the user the merged lines.
  const build = extractProfile(doc.readingLines);
  const noText = hasNoText(doc);
  const ctx = { doc, build, noText };
  const checks: Check[] = [...extractionChecks(ctx), ...layoutChecks(ctx), ...contentChecks(ctx)];

  const pi = scoreOf(checks.filter((c) => c.category === "extraction" || c.category === "layout"));
  const content = scoreOf(checks.filter((c) => c.category === "content"));

  return {
    version: 1,
    document: {
      kind: doc.kind,
      pageCount: doc.pageCount,
      wordCount: wordCount(doc.rawText),
      fonts: doc.fonts,
      columns: doc.columns,
    },
    rawText: doc.rawText,
    sourceHtml: doc.sourceHtml,
    profile: build.profile,
    checks,
    scores: {
      parseIntegrity: noText ? Math.min(pi, NO_TEXT_CAP) : pi,
      content,
      jobMatch: null,
    },
    match: null,
  };
}

function applyMatch(result: AnalysisResult, jobDescription: string | null): AnalysisResult {
  const jd = typeof jobDescription === "string" ? jobDescription.trim() : "";
  if (!jd) return result;
  const { match, checks } = computeMatch(result.rawText, result.profile, jd);
  return {
    ...result,
    checks: [...result.checks, ...checks],
    scores: { ...result.scores, jobMatch: match.score },
    match,
  };
}
