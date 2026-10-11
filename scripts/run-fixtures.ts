// Runs the analysis engine over the fixture corpus and checks expectations.
//   npx tsx scripts/run-fixtures.ts            # table + assertions
//   npx tsx scripts/run-fixtures.ts 04 --dump  # dump rawText/profile/checks for matching fixtures
// Exit code 1 if any expectation, determinism or rematch assertion fails.
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { analyzeDocument, rematch, UnreadableDocumentError } from "../src/lib/analyze";
import type { AnalysisResult, CheckStatus, DocKind, TemplateId } from "../src/lib/types";
import { sampleFor } from "../src/lib/export";

const ROOT = resolve(__dirname, "..");
const FIX = join(ROOT, "fixtures");
const SAMPLE = join(ROOT, "public", "samples", "sample-resume.pdf");

type StatusExp = CheckStatus | CheckStatus[] | "absent";
interface Expect {
  checks?: Record<string, StatusExp>;
  columns?: number;
  pages?: number;
  piMax?: number;
  piMin?: number;
  contentMax?: number;
  contentMin?: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: boolean;
  roles?: number;
  minRoles?: number;
  firstRole?: { title?: string | null; company?: string | null; location?: string | null; start?: string | null; end?: string | null };
  education?: number;
  minSkills?: number;
  certifications?: number;
  unknownHeadings?: string[];
  fontsInclude?: string[];
  evidenceIncludes?: Record<string, string>;
  rawTextIncludes?: string[];
  rawTextExcludes?: string[];
  jd?: string;
  matchChecks?: Record<string, StatusExp>;
  jobTitle?: string;
  /** Round-trip fixture rendered by src/lib/export from sampleFor(template). */
  exportOf?: TemplateId;
}

const EXPECT_EXTRA: Record<string, Expect> = {};
for (const t of ["standard", "technical", "entry"] as TemplateId[])
  for (const fmt of ["docx", "pdf"]) {
    EXPECT_EXTRA[`export-${t}.${fmt}`] = {
      exportOf: t,
      columns: 1,
      checks: {
        "extraction.text": "pass", "extraction.name": "pass", "extraction.email": "pass", "extraction.phone": "pass",
        "extraction.headings": "pass", "extraction.dates": "pass", "extraction.date-format": "pass", "layout.columns": "pass",
        "layout.graphics": "pass", "content.linkedin": "pass",
        "content.action-verbs": "pass", "content.bullet-length": "pass", "content.summary": "pass", "content.skills": "pass",
        "content.location": "pass", ...(fmt === "pdf" ? { "content.length": "pass" as const } : {}),
      },
    };
  }

/** Every role, school, skill and certification must come back exactly as exported. */
function checkExport(r: AnalysisResult, t: TemplateId, fail: (m: string) => void) {
  const s = sampleFor(t);
  const p = r.profile;
  if (p.name !== s.name) fail(`name expected ${s.name}, got ${p.name}`);
  if (p.email !== s.email) fail(`email expected ${s.email}, got ${p.email}`);
  if (p.phone !== s.phone) fail(`phone expected ${s.phone}, got ${p.phone}`);
  if (p.experience.length !== s.experience.length) fail(`roles expected ${s.experience.length}, got ${p.experience.length}`);
  s.experience.forEach((x, i) => {
    const got = p.experience[i];
    if (!got) return;
    if (got.title !== x.title) fail(`role[${i}].title expected ${x.title}, got ${got.title}`);
    if (got.company !== x.company) fail(`role[${i}].company expected ${x.company}, got ${got.company}`);
    if (got.bullets.length !== x.bullets.length) fail(`role[${i}] bullets expected ${x.bullets.length}, got ${got.bullets.length}`);
  });
  if (p.education.length !== s.education.length) fail(`education expected ${s.education.length}, got ${p.education.length}`);
  s.education.forEach((x, i) => {
    const got = p.education[i];
    if (got && got.institution !== x.institution) fail(`education[${i}].institution expected ${x.institution}, got ${got.institution}`);
  });
  const want = s.skills.map((k) => k.toLowerCase()).sort();
  const have = p.skills.map((k) => k.toLowerCase()).sort();
  if (JSON.stringify(want) !== JSON.stringify(have)) fail(`skills expected ${want.length} ${JSON.stringify(want)}, got ${have.length} ${JSON.stringify(have)}`);
  if (p.certifications.length !== s.certifications.length) fail(`certifications expected ${s.certifications.length}, got ${p.certifications.length}`);
}

const EXPECT: Record<string, Expect> = {
  "01-clean-software-us.docx": {
    columns: 1,
    checks: {
      "extraction.text": "pass", "extraction.name": "pass", "extraction.email": "pass", "extraction.phone": "pass", "extraction.headings": "pass",
      "extraction.dates": "pass", "extraction.date-format": "pass", "layout.columns": "pass", "layout.tables": "pass", "layout.header-footer": "pass",
      "layout.text-boxes": "pass", "layout.graphics": "pass", "layout.fonts": "pass", "content.quantified": "pass", "content.weak-openers": "pass",
      "content.pronouns": "pass", "content.gaps": "pass", "content.linkedin": "pass", "content.resume-accent": "pass",
      "content.action-verbs": "pass", "content.bullet-length": "pass", "content.summary": "pass", "content.skills": "pass",
      "content.location": "pass", "content.length": "absent",
    },
    piMin: 100,
    name: "Daniel Okafor",
    email: "daniel.okafor@example.com",
    phone: "(512) 555-0142",
    linkedin: true,
    roles: 3,
    firstRole: { title: "Senior Software Engineer", company: "Northwind Payments", location: "Austin, TX", start: "2021-03", end: "present" },
    education: 1,
    minSkills: 10,
    certifications: 2,
    jd: "backend-engineer.txt",
    jobTitle: "Senior Software Engineer (Backend)",
    matchChecks: { "match.title": "pass", "match.hard-skills": ["pass", "warn"] },
  },
  "02-clean-accountant-uk.pdf": {
    columns: 1,
    checks: { "layout.columns": "pass", "extraction.headings": "pass", "extraction.date-format": "pass", "layout.fonts": "pass", "content.quantified": "pass", "layout.tables": "absent", "content.length": "pass", "content.skills": "pass" },
    name: "Charlotte Hughes",
    phone: "+44 161 496 0732",
    email: "charlotte.hughes@example.co.uk",
    linkedin: true,
    roles: 2,
    firstRole: { title: "Financial Reporting Manager", company: "Pennine Retail Group plc", location: "Manchester", start: "2021-09", end: "present" },
    education: 1,
    certifications: 1,
    jd: "financial-analyst.txt",
    jobTitle: "Financial Reporting Manager",
    matchChecks: { "match.title": "pass", "match.hard-skills": ["pass", "warn"] },
  },
  "03-right-aligned-dates-in.pdf": {
    columns: 1,
    checks: { "layout.columns": "pass", "extraction.date-format": "pass", "extraction.headings": "pass" },
    name: "Priya Raghunathan",
    phone: "+91 98450 12345",
    roles: 3,
    firstRole: { title: "Senior Data Analyst", company: "Kirana Mart Online", start: "2022-04", end: "present" },
    minSkills: 8,
  },
  "04-sidebar-two-column-au.pdf": {
    columns: 2,
    checks: { "layout.columns": "fail", "extraction.headings": "pass" },
    roles: 2,
    firstRole: { title: "Marketing Manager", company: "Harbourline Software", location: "Sydney", start: "2020-02", end: "present" },
    minSkills: 8,
    rawTextIncludes: ["SKILLS   Marketing manager with 8 years"],
    email: "mia.t@example.com.au",
    name: "Mia Thompson",
  },
  "05-sidebar-two-column-au.docx": {
    columns: 2,
    checks: { "layout.columns": "warn", "layout.tables": "fail" },
    name: "Mia Thompson",
    phone: "+61 2 9876 5432",
  },
  "06-newspaper-columns.docx": {
    columns: 2,
    checks: { "layout.columns": "fail", "layout.tables": "pass" },
    name: "Tomasz Nowak",
    phone: "+48 512 345 678",
    roles: 2,
  },
  "07-borderless-table-dates-ae.docx": {
    columns: 1,
    checks: { "layout.tables": "fail", "layout.columns": "pass" },
    phone: "+971 50 123 4567",
    roles: 2,
    firstRole: { title: "Operations Manager", company: "Gulf Crest Hotels", location: "Dubai", start: "2019-01", end: "present" },
  },
  "08-header-contacts-us.docx": {
    checks: { "layout.header-footer": "fail", "extraction.email": "fail", "extraction.phone": "fail", "extraction.name": "fail" },
    name: null,
    email: null,
    phone: null,
    roles: 2,
    evidenceIncludes: { "layout.header-footer": "rachel.kim@example.com" },
    rawTextExcludes: ["rachel.kim@example.com"],
  },
  "09-text-boxes.docx": {
    checks: { "layout.text-boxes": "fail", "extraction.email": "fail", "extraction.name": "fail" },
    email: null,
    name: null,
    roles: 2,
    evidenceIncludes: { "layout.text-boxes": "lucia.fernandez@example.es" },
    rawTextExcludes: ["Lucía Fernández"],
  },
  "10-creative-headings.docx": {
    checks: { "extraction.headings": "fail", "content.linkedin": "pass", "content.skills": "fail" },
    name: "Hannah Becker",
    phone: "503-555-0164",
    roles: 0,
    unknownHeadings: ["Hello, I'm Hannah", "Where I've Been", "My Journey", "What I Bring", "Things I Love"],
  },
  "11-montserrat-poppins.docx": {
    checks: { "layout.fonts": "warn" },
    fontsInclude: ["Montserrat", "Poppins"],
    phone: "+233 24 123 4567",
    roles: 2,
  },
  "12-montserrat-pdf.pdf": {
    columns: 1,
    checks: { "layout.fonts": "warn", "layout.columns": "pass" },
    fontsInclude: ["Montserrat"],
    phone: "+39 02 1234 5678",
    roles: 2,
  },
  "13-years-only-nurse-ca.pdf": {
    checks: { "extraction.date-format": "warn", "content.pronouns": "pass", "content.linkedin": "warn" },
    name: "Emily Tremblay",
    phone: "(416) 555-0199",
    linkedin: false,
    roles: 2,
    firstRole: { title: "Registered Nurse, Emergency Department", company: "Lakeview General Hospital", start: null, end: "present" },
    certifications: 2,
    jd: "registered-nurse.txt",
    jobTitle: "Registered Nurse – Emergency Department",
    matchChecks: { "match.title": "pass", "match.hard-skills": ["pass", "warn"] },
  },
  "14-mixed-dates.docx": {
    checks: { "extraction.date-format": ["warn", "fail"] },
    phone: "404.555.0123",
    roles: 3,
    firstRole: { title: "Account Executive", company: "Peachtree Cloud", start: "2021-01", end: "present" },
  },
  "15-image-only-scan.pdf": {
    checks: {
      "extraction.text": "fail", "extraction.email": "fail", "content.quantified": "fail", "content.pronouns": "fail",
      "layout.columns": "absent", "layout.fonts": "absent", "layout.graphics": "absent",
    },
    piMax: 5,
    contentMax: 0,
    name: null,
    email: null,
    roles: 0,
  },
  "16-skill-bars.pdf": {
    checks: { "layout.graphics": "fail", "layout.columns": "pass" },
    name: "Arjun Mehta",
    phone: "+91 20 2345 6789",
    roles: 2,
  },
  "17-skill-bars.docx": {
    checks: { "layout.graphics": "fail" },
    name: "Arjun Mehta",
    roles: 2,
  },
  "18-pronouns-weak-openers.docx": {
    checks: { "content.pronouns": "fail", "content.weak-openers": "fail", "content.quantified": "fail", "content.padding": ["warn", "fail"], "content.linkedin": "warn", "content.action-verbs": "warn", "content.skills": "warn" },
    name: "Jessica Moore",
    phone: "602-555-0110",
    roles: 2,
    contentMax: 40,
    jd: "backend-engineer.txt",
    matchChecks: { "match.title": "fail", "match.hard-skills": "fail" },
  },
  "19-employment-gap.pdf": {
    checks: { "content.gaps": "warn" },
    phone: "07700 900123",
    roles: 3,
    evidenceIncludes: { "content.gaps": "14 months" },
  },
  "20-entry-level-pk.docx": {
    checks: { "extraction.headings": "pass", "content.quantified": "pass", "content.summary": "warn" },
    name: "Ayesha Siddiqui",
    phone: "+92 300 1234567",
    roles: 1,
    education: 1,
    certifications: 1,
  },
  "21-senior-two-page-de.pdf": {
    pages: 2,
    checks: { "content.resume-accent": "warn", "layout.columns": "pass", "content.gaps": "pass", "content.length": "pass" },
    name: "Katharina Weber",
    phone: "+49 30 1234 5678",
    roles: 5,
    firstRole: { title: "Director of Engineering", company: "Spreewald Mobility GmbH", location: "Berlin", start: "2020-04", end: "present" },
  },
  "22-long-three-page-us.pdf": {
    pages: 3,
    columns: 1,
    checks: {
      "content.length": "warn", "content.bullet-length": "fail", "content.summary": "warn", "content.location": "warn",
      "content.skills": "fail", "content.action-verbs": "fail", "content.weak-openers": "pass",
    },
    name: "Gregory Lindqvist",
    phone: "(612) 555-0193",
    roles: 6,
    evidenceIncludes: { "content.location": "4127 Maple Grove Avenue", "content.bullet-length": "run past 30 words", "content.summary": "150 words" },
  },
  "sample-resume.pdf": {
    columns: 2,
    checks: {
      "layout.columns": "fail", "extraction.email": "pass", "extraction.phone": "pass", "extraction.headings": "warn",
      "content.linkedin": "warn", "content.weak-openers": "fail", "content.quantified": "warn", "content.pronouns": "warn",
      "extraction.date-format": "warn",
    },
    name: "Jordan Ellis",
    roles: 2,
    unknownHeadings: ["Get in touch", "About Me"],
  },
};

/* ---------------- run ---------------- */

const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith("--"));
const dump = args.includes("--dump");

function statusOk(actual: CheckStatus | undefined, exp: StatusExp): boolean {
  if (exp === "absent") return actual === undefined;
  if (Array.isArray(exp)) return actual !== undefined && exp.includes(actual);
  return actual === exp;
}

function fmtExp(e: StatusExp) {
  return Array.isArray(e) ? e.join("|") : e;
}

async function main() {
  const files = readdirSync(FIX)
    .filter((f) => [".pdf", ".docx"].includes(extname(f)))
    .sort()
    .map((f) => join(FIX, f));
  files.push(SAMPLE);
  const defaultJd = readFileSync(join(FIX, "jd", "backend-engineer.txt"), "utf8");

  const failures: string[] = [];
  const rows: string[][] = [];
  let maxMs = 0;

  for (const path of files) {
    const file = path.split("/").pop()!;
    if (filter && !file.includes(filter)) continue;
    const kind: DocKind = file.endsWith(".pdf") ? "pdf" : "docx";
    const buf = new Uint8Array(readFileSync(path));
    const exp = EXPECT[file] ?? EXPECT_EXTRA[file];
    const fail = (msg: string) => failures.push(`${file}: ${msg}`);
    if (!exp) fail("no expectations defined");

    const t0 = performance.now();
    const r = await analyzeDocument(buf, kind, null);
    const ms = performance.now() - t0;
    maxMs = Math.max(maxMs, ms);

    // Determinism: a second run must be deep-equal.
    const r2 = await analyzeDocument(buf, kind, null);
    if (!isDeepStrictEqual(r, r2)) fail("non-deterministic result (two runs differ)");

    // rematch equivalence with a JD.
    const jdText = exp?.jd ? readFileSync(join(FIX, "jd", exp.jd), "utf8") : defaultJd;
    const withJd = await analyzeDocument(buf, kind, jdText);
    const re = rematch(r, jdText);
    if (!isDeepStrictEqual(re, withJd)) fail("rematch(result, jd) differs from analyzeDocument(buf, kind, jd)");
    const cleared = rematch(withJd, null);
    if (!isDeepStrictEqual(cleared, r)) fail("rematch(result, null) does not restore the JD-less result");
    if (JSON.stringify(JSON.parse(JSON.stringify(r))) !== JSON.stringify(r)) fail("result is not JSON-stable");

    if (exp) check(r, withJd, exp, fail);

    const failing = r.checks.filter((c) => c.status === "fail").map((c) => c.id.replace(/^(extraction|layout|content)\./, (m) => m[0] + "."));
    const warning = r.checks.filter((c) => c.status === "warn").map((c) => c.id.replace(/^(extraction|layout|content)\./, (m) => m[0] + "."));
    rows.push([
      file.replace(/\.(pdf|docx)$/, ""),
      kind,
      String(r.document.columns),
      String(r.scores.parseIntegrity),
      String(r.scores.content),
      String(withJd.scores.jobMatch ?? "-"),
      failing.join(" ") || "-",
      warning.join(" ") || "-",
      r.profile.name ?? "∅",
      r.profile.email ? "✓" : "∅",
      r.profile.phone ?? "∅",
      String(r.profile.experience.length),
      `${Math.round(ms)}`,
    ]);

    if (dump) {
      console.log(`\n===== ${file} =====`);
      console.log("--- rawText ---\n" + r.rawText);
      console.log("--- profile ---\n" + JSON.stringify({ ...r.profile, sections: r.profile.sections.map((s) => `${s.heading} → ${s.kind}`) }, null, 1));
      console.log("--- document ---\n" + JSON.stringify(r.document));
      for (const c of withJd.checks)
        console.log(`[${c.status.toUpperCase()}] ${c.id} (${c.weight}) ${c.title}\n    ${c.summary}${c.fix ? `\n    fix: ${c.fix}` : ""}${c.evidence ? `\n    evidence: ${c.evidence.map((e) => `${e.text}${e.where ? ` @ ${e.where}` : ""}`).join(" ‖ ")}` : ""}${c.rewriteTargets ? `\n    rewrite: ${c.rewriteTargets.length}` : ""}`);
      if (withJd.match) console.log("--- match ---\n" + JSON.stringify(withJd.match));
    }
  }

  // Error handling.
  const ERRORS: Record<string, "encrypted" | "corrupt" | "ok-no-text"> = {
    "encrypted.pdf": "encrypted",
    "truncated.pdf": "corrupt",
    "garbage.pdf": "corrupt",
    "not-a-zip.docx": "corrupt",
    "no-document-xml.docx": "corrupt",
    "textbox-only.docx": "ok-no-text",
  };
  for (const [file, want] of Object.entries(ERRORS)) {
    if (filter && !file.includes(filter)) continue;
    const buf = new Uint8Array(readFileSync(join(FIX, "errors", file)));
    const kind: DocKind = file.endsWith(".pdf") ? "pdf" : "docx";
    try {
      const r = await analyzeDocument(buf, kind, null);
      if (want !== "ok-no-text") failures.push(`errors/${file}: expected UnreadableDocumentError(${want}), got a result`);
      else {
        const st = (id: string) => r.checks.find((c) => c.id === id)?.status;
        if (st("extraction.text") !== "fail" || st("layout.text-boxes") !== "fail" || r.scores.parseIntegrity > 5)
          failures.push(`errors/${file}: expected no-text handling with text-box failure (PI ${r.scores.parseIntegrity})`);
      }
      console.log(`errors/${file}: analysed (PI ${r.scores.parseIntegrity})`);
    } catch (e) {
      const ok = e instanceof UnreadableDocumentError && e.reason === want;
      if (!ok) failures.push(`errors/${file}: expected ${want}, got ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
      console.log(`errors/${file}: ${e instanceof UnreadableDocumentError ? `UnreadableDocumentError(${e.reason})` : String(e)}`);
    }
  }

  const head = ["fixture", "kind", "col", "PI", "Cnt", "JM", "fail", "warn", "name", "@", "phone", "roles", "ms"];
  const widths = head.map((h, i) => Math.min(i === 6 || i === 7 ? 44 : 32, Math.max(h.length, ...rows.map((r) => r[i].length))));
  const line = (cells: string[]) => cells.map((c, i) => (c.length > widths[i] ? c.slice(0, widths[i] - 1) + "…" : c.padEnd(widths[i]))).join(" ");
  console.log(line(head));
  console.log(widths.map((w) => "-".repeat(w)).join(" "));
  for (const r of rows) console.log(line(r));
  console.log(`\nslowest analysis: ${Math.round(maxMs)} ms`);

  if (failures.length) {
    console.log(`\n${failures.length} FAILED:`);
    for (const f of failures) console.log("  ✗ " + f);
    process.exit(1);
  }
  console.log(`\nAll ${rows.length} fixtures passed expectations, determinism and rematch checks.`);
}

function check(r: AnalysisResult, withJd: AnalysisResult, e: Expect, fail: (m: string) => void) {
  const status = (res: AnalysisResult, id: string) => res.checks.find((c) => c.id === id)?.status;
  for (const [id, s] of Object.entries(e.checks ?? {})) if (!statusOk(status(r, id), s)) fail(`${id} expected ${fmtExp(s)}, got ${status(r, id) ?? "absent"}`);
  for (const [id, s] of Object.entries(e.matchChecks ?? {})) if (!statusOk(status(withJd, id), s)) fail(`${id} expected ${fmtExp(s)}, got ${status(withJd, id) ?? "absent"}`);
  if (e.exportOf) checkExport(r, e.exportOf, fail);
  if (e.jobTitle !== undefined && withJd.match?.jobTitle !== e.jobTitle) fail(`jobTitle expected ${e.jobTitle}, got ${withJd.match?.jobTitle}`);
  if (e.columns !== undefined && r.document.columns !== e.columns) fail(`columns expected ${e.columns}, got ${r.document.columns}`);
  if (e.pages !== undefined && r.document.pageCount !== e.pages) fail(`pages expected ${e.pages}, got ${r.document.pageCount}`);
  if (e.piMax !== undefined && r.scores.parseIntegrity > e.piMax) fail(`PI ${r.scores.parseIntegrity} > ${e.piMax}`);
  if (e.piMin !== undefined && r.scores.parseIntegrity < e.piMin) fail(`PI ${r.scores.parseIntegrity} < ${e.piMin}`);
  if (e.contentMax !== undefined && r.scores.content > e.contentMax) fail(`content ${r.scores.content} > ${e.contentMax}`);
  if (e.contentMin !== undefined && r.scores.content < e.contentMin) fail(`content ${r.scores.content} < ${e.contentMin}`);
  const p = r.profile;
  if (e.name !== undefined && p.name !== e.name) fail(`name expected ${e.name}, got ${p.name}`);
  if (e.email !== undefined && p.email !== e.email) fail(`email expected ${e.email}, got ${p.email}`);
  if (e.phone !== undefined && p.phone !== e.phone) fail(`phone expected ${e.phone}, got ${p.phone}`);
  if (e.linkedin !== undefined && !!p.linkedin !== e.linkedin) fail(`linkedin expected ${e.linkedin}, got ${p.linkedin}`);
  if (e.roles !== undefined && p.experience.length !== e.roles) fail(`roles expected ${e.roles}, got ${p.experience.length}`);
  if (e.minRoles !== undefined && p.experience.length < e.minRoles) fail(`roles expected ≥${e.minRoles}, got ${p.experience.length}`);
  if (e.firstRole) {
    const r0 = p.experience[0];
    for (const [k, v] of Object.entries(e.firstRole)) {
      const got = r0 ? (r0 as unknown as Record<string, unknown>)[k] : "(no role)";
      if (got !== v) fail(`role[0].${k} expected ${v}, got ${got}`);
    }
  }
  if (e.education !== undefined && p.education.length !== e.education) fail(`education expected ${e.education}, got ${p.education.length}`);
  if (e.minSkills !== undefined && p.skills.length < e.minSkills) fail(`skills expected ≥${e.minSkills}, got ${p.skills.length}`);
  if (e.certifications !== undefined && p.certifications.length !== e.certifications) fail(`certifications expected ${e.certifications}, got ${p.certifications.length}`);
  if (e.unknownHeadings) {
    const got = p.sections.filter((s) => s.kind === null).map((s) => s.heading);
    for (const h of e.unknownHeadings) if (!got.includes(h)) fail(`unknown heading “${h}” not flagged (got ${JSON.stringify(got)})`);
  }
  for (const f of e.fontsInclude ?? []) if (!r.document.fonts.includes(f)) fail(`font ${f} not reported (got ${r.document.fonts.join(", ")})`);
  for (const [id, needle] of Object.entries(e.evidenceIncludes ?? {})) {
    const c = r.checks.find((x) => x.id === id);
    const hay = [c?.summary ?? "", ...(c?.evidence ?? []).map((x) => x.text)].join(" ");
    if (!hay.includes(needle)) fail(`${id} evidence/summary lacks “${needle}”`);
  }
  for (const s of e.rawTextIncludes ?? []) if (!r.rawText.includes(s)) fail(`rawText lacks “${s}”`);
  for (const s of e.rawTextExcludes ?? []) if (r.rawText.includes(s)) fail(`rawText unexpectedly contains “${s}”`);
  // Universal invariants.
  for (const c of [...withJd.checks]) {
    if (c.status === "pass" && c.fix) fail(`${c.id} passes but has a fix`);
    if (c.status !== "pass" && !c.fix) fail(`${c.id} is ${c.status} but has no fix`);
    if (/!/.test(c.summary + (c.fix ?? "") + c.title)) fail(`${c.id} text contains an exclamation mark`);
  }
  const ids = withJd.checks.map((c) => c.id);
  if (new Set(ids).size !== ids.length) fail("duplicate check ids");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
