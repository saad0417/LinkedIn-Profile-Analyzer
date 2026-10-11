// Copies the pdf.js browser build into public/ so the results page can load it
// on demand (only when previewing a PDF) instead of shipping it in a bundle.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = dirname(require.resolve("pdfjs-dist/package.json"));
const out = join(process.cwd(), "public", "vendor", "pdfjs");
mkdirSync(out, { recursive: true });
for (const f of ["pdf.min.mjs", "pdf.worker.min.mjs"]) {
  cpSync(join(root, "legacy", "build", f), join(out, f));
}
console.log("pdf.js copied to public/vendor/pdfjs");
