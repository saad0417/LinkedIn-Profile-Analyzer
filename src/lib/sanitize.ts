/**
 * Mammoth emits a small, predictable subset of HTML, but the source is an
 * arbitrary uploaded file. Allow-list tags, drop every attribute except safe
 * ones, and neutralise non-http(s) links and non-data images.
 */
const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "sup", "sub",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th",
  "a", "img", "span", "blockquote",
]);

export function sanitizeDocHtml(html: string): string {
  // Remove whole dangerous elements including their content.
  let out = html.replace(/<(script|style|iframe|object|embed|svg|math|template)[\s\S]*?<\/\1\s*>/gi, "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");

  // Every "<…>" is rebuilt from the allow-list; any other "<" (e.g. an unterminated tag) is escaped.
  return out.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>|</g, (full, rawTag: string | undefined, rawAttrs: string) => {
    if (rawTag === undefined) return "&lt;";
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (full.startsWith("</")) return `</${tag}>`;

    const attrs: string[] = [];
    const attrRe = /([a-zA-Z-:]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(rawAttrs))) {
      const name = m[1].toLowerCase();
      const value = m[3] ?? m[4] ?? "";
      if (tag === "a" && name === "href" && /^(https?:|mailto:|#)/i.test(value.trim())) {
        attrs.push(`href="${escapeAttr(value)}" rel="noopener noreferrer nofollow" target="_blank"`);
      } else if (tag === "img" && name === "src" && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value)) {
        attrs.push(`src="${escapeAttr(value)}"`);
      } else if (tag === "img" && name === "alt") {
        attrs.push(`alt="${escapeAttr(value)}"`);
      } else if ((tag === "td" || tag === "th") && (name === "colspan" || name === "rowspan") && /^\d{1,2}$/.test(value)) {
        attrs.push(`${name}="${value}"`);
      }
    }
    const selfClose = tag === "br" || tag === "img";
    return `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}${selfClose ? " /" : ""}>`;
  });
}

function escapeAttr(v: string) {
  return v.replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
