/**
 * Light check for invented proper names (employers, schools, products) in
 * model output. Not NLP: it looks for capitalised multi-word names, and for
 * single capitalised words after "at" / "@" / "joined", that do not appear in
 * the user's own text. The prompts ask for sentence case, so title-cased
 * phrases are mostly real names; generic career vocabulary is allowed so
 * ordinary headline words don't trip it.
 */

const CONNECTORS = new Set(["of", "and", "&", "for", "the", "de", "la", "du", "van", "von", "der", "y"]);

/** Words that are fine capitalised even when the user never wrote them. */
const GENERIC = new Set(
  `i i'm i've my me we our you your the a an this that these those with at for in on to from and or as by over across into via about
  today currently now previously formerly also then next open
  senior junior lead leading principal staff head chief director manager managing engineer engineering developer designer design
  analyst consultant specialist coordinator associate assistant officer executive founder co-founder cofounder owner partner president
  vice vp svp evp intern student graduate freelance freelancer contractor architect scientist researcher administrator advisor adviser
  strategist marketer writer editor teacher nurse accountant product products project projects program programs programme operations
  software data marketing sales business customer customers success support finance financial people hr human resources talent growth
  brand content digital technical technology tech engineering ux ui full-stack fullstack full stack frontend backend front-end back-end
  cloud security platform platforms infrastructure mobile web machine learning ai ml analytics research strategy strategic development
  management leadership team teams remote hybrid experienced results professional professionals expert expertise certified aspiring
  helping building driving leading creating delivering turning making growing scaling solving shipping crafting connecting
  passionate focused dedicated proven seasoned skilled qualified multilingual bilingual
  linkedin open-to-work featured about experience education skills summary certifications headline profile recommendations
  ceo cto cfo coo cmo cio cpo
  mba phd msc bsc ba bs ms ma b.s m.s b.a m.a
  north south east west global international regional national local
  i.e e.g etc`
    .split(/\s+/)
    .filter(Boolean),
);

const ORG_CONTEXT = /(?:^|\s)(?:at|@|joined|joining)\s+$/i;

const norm = (w: string) => w.toLowerCase().replace(/[’']s$/, "").replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");

function wordSet(text: string): Set<string> {
  const set = new Set<string>();
  for (const w of text.toLowerCase().split(/[^a-z0-9&+#.'’-]+/)) {
    const n = norm(w);
    if (n) set.add(n);
  }
  return set;
}

const CAP = "[A-Z][A-Za-z0-9&'’+-]*";
const NAME_RUN = new RegExp(`${CAP}(?:[ \\t]+(?:(?:of|and|for|the|de|la|du|van|von|der|y|&)[ \\t]+)*${CAP})*`, "g");

/** Precomputed allowed text, reused across many checks. */
export interface NameGuard {
  /** Capitalised names in `text` that look invented (not in the allowed text). */
  unknown(text: string): string[];
}

export function nameGuard(allowedText: string): NameGuard {
  const lower = allowedText.toLowerCase().replace(/\s+/g, " ");
  const words = wordSet(allowedText);
  const known = (w: string) => {
    const n = norm(w);
    return !n || words.has(n) || GENERIC.has(n) || /ing$/.test(n) || /^\d/.test(n);
  };

  return {
    unknown(text: string): string[] {
      const out: string[] = [];
      for (const m of text.matchAll(NAME_RUN)) {
        const phrase = m[0];
        const parts = phrase.split(/[ \t]+/).filter((w) => !CONNECTORS.has(w.toLowerCase()));
        if (lower.includes(phrase.toLowerCase().replace(/\s+/g, " "))) continue;
        const before = text.slice(Math.max(0, m.index! - 12), m.index!);
        const orgContext = ORG_CONTEXT.test(before);
        // Single capitalised words are only suspicious right after "at" / "@" / "joined".
        if (parts.length < 2 && !orgContext) continue;
        const unknownWords = parts.filter((w) => !known(w));
        if (unknownWords.length) out.push(phrase);
      }
      return out;
    },
  };
}

/** Split prose into sentences (keeps the terminal punctuation). */
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“[(])/).filter((s) => s.trim());
}

/** Drop sentences that name something the user never wrote. Paragraph breaks are kept. */
export function dropInventedSentences(text: string, guard: NameGuard): string {
  return text
    .split(/\n\s*\n/)
    .map((p) =>
      sentences(p)
        .filter((s) => guard.unknown(s).length === 0)
        .join(" "),
    )
    .filter((p) => p.trim())
    .join("\n\n");
}
