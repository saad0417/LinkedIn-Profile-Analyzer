// Runs the LinkedIn analyzer over its fixtures and checks expectations.
//   npx tsx scripts/run-linkedin-fixtures.ts            # table + assertions
//   npx tsx scripts/run-linkedin-fixtures.ts 03 --dump  # dump profile + checks for matching fixtures
// Regenerate the PDFs with: npx tsx scripts/build-linkedin-fixtures.ts
// Exit code 1 if any expectation, determinism or invariant fails.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { analyzeLinkedIn, SECTION_WEIGHTS, UnreadableDocumentError } from "../src/lib/linkedin";
import type { LinkedInAnalysis, LinkedInEducation, LinkedInRole, LinkedInSectionId } from "../src/lib/linkedin/types";
import type { CheckStatus } from "../src/lib/types";

const ROOT = resolve(__dirname, "..");
const FIX = join(ROOT, "fixtures");

type StatusExp = CheckStatus | CheckStatus[];
interface Expect {
  path: string;
  looksLikeLinkedIn: boolean;
  pages?: number;
  name?: string | null;
  headline?: string | null;
  location?: string | null;
  email?: string | null;
  profileUrl?: string | null;
  websites?: string[];
  topSkills?: string[];
  languages?: number;
  certifications?: string[];
  honors?: number;
  publications?: number;
  summaryStarts?: string | null;
  summaryMinChars?: number;
  /** Substrings the summary must contain. */
  summaryIncludes?: string[];
  /** No undecoded HTML entities ("&amp;", "&#39;", …) anywhere in rawText or the profile. */
  noEntities?: boolean;
  roles?: number;
  roleAt?: Record<number, Partial<LinkedInRole>>;
  /** Roles (by index) that must have a description. */
  described?: number[];
  education?: Partial<LinkedInEducation>[];
  score?: [number, number];
  sections?: Partial<Record<LinkedInSectionId, [number, number]>>;
  checks?: Record<string, StatusExp>;
}

const EXPECT: Record<string, Expect> = {
  "li-01-strong": {
    path: "linkedin/li-01-strong.pdf",
    looksLikeLinkedIn: true,
    pages: 2,
    name: "Amara Okonkwo",
    headline: "Senior Product Designer at Brightpath Health | Design Systems, Accessibility (WCAG) & Healthcare UX | Ex-Shopify",
    location: "Toronto, Ontario, Canada",
    email: "amara.okonkwo@example.com",
    profileUrl: "www.linkedin.com/in/amaraokonkwo",
    websites: ["amaraokonkwo.design", "medium.com/@amaradesigns"],
    topSkills: ["Design Systems", "Accessibility", "User Research"],
    languages: 3,
    certifications: ["Certified Professional in Accessibility Core Competencies (CPACC)", "Google UX Design Certificate"],
    honors: 1,
    publications: 0,
    summaryStarts: "I design healthcare products",
    summaryMinChars: 1000,
    roles: 4,
    roleAt: {
      0: { title: "Senior Product Designer", company: "Brightpath Health", start: "2022-03", end: "present", location: "Toronto, Ontario, Canada" },
      1: { title: "Product Designer", company: "Shopify", start: "2019-01", end: "2022-02", location: "Ottawa, Ontario, Canada" },
      3: { title: "Research Assistant, Human-Computer Interaction Lab", company: "Ryerson University" },
    },
    described: [0, 1, 2, 3],
    education: [
      { school: "Toronto Metropolitan University", degree: "Master of Digital Media, Human-Computer Interaction", dates: "2015 - 2017" },
      { school: "University of Lagos", degree: "Bachelor of Science - BS, Computer Science", dates: "2009 - 2013" },
    ],
    score: [90, 100],
    checks: { "linkedin.headline.not-generic": "pass", "linkedin.about.length": "pass", "linkedin.contact.custom-url": "pass", "linkedin.experience.quantified": "pass" },
  },
  "li-02-weak": {
    path: "linkedin/li-02-weak.pdf",
    looksLikeLinkedIn: true,
    pages: 1,
    name: "Jake Miller",
    headline: "Student at Riverbend Community College",
    location: "Columbus, Ohio, United States",
    email: null,
    profileUrl: "www.linkedin.com/in/jake-miller-8a7b3c215",
    websites: [],
    topSkills: ["Microsoft Excel"],
    languages: 0,
    certifications: [],
    summaryStarts: null,
    roles: 2,
    roleAt: {
      0: { title: "Cashier", company: "Kroger", start: "2023-06", end: "present", description: null, location: null },
      1: { title: "Summer Camp Counselor", company: "Columbus Parks and Recreation", start: "2022-06", end: "2022-08" },
    },
    education: [
      { school: "Riverbend Community College", degree: "Associate of Applied Science - AAS, Business Administration and Management, General", dates: "2024 - 2026" },
      { school: "Westland High School", degree: null, dates: null },
    ],
    score: [15, 40],
    sections: { about: [0, 0], headline: [0, 0] },
    checks: {
      "linkedin.headline.not-generic": "fail",
      "linkedin.headline.length": "fail",
      "linkedin.about.length": "fail",
      "linkedin.experience.descriptions": "fail",
      "linkedin.experience.current-role": "fail",
      "linkedin.skills.top-skills-count": "warn",
      "linkedin.contact.custom-url": "warn",
      "linkedin.contact.email": "warn",
      "linkedin.education.degree-field": "warn",
    },
  },
  "li-03-multi-role": {
    path: "linkedin/li-03-multi-role.pdf",
    looksLikeLinkedIn: true,
    pages: 2,
    name: "Rahul Venkataraman",
    headline: "Engineering Manager, Payments Platform at Ledgerline",
    email: "rahul.v@example.com",
    // Long slug wraps across two sidebar lines, then "(LinkedIn)" on a third.
    profileUrl: "www.linkedin.com/in/rahul-venkataraman-engineering-manager",
    websites: ["github.com/rahulv-example"],
    topSkills: ["Distributed Systems", "Engineering Management", "Go (Programming Language)"],
    certifications: ["AWS Certified Solutions Architect – Associate"],
    roles: 4,
    roleAt: {
      0: { title: "Engineering Manager, Payments Platform", company: "Ledgerline", start: "2023-01", end: "present" },
      1: { title: "Senior Software Engineer", company: "Ledgerline", start: "2020-04", end: "2022-12", location: "Austin, Texas, United States" },
      2: { title: "Software Engineer", company: "Ledgerline", start: "2017-08", end: "2020-03" },
      3: { title: "Systems Engineer", company: "Infosys", start: "2014-07", end: "2017-06", location: "Bengaluru, Karnataka, India" },
    },
    described: [0, 1, 2, 3],
    education: [{ school: "Anna University", degree: "Bachelor of Engineering - BE, Computer Science", dates: "2010 - 2014" }],
    score: [70, 95],
    checks: { "linkedin.contact.custom-url": "pass", "linkedin.experience.role-count": "pass", "linkedin.headline.length": "warn" },
  },
  "li-04-senior-3-page": {
    path: "linkedin/li-04-senior-3-page.pdf",
    looksLikeLinkedIn: true,
    pages: 3,
    name: "Katharina Weber",
    location: "Berlin, Berlin, Germany",
    profileUrl: "www.linkedin.com/in/katharinaweber",
    websites: ["kweber.example.de", "spreewald-mobility.example.com"],
    topSkills: ["Engineering Leadership", "Platform Architecture", "Organizational Design"],
    languages: 3,
    certifications: ["Certified Scrum Professional", "AWS Certified Solutions Architect – Professional", "ITIL 4 Foundation", "Kubernetes Administrator (CKA)"],
    honors: 2,
    publications: 2,
    summaryStarts: "I lead engineering organisations",
    roles: 8,
    roleAt: {
      0: { title: "VP Engineering", company: "Spreewald Mobility GmbH", start: "2022-06", end: "present" },
      1: { title: "Director of Engineering", company: "Spreewald Mobility GmbH", start: "2020-04", end: "2022-05" },
      2: { title: "Head of Engineering", company: "Havelland Logistics AG" },
      4: { title: "Senior Software Engineer", company: "Havelland Logistics AG", start: "2012-02", end: "2013-12" },
      6: { company: "Fraunhofer Institute for Transportation and Infrastructure Systems", title: "Research Engineer" },
      // Year-only dates: no month, so start is null; no location line.
      7: { title: "Board Advisor", company: "Startup Advisory", start: null, end: "present", location: null },
    },
    described: [0, 1, 2, 3, 4, 5, 6, 7],
    education: [
      { school: "Technische Universität Dresden", degree: "Diplom-Informatikerin, Computer Science", dates: "2001 - 2007" },
      { school: "Universidad Politécnica de Madrid", dates: "2005 - 2006" },
    ],
    score: [85, 100],
  },
  // Real-export layout: 12pt About dominates the column (so body size must be
  // measured per section), two-line company name, street-address location with
  // no description, wrapped degree/date line, literal "&amp;" from LinkedIn.
  "li-05-founder-long-about": {
    path: "linkedin/li-05-founder-long-about.pdf",
    looksLikeLinkedIn: true,
    pages: 2,
    name: "Hamza Rashidi",
    headline: "Founder & CEO at Kestrelworks | Software Engineering Student | Building tools for small accounting firms",
    location: "Lahore, Punjab, Pakistan",
    email: "hamza.rashidi@example.com",
    profileUrl: "www.linkedin.com/in/hamza-rashidi-kestrelworks",
    websites: ["github.com/hrashidi-dev"],
    topSkills: ["Product Development", "Next.js", "Financial Reporting"],
    certifications: ["Foundations of Project Management"],
    summaryStarts: "I'm the Founder & CEO of Kestrelworks",
    summaryMinChars: 900,
    summaryIncludes: ["into software — document request portals"],
    noEntities: true,
    roles: 2,
    roleAt: {
      0: { title: "Founder & CEO", company: "Kestrelworks", start: "2026-08", end: "present", dates: "August 2026 - Present (3 months)", location: "Lahore, Punjab, Pakistan" },
      1: {
        title: "Summer Intern, Audit and Assurance",
        company: "Hartley Whitcombe Okafor Lindqvist & Partners LLP (a member firm of the Meridian Accounting Network)",
        start: "2025-06",
        end: "2025-08",
        location: "48, Block C-2 Phase 3 Garden Town, Lahore, Pakistan",
        description: null,
      },
    },
    described: [0],
    education: [{ school: "Ravi Valley Institute of Technology", degree: "Bachelor of Science, Software Engineering", dates: "September 2024 - September 2028" }],
  },
  "sample-linkedin": {
    path: "../public/samples/sample-linkedin.pdf",
    looksLikeLinkedIn: true,
    pages: 1,
    name: "Jordan Ellis",
    headline: "Marketing Coordinator",
    roles: 2,
    score: [45, 75],
    // A deliberate mix for the demo.
    checks: {
      "linkedin.headline.role-keyword": "pass",
      "linkedin.headline.not-generic": "warn",
      "linkedin.headline.length": "fail",
      "linkedin.about.length": "fail",
      "linkedin.about.hook": "pass",
      "linkedin.experience.current-role": "warn",
      "linkedin.experience.quantified": "pass",
      "linkedin.skills.alignment": "fail",
      "linkedin.contact.custom-url": "warn",
      "linkedin.contact.location": "pass",
    },
  },
  "not-linkedin-resume": {
    path: "02-clean-accountant-uk.pdf",
    looksLikeLinkedIn: false,
    pages: 1,
    score: [0, 50],
  },
  "not-linkedin-two-column": {
    path: "04-sidebar-two-column-au.pdf",
    looksLikeLinkedIn: false,
    score: [0, 50],
  },
};

const ERRORS: Record<string, "encrypted" | "corrupt"> = {
  "errors/encrypted.pdf": "encrypted",
  "errors/truncated.pdf": "corrupt",
  "errors/garbage.pdf": "corrupt",
  "15-image-only-scan.pdf": "corrupt",
};

/* ---------------- run ---------------- */

const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith("--"));
const dump = args.includes("--dump");

function statusOk(actual: CheckStatus | undefined, exp: StatusExp): boolean {
  return actual !== undefined && (Array.isArray(exp) ? exp.includes(actual) : actual === exp);
}

function check(r: LinkedInAnalysis, e: Expect, fail: (m: string) => void) {
  const p = r.profile;
  const eq = (label: string, got: unknown, want: unknown) => {
    if (!isDeepStrictEqual(got, want)) fail(`${label} expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  };
  eq("looksLikeLinkedIn", r.looksLikeLinkedIn, e.looksLikeLinkedIn);
  if (e.pages !== undefined) eq("pageCount", r.pageCount, e.pages);
  if (e.name !== undefined) eq("name", p.name, e.name);
  if (e.headline !== undefined) eq("headline", p.headline, e.headline);
  if (e.location !== undefined) eq("location", p.location, e.location);
  if (e.email !== undefined) eq("email", p.email, e.email);
  if (e.profileUrl !== undefined) eq("profileUrl", p.profileUrl, e.profileUrl);
  if (e.websites) eq("websites", p.websites, e.websites);
  if (e.topSkills) eq("topSkills", p.topSkills, e.topSkills);
  if (e.languages !== undefined) eq("languages.length", p.languages.length, e.languages);
  if (e.certifications) eq("certifications", p.certifications, e.certifications);
  if (e.honors !== undefined) eq("honors.length", p.honors.length, e.honors);
  if (e.publications !== undefined) eq("publications.length", p.publications.length, e.publications);
  if (e.summaryStarts === null && p.summary !== null) fail(`summary expected null, got ${JSON.stringify(p.summary.slice(0, 40))}`);
  if (e.summaryStarts && !p.summary?.startsWith(e.summaryStarts)) fail(`summary should start “${e.summaryStarts}”, got ${JSON.stringify(p.summary?.slice(0, 40))}`);
  if (e.summaryMinChars && (p.summary?.length ?? 0) < e.summaryMinChars) fail(`summary ${p.summary?.length ?? 0} chars < ${e.summaryMinChars}`);
  for (const s of e.summaryIncludes ?? []) if (!p.summary?.includes(s)) fail(`summary should include “${s}”`);
  if (e.noEntities) {
    const ent = /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i;
    const inRaw = r.rawText.match(ent);
    const inProfile = JSON.stringify(p).match(ent);
    if (inRaw) fail(`rawText contains undecoded entity ${inRaw[0]}`);
    if (inProfile) fail(`profile contains undecoded entity ${inProfile[0]}`);
  }
  if (e.roles !== undefined) eq("experience.length", p.experience.length, e.roles);
  for (const [i, want] of Object.entries(e.roleAt ?? {})) {
    const got = p.experience[Number(i)];
    if (!got) {
      fail(`role[${i}] missing`);
      continue;
    }
    for (const [k, v] of Object.entries(want)) eq(`role[${i}].${k}`, (got as unknown as Record<string, unknown>)[k], v);
  }
  for (const i of e.described ?? []) if (!p.experience[i]?.description) fail(`role[${i}] has no description`);
  if (e.education) {
    eq("education.length", p.education.length, e.education.length);
    e.education.forEach((want, i) => {
      for (const [k, v] of Object.entries(want)) eq(`education[${i}].${k}`, (p.education[i] as unknown as Record<string, unknown> | undefined)?.[k], v);
    });
  }
  if (e.score && (r.score < e.score[0] || r.score > e.score[1])) fail(`score ${r.score} outside ${e.score[0]}–${e.score[1]}`);
  for (const [id, [lo, hi]] of Object.entries(e.sections ?? {}) as [LinkedInSectionId, [number, number]][]) {
    const s = r.sections.find((x) => x.id === id);
    if (!s || s.score < lo || s.score > hi) fail(`section ${id} score ${s?.score} outside ${lo}–${hi}`);
  }
  const all = r.sections.flatMap((s) => s.checks);
  for (const [id, want] of Object.entries(e.checks ?? {})) {
    const got = all.find((c) => c.id === id)?.status;
    if (!statusOk(got, want)) fail(`${id} expected ${Array.isArray(want) ? want.join("|") : want}, got ${got ?? "absent"}`);
  }
}

/** Contract invariants that hold for every result. */
function invariants(r: LinkedInAnalysis, fail: (m: string) => void) {
  const ids = r.sections.map((s) => s.id);
  if (JSON.stringify(ids) !== JSON.stringify(["headline", "about", "experience", "skills", "education", "credentials", "contact"])) fail(`section ids/order: ${ids.join(",")}`);
  const wsum = r.sections.reduce((n, s) => n + s.weight, 0);
  if (wsum !== 100) fail(`section weights sum to ${wsum}`);
  let earned = 0;
  for (const s of r.sections) {
    if (s.weight !== SECTION_WEIGHTS[s.id]) fail(`section ${s.id} weight ${s.weight}`);
    const cw = s.checks.reduce((n, c) => n + c.weight, 0);
    if (cw !== s.weight) fail(`section ${s.id} check weights sum to ${cw}, not ${s.weight}`);
    const e = s.checks.reduce((n, c) => n + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0), 0);
    if (s.score !== Math.round((100 * e) / cw)) fail(`section ${s.id} score ${s.score} != ${Math.round((100 * e) / cw)}`);
    earned += e;
    for (const c of s.checks) {
      if (c.category !== "profile") fail(`${c.id} category ${c.category}`);
      if (!c.id.startsWith(`linkedin.${s.id}.`)) fail(`${c.id} not under linkedin.${s.id}.`);
      if (c.status === "pass" && c.fix) fail(`${c.id} passes but has a fix`);
      if (c.status !== "pass" && !c.fix) fail(`${c.id} is ${c.status} but has no fix`);
      if (/!/.test(c.summary + (c.fix ?? "") + c.title)) fail(`${c.id} text contains an exclamation mark`);
      if (!c.why) fail(`${c.id} has no why`);
    }
  }
  if (r.score !== Math.round(earned)) fail(`overall ${r.score} != round(Σ earned) ${Math.round(earned)}`);
  const allIds = r.sections.flatMap((s) => s.checks.map((c) => c.id));
  if (new Set(allIds).size !== allIds.length) fail("duplicate check ids");
  if (JSON.stringify(JSON.parse(JSON.stringify(r))) !== JSON.stringify(r)) fail("result is not JSON-stable");
}

async function main() {
  const failures: string[] = [];
  const rows: string[][] = [];
  let maxMs = 0;
  for (const [key, e] of Object.entries(EXPECT)) {
    if (filter && !key.includes(filter)) continue;
    const buf = new Uint8Array(readFileSync(join(FIX, e.path)));
    const fail = (m: string) => failures.push(`${key}: ${m}`);
    const t0 = performance.now();
    let r: LinkedInAnalysis;
    try {
      r = await analyzeLinkedIn(buf);
    } catch (err) {
      fail(`threw ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    const ms = performance.now() - t0;
    maxMs = Math.max(maxMs, ms);
    const r2 = await analyzeLinkedIn(new Uint8Array(readFileSync(join(FIX, e.path))));
    if (!isDeepStrictEqual(r, r2)) fail("non-deterministic result (two runs differ)");
    check(r, e, fail);
    invariants(r, fail);
    const sc = (id: LinkedInSectionId) => String(r.sections.find((s) => s.id === id)?.score ?? "-");
    const all = r.sections.flatMap((s) => s.checks);
    rows.push([
      key,
      r.looksLikeLinkedIn ? "yes" : "no",
      String(r.pageCount),
      String(r.score),
      sc("headline"), sc("about"), sc("experience"), sc("skills"), sc("education"), sc("credentials"), sc("contact"),
      `${all.filter((c) => c.status === "pass").length}/${all.filter((c) => c.status === "warn").length}/${all.filter((c) => c.status === "fail").length}`,
      String(r.profile.experience.length),
      String(Math.round(ms)),
    ]);
    if (dump) {
      console.log(`\n===== ${key} =====`);
      console.log("--- rawText ---\n" + r.rawText);
      console.log("--- profile ---\n" + JSON.stringify(r.profile, null, 1));
      for (const s of r.sections) {
        console.log(`## ${s.label} ${s.score}/100 (weight ${s.weight})`);
        for (const c of s.checks)
          console.log(`[${c.status.toUpperCase()}] ${c.id} (${c.weight}) ${c.title}\n    ${c.summary}${c.fix ? `\n    fix: ${c.fix}` : ""}${c.evidence ? `\n    evidence: ${c.evidence.map((x) => `${x.text}${x.where ? ` @ ${x.where}` : ""}`).join(" ‖ ")}` : ""}${c.rewriteTargets ? `\n    rewrite: ${c.rewriteTargets.length}` : ""}`);
      }
    }
  }

  for (const [file, want] of Object.entries(ERRORS)) {
    if (filter && !file.includes(filter)) continue;
    try {
      await analyzeLinkedIn(new Uint8Array(readFileSync(join(FIX, file))));
      failures.push(`${file}: expected UnreadableDocumentError(${want}), got a result`);
    } catch (err) {
      const ok = err instanceof UnreadableDocumentError && err.reason === want;
      if (!ok) failures.push(`${file}: expected ${want}, got ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
      console.log(`${file}: ${err instanceof UnreadableDocumentError ? `UnreadableDocumentError(${err.reason}) “${err.message}”` : String(err)}`);
    }
  }

  const head = ["fixture", "LI?", "pg", "score", "head", "about", "exp", "skill", "edu", "cred", "cont", "p/w/f", "roles", "ms"];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join(" ");
  console.log(line(head));
  console.log(widths.map((w) => "-".repeat(w)).join(" "));
  for (const r of rows) console.log(line(r));
  console.log(`\nslowest analysis: ${Math.round(maxMs)} ms (the first includes loading pdf.js)`);
  if (failures.length) {
    console.log(`\n${failures.length} FAILED:`);
    for (const f of failures) console.log("  ✗ " + f);
    process.exit(1);
  }
  console.log(`\nAll ${rows.length} LinkedIn fixtures passed expectations, determinism and invariants.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
