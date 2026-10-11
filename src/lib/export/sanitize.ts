/**
 * WinAnsi sanitising for the PDF standard-14 fonts. Unsupported characters
 * are mapped, transliterated, or dropped; it never throws on input text.
 */

const CHAR_MAP: Record<string, string> = {
  " ": " ", " ": " ", " ": " ", " ": " ", " ": " ", " ": " ", " ": " ", "　": " ",
  "‐": "-", "‑": "-", "‒": "-", "―": "—", "−": "-", "⁃": "-",
  "′": "'", "″": '"', "‵": "'", "‛": "'", "‟": '"', "‹": "‹", "›": "›",
  "●": "•", "▪": "•", "▫": "•", "◦": "•", "⁃ ": "-", "‣": "•", "∙": "•",
  "■": "•", "□": "•", "➢": "•", "➤": "•", "►": "•", "➔": "->", "→": "->",
  "←": "<-", "↔": "<->", "⇒": "=>", "≤": "<=", "≥": ">=", "≠": "!=", "≈": "~",
  "✓": "", "✔": "", "✗": "", "★": "*", "☆": "*", "№": "No.",
  "Ł": "L", "ł": "l", "Đ": "D", "đ": "d", "ı": "i", "ħ": "h", "Ħ": "H",
  "ø": "ø", "œ": "œ", "Œ": "Œ", "ß": "ß", "Ș": "S", "ș": "s", "Ț": "T", "ț": "t",
  "Α": "A", "Β": "B", "α": "alpha", "β": "beta", "μ": "µ", "Ω": "Omega",
  "₹": "Rs", "₽": "RUB", "₩": "W", "₪": "ILS", "₺": "TL", "₦": "N",
};

export function makeSanitizer(supported: Set<number>): (s: string) => string {
  const ok = (ch: string) => supported.has(ch.codePointAt(0)!);
  return (input: string) => {
    let out = "";
    for (const ch of input.normalize("NFC")) {
      if (ch === "\n" || ch === "\r" || ch === "\t") {
        out += " ";
        continue;
      }
      if (ok(ch)) {
        out += ch;
        continue;
      }
      const mapped = CHAR_MAP[ch];
      if (mapped !== undefined) {
        out += [...mapped].filter(ok).join("");
        continue;
      }
      // Transliterate: decompose (é -> e + ´, ﬁ -> fi) and keep supported parts.
      const decomposed = ch.normalize("NFKD").replace(/\p{M}/gu, "");
      if (decomposed !== ch) out += [...decomposed].filter(ok).join("");
      // Otherwise drop (CJK, emoji, etc. have no glyph in standard fonts).
    }
    // Tidy separators left behind by dropped scripts ("a, , , b" -> "a, b").
    return out
      .replace(/([,;])(?:\s*[,;])+/g, "$1")
      .replace(/\(\s*\)/g, "")
      .replace(/ {2,}/g, (m) => (m.length === 2 ? m : " "));
  };
}
