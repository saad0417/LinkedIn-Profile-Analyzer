// Extraction checks: did the parser get the essentials out of the file?
import type { Check, Evidence, SectionKind } from "@/lib/types";
import { build, type CheckContext, type CheckDef } from "./common";
import { EMAIL_RE, findPhone, joinList, plural, quoteList, truncate, wordCount } from "../text";
import { findDateRanges, formatLabel, type DateFormat, type DateRange } from "../dates";
import { KIND_LABEL } from "../headings";
import { inferSectionKind } from "../profile";
import type { HiddenText } from "../internal";

export const EXTRACTION_DEFS = {
  text: {
    id: "extraction.text",
    category: "extraction",
    title: "Selectable text",
    severity: "high",
    weight: 20,
    why: "An ATS indexes the text layer of your file. If there is none, your application is stored with an empty profile and never comes up in recruiter searches.",
  },
  name: {
    id: "extraction.name",
    category: "extraction",
    title: "Name at the top of the body",
    severity: "medium",
    weight: 10,
    why: "Parsers take the first prominent line of the body as your name. Without it, your profile can be saved as “Unknown” or under a heading.",
  },
  email: {
    id: "extraction.email",
    category: "extraction",
    title: "Email address readable",
    severity: "high",
    weight: 15,
    why: "Recruiters contact you from the parsed profile, not your original file. A missing email often means a missing interview invitation.",
  },
  phone: {
    id: "extraction.phone",
    category: "extraction",
    title: "Phone number readable",
    severity: "medium",
    weight: 8,
    why: "The phone field in the ATS profile is filled from the parsed text. If it is empty, a recruiter has one fewer way to reach you.",
  },
  headings: {
    id: "extraction.headings",
    category: "extraction",
    title: "Standard section headings",
    severity: "high",
    weight: 15,
    why: "Parsers split a CV into sections by matching headings against a fixed list. Content under an unrecognised heading is often dropped or filed in the wrong place.",
  },
  dates: {
    id: "extraction.dates",
    category: "extraction",
    title: "Date ranges for roles",
    severity: "medium",
    weight: 10,
    why: "An ATS calculates your years of experience from date ranges, and recruiters filter on that number.",
  },
  dateFormat: {
    id: "extraction.date-format",
    category: "extraction",
    title: "Consistent date format with months",
    severity: "low",
    weight: 5,
    why: "Parsers handle one consistent format best. Years alone hide up to 11 months at each end of a role, so calculated experience can come out shorter than it is.",
  },
} satisfies Record<string, CheckDef>;

function hiddenWith(hidden: HiddenText[], test: (t: string) => boolean): HiddenText | undefined {
  return hidden.find((h) => test(h.text));
}

const WHERE_LABEL: Record<HiddenText["where"], string> = {
  header: "the page header",
  footer: "the page footer",
  "text box": "a text box",
};
const WHERE_TAG: Record<HiddenText["where"], string> = {
  header: "Page header",
  footer: "Page footer",
  "text box": "Text box",
};

function nameLike(text: string): string | null {
  for (const line of text.split(/\n|\s*\|\s*/)) {
    const t = line.trim();
    const w = t.split(/\s+/);
    if (w.length >= 2 && w.length <= 4 && w.every((x) => /^[\p{Lu}][\p{L}'’.-]*$/u.test(x)) && !/\d|@/.test(t)) return t;
  }
  return null;
}

export function extractionChecks(ctx: CheckContext): Check[] {
  const { doc, build: b, noText } = ctx;
  const p = b.profile;
  const out: Check[] = [];
  const words = wordCount(doc.rawText);

  // Text layer
  if (noText) {
    out.push(
      build(EXTRACTION_DEFS.text, {
        status: "fail",
        summary:
          doc.kind === "pdf"
            ? "We found no selectable text in this file. The pages appear to be images, such as a scan or a photo saved as PDF, so a parser reads nothing at all."
            : "The body of this document contains no text a parser can read. Everything is in text boxes, headers or images.",
        fix:
          doc.kind === "pdf"
            ? "Export the CV as a PDF directly from Word or Google Docs (File › Download › PDF), or upload the .docx. If you only have a scan, retype it into a document."
            : "Move your content out of text boxes, headers and images into ordinary paragraphs in the document body.",
      }),
    );
  } else if (doc.textlessPages.length) {
    const pages = doc.textlessPages;
    out.push(
      build(EXTRACTION_DEFS.text, {
        status: "warn",
        summary: `${pages.length === 1 ? `Page ${pages[0]} has` : `Pages ${joinList(pages.map(String))} have`} no selectable text. Anything on ${pages.length === 1 ? "that page" : "those pages"} is invisible to a parser.`,
        fix: "Re-create the page from your original document instead of inserting a scan or image, then export to PDF again.",
      }),
    );
  } else if (words < 80) {
    out.push(
      build(EXTRACTION_DEFS.text, {
        status: "warn",
        summary: `We could only extract ${plural(words, "word")} of text. Most of your CV may be in images or shapes that a parser cannot read.`,
        fix: "Make sure your content is typed text in the document body, not pictures of text or text inside shapes.",
      }),
    );
  } else {
    out.push(
      build(EXTRACTION_DEFS.text, {
        status: "pass",
        summary: `We extracted ${plural(words, "word")} of selectable text${doc.pageCount ? ` across ${plural(doc.pageCount, "page")}` : ""}.`,
      }),
    );
  }

  // Name
  if (p.name) {
    out.push(build(EXTRACTION_DEFS.name, { status: "pass", summary: `We found your name: “${p.name}”.` }));
  } else {
    const hid = doc.hidden.find((h) => nameLike(h.text));
    out.push(
      build(EXTRACTION_DEFS.name, {
        status: "fail",
        summary: noText
          ? "No name could be read because the file has no extractable text."
          : hid
            ? `Your name appears to be in ${WHERE_LABEL[hid.where]} (“${nameLike(hid.text)}”). Most parsers only read the body, so the name came back empty.`
            : "We could not find your name at the top of the CV. Parsers expect your full name on its own line at the start of the body.",
        fix: "Put your full name on the first line of the document body, on its own, as plain text (not in a header, text box or image).",
        evidence: hid ? [{ text: truncate(hid.text.replace(/\n/g, " · ")), where: WHERE_TAG[hid.where] }] : undefined,
      }),
    );
  }

  // Email
  if (p.email) {
    out.push(build(EXTRACTION_DEFS.email, { status: "pass", summary: `We found your email address: ${p.email}.` }));
  } else {
    const hid = hiddenWith(doc.hidden, (t) => EMAIL_RE.test(t));
    out.push(
      build(EXTRACTION_DEFS.email, {
        status: "fail",
        summary: noText
          ? "No email address could be read because the file has no extractable text."
          : hid
            ? `Your email address is in ${WHERE_LABEL[hid.where]}. Most parsers only read the body, so it came back empty.`
            : "We could not find an email address anywhere in the text a parser can read.",
        fix: hid
          ? `Move your email address out of ${WHERE_LABEL[hid.where]} into the contact line under your name, in the document body.`
          : "Add your email address as plain text in the contact line under your name.",
        evidence: hid ? [{ text: truncate(hid.text.match(EMAIL_RE)?.[0] ?? hid.text), where: WHERE_TAG[hid.where] }] : undefined,
      }),
    );
  }

  // Phone
  if (p.phone) {
    out.push(build(EXTRACTION_DEFS.phone, { status: "pass", summary: `We found your phone number: ${p.phone}.` }));
  } else {
    const hid = hiddenWith(doc.hidden, (t) => !!findPhone(t));
    out.push(
      build(EXTRACTION_DEFS.phone, {
        status: "fail",
        summary: noText
          ? "No phone number could be read because the file has no extractable text."
          : hid
            ? `Your phone number is in ${WHERE_LABEL[hid.where]}. Most parsers only read the body, so it came back empty.`
            : "We could not find a phone number in the text a parser can read.",
        fix: hid
          ? `Move your phone number out of ${WHERE_LABEL[hid.where]} into the contact line in the document body.`
          : "Add a phone number with your country code, for example +44 20 7946 0958, to the contact line under your name.",
        evidence: hid ? [{ text: findPhone(hid.text) ?? truncate(hid.text), where: WHERE_TAG[hid.where] }] : undefined,
      }),
    );
  }

  out.push(headingsCheck(ctx));
  out.push(datesCheck(ctx));
  const fmt = dateFormatCheck(ctx);
  if (fmt) out.push(fmt);
  return out;
}

function headingsCheck(ctx: CheckContext): Check {
  const { build: b, noText } = ctx;
  if (noText) {
    return build(EXTRACTION_DEFS.headings, {
      status: "fail",
      summary: "No headings could be read because the file has no extractable text.",
      fix: "Fix the text layer first (see “Selectable text”).",
    });
  }
  const kinds = new Set(b.sections.map((s) => s.kind).filter((k): k is SectionKind => !!k));
  const required: SectionKind[] = ["experience", "education", "skills"];
  const missing = required.filter((k) => !kinds.has(k));
  const unknown = b.sections.filter((s) => s.kind === null);
  const found = required.filter((k) => kinds.has(k)).map((k) => KIND_LABEL[k]);

  const guesses = unknown.map((s) => ({ s, g: inferSectionKind(s) }));
  const evidence: Evidence[] = guesses.slice(0, 6).map(({ s, g }) => ({
    text: s.heading,
    where: g === "other" ? "Contact details under a heading" : g ? `Looks like your ${KIND_LABEL[g]} section` : "Unrecognised heading",
  }));
  const renamed = guesses.filter((x) => x.g && x.g !== "other");
  const renames = renamed.map((x) => `“${x.s.heading}” to “${KIND_LABEL[x.g!]}”`);
  const contactBlocks = guesses.filter((x) => x.g === "other");

  let status: "pass" | "warn" | "fail";
  if (missing.length === 0 && unknown.length === 0) status = "pass";
  else if (missing.length >= 2 || (missing.includes("experience") && unknown.length > 0)) status = "fail";
  else status = "warn";

  const parts: string[] = [];
  if (found.length) parts.push(`We found standard headings for ${joinList(found)}.`);
  if (missing.length === required.length) parts.push("We found none of the standard headings parsers look for (Experience, Education, Skills).");
  else if (missing.length) parts.push(`We found no ${joinList(missing.map((k) => KIND_LABEL[k]))} heading${missing.length > 1 ? "s" : ""}.`);
  if (unknown.length) parts.push(`${unknown.length === 1 ? "This heading was" : "These headings were"} not recognised: ${quoteList(unknown.map((s) => s.heading))}.`);
  if (status === "pass") parts.splice(0, parts.length, `Your CV uses standard headings for ${joinList(found)}, which parsers recognise.`);

  const fixes: string[] = [];
  if (renames.length) fixes.push(`Rename ${joinList(renames)}.`);
  if (contactBlocks.length) fixes.push(`Put your contact details directly under your name without a heading such as ${quoteList(contactBlocks.map((x) => x.s.heading), 2)}.`);
  const stillMissing = missing.filter((k) => !renamed.some((x) => x.g === k));
  if (stillMissing.length)
    fixes.push(
      `Add ${stillMissing.length === 1 ? "a plain heading" : "plain headings"} for ${joinList(stillMissing.map((k) => `“${KIND_LABEL[k]}”`))}.${stillMissing.includes("experience") ? " If you have no work history yet, list internships, volunteering or projects under “Experience”." : ""}`,
    );
  if (!fixes.length && unknown.length) fixes.push("Replace creative headings with standard ones such as “Summary”, “Experience”, “Education” and “Skills”.");

  return build(EXTRACTION_DEFS.headings, { status, summary: parts.join(" "), fix: fixes.join(" "), evidence });
}

function datesCheck(ctx: CheckContext): Check {
  const { build: b, noText } = ctx;
  if (noText) {
    return build(EXTRACTION_DEFS.dates, {
      status: "fail",
      summary: "No dates could be read because the file has no extractable text.",
      fix: "Fix the text layer first (see “Selectable text”).",
    });
  }
  const ranges = b.ranges;
  if (ranges.length) {
    return build(EXTRACTION_DEFS.dates, {
      status: "pass",
      summary: `We found ${plural(ranges.length, "date range")}, for example “${ranges[0].text}”.`,
    });
  }
  return build(EXTRACTION_DEFS.dates, {
    status: "fail",
    summary: "We found no date ranges, so a parser cannot work out how long you held each role.",
    fix: "Give every role a start and end date on the same line as the job title, for example “03/2021 – Present” or “Mar 2021 – Present”.",
  });
}

function dateFormatCheck(ctx: CheckContext): Check | null {
  const { build: b, noText } = ctx;
  if (noText) return null;
  const roleRanges: DateRange[] = [];
  for (const r of b.profile.experience) if (r.dates) roleRanges.push(...findDateRanges(r.dates).slice(0, 1));
  const ranges = roleRanges.length ? roleRanges : b.ranges;
  if (!ranges.length) return null;

  const examples = new Map<DateFormat, string>();
  let yearsOnly = 0;
  const yearOnlyRanges: string[] = [];
  for (const r of ranges) {
    const ds = [r.start, ...(r.end ? [r.end] : [])];
    for (const d of ds) if (!examples.has(d.format)) examples.set(d.format, d.text);
    if (ds.every((d) => d.format === "year")) {
      yearsOnly++;
      yearOnlyRanges.push(r.text);
    }
  }
  const formats = [...examples.keys()];
  const mixed = formats.length > 1;
  const scope = roleRanges.length ? "roles" : "date ranges";

  if (!mixed && yearsOnly === 0) {
    const f = formats[0];
    return build(EXTRACTION_DEFS.dateFormat, {
      status: "pass",
      summary: `Your ${scope} use one format (${formatLabel(f)}) and include months.`,
    });
  }
  const parts: string[] = [];
  const evidence: Evidence[] = [];
  if (mixed) {
    parts.push(`Your ${scope} mix ${formats.length} date formats: ${quoteList(formats.map((f) => examples.get(f)!))}.`);
    for (const f of formats) evidence.push({ text: examples.get(f)!, where: formatLabel(f) });
  }
  if (yearsOnly) {
    parts.push(
      yearsOnly === ranges.length
        ? `All of your ${scope} use years only, such as “${yearOnlyRanges[0]}”, so a parser cannot tell how many months each one lasted.`
        : `${yearsOnly} of ${plural(ranges.length, scope === "roles" ? "role" : "range")} use${yearsOnly === 1 ? "s" : ""} years only, such as “${yearOnlyRanges[0]}”.`,
    );
    if (!mixed) for (const t of yearOnlyRanges.slice(0, 3)) evidence.push({ text: t, where: "Years only" });
  }
  return build(EXTRACTION_DEFS.dateFormat, {
    status: mixed && yearsOnly && formats.length >= 3 ? "fail" : "warn",
    summary: parts.join(" "),
    fix: "Use one format for every date and include the month, either “MM/YYYY” (03/2021) or “Month YYYY” (Mar 2021).",
    evidence,
  });
}
