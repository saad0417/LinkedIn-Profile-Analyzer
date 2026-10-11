// LinkedIn profile analyzer entry point.
//
// analyzeLinkedIn(buf) reads LinkedIn's own "Save to PDF" export (Profile →
// More → Save to PDF) and scores it with a deterministic rubric: no LLM, no
// randomness, no clock, stable ordering. Same PDF → same result. Everything
// happens in memory; nothing is written to disk and no content is logged.
//
// Other PDFs are analysed best-effort with looksLikeLinkedIn = false.
// Throws UnreadableDocumentError for encrypted, corrupt or image-only files.
import type { LinkedInAnalysis } from "./types";
import { UnreadableDocumentError } from "@/lib/analyze/errors";
import { parseLinkedInPdf } from "./parse";
import { NOT_ASSESSED, scoreProfile } from "./rubric";

export { UnreadableDocumentError } from "@/lib/analyze/errors";
export { SECTION_WEIGHTS, SECTION_LABELS, NOT_ASSESSED, TOP_SKILLS_PASS } from "./rubric";

const CORRUPT = "We couldn't open this PDF. It may be damaged. Download a fresh copy from LinkedIn: open your profile, More → Save to PDF, and upload that file.";

export async function analyzeLinkedIn(buf: Uint8Array): Promise<LinkedInAnalysis> {
  if (!(buf instanceof Uint8Array) || buf.byteLength === 0) throw new UnreadableDocumentError("corrupt", CORRUPT);
  let parsed: Awaited<ReturnType<typeof parseLinkedInPdf>>;
  try {
    parsed = await parseLinkedInPdf(buf);
  } catch (e) {
    // The engine's generic "corrupt" message talks about Word; point LinkedIn users at a fresh export instead.
    if (e instanceof UnreadableDocumentError && e.reason === "corrupt" && e.message === new UnreadableDocumentError("corrupt").message) throw new UnreadableDocumentError("corrupt", CORRUPT);
    throw e;
  }
  const { score, sections } = scoreProfile({ profile: parsed.profile, hasSummary: parsed.hasSummary });
  return {
    version: 1,
    looksLikeLinkedIn: parsed.looksLikeLinkedIn,
    pageCount: parsed.pageCount,
    profile: parsed.profile,
    rawText: parsed.rawText,
    score,
    sections,
    notAssessed: [...NOT_ASSESSED],
  };
}
