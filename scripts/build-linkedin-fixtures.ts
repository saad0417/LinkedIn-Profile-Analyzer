// Generates synthetic LinkedIn "Save to PDF" exports for the LinkedIn analyzer.
//   npx tsx scripts/build-linkedin-fixtures.ts                # all
//   npx tsx scripts/build-linkedin-fixtures.ts li-05          # only files whose name contains "li-05"
//   npx tsx scripts/build-linkedin-fixtures.ts --out .scratch # write everything into another directory
// Writes fixtures/linkedin/*.pdf and public/samples/sample-linkedin.pdf.
//
// The layout mimics LinkedIn's own export: US Letter, a shaded left sidebar
// (~1/3 of the width) with Contact / Top Skills / Languages / Certifications /
// Honors-Awards / Publications, a main column with the name (26pt), headline,
// location, then Summary / Experience / Education (15.75pt headings), company
// (12pt) over title (11.5pt bold) over "Month YYYY - Present (N years M months)",
// location and description, and a centred "Page X of Y" footer. Several roles
// at one company are grouped under the company line plus a total duration.
// All people, companies and URLs are fictional.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "fixtures", "linkedin");
const SAMPLE_OUT = join(ROOT, "public", "samples");

/** The export is "as of" this month, for "(N years M months)" durations. */
const AS_OF = { y: 2026, m: 10 };

/* ---------------- content model ---------------- */

interface LiRole {
  title: string;
  /** [year, month]; month null = year-only dates. */
  start: [number, number | null];
  end: [number, number | null] | "present";
  location?: string;
  description?: string[];
}
interface LiCompany {
  company: string;
  roles: LiRole[];
}
interface LiEdu {
  school: string;
  degree?: string;
  dates?: string;
}
interface LiSpec {
  name: string;
  headline: string;
  location: string;
  contact: string[];
  topSkills: string[];
  languages?: string[];
  certifications?: string[];
  honors?: string[];
  publications?: string[];
  summary?: string[];
  /** Font size of the Summary text (default 10.5, like role descriptions). Real exports with a long About print it at 12pt. */
  summarySize?: number;
  /** Font size of the location line under the headline (default 10.5). */
  locationSize?: number;
  experience: LiCompany[];
  education: LiEdu[];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function months(start: [number, number | null], end: LiRole["end"]): number {
  const [sy, sm] = start;
  const [ey, em] = end === "present" ? [AS_OF.y, AS_OF.m] : end;
  return (ey - sy) * 12 + ((em ?? 12) - (sm ?? 1)) + 1;
}

function durationText(n: number): string {
  const y = Math.floor(n / 12);
  const m = n % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} year${y === 1 ? "" : "s"}`);
  if (m) parts.push(`${m} month${m === 1 ? "" : "s"}`);
  return parts.join(" ") || "1 month";
}

function dateText(d: [number, number | null]): string {
  return d[1] ? `${MONTHS[d[1] - 1]} ${d[0]}` : String(d[0]);
}

function roleDates(r: LiRole): string {
  return `${dateText(r.start)} - ${r.end === "present" ? "Present" : dateText(r.end)} (${durationText(months(r.start, r.end))})`;
}

/* ---------------- layout ---------------- */

const W = 612;
const H = 792;
const TOP = 750;
const BOTTOM = 56;
const SIDE_X = 32;
const SIDE_W = 152;
const SIDE_BG = 205;
const MAIN_X = 228;
const MAIN_W = 350;

const DARK = rgb(0.12, 0.12, 0.12);
const GREY = rgb(0.4, 0.4, 0.4);
const SIDE_HEAD = rgb(0.2, 0.2, 0.2);

interface Fonts {
  reg: PDFFont;
  bold: PDFFont;
}

class Writer {
  pages: PDFPage[] = [];
  side = { page: 0, y: TOP };
  main = { page: 0, y: TOP };

  constructor(
    private doc: PDFDocument,
    private f: Fonts,
  ) {
    this.newPage();
  }

  private newPage() {
    const p = this.doc.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: SIDE_BG, height: H, color: rgb(0.953, 0.949, 0.937) });
    this.pages.push(p);
  }

  private pageFor(col: { page: number; y: number }, need: number) {
    if (col.y - need < BOTTOM) {
      col.page += 1;
      col.y = TOP;
      while (this.pages.length <= col.page) this.newPage();
    }
    return this.pages[col.page];
  }

  /** Word-wrap text to a width; a single word wider than the column (a long URL) breaks mid-word, as in LinkedIn's export. */
  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    // A literal "\n" reproduces a real export's line breaks: the lines are used as given, since
    // LinkedIn's font metrics differ slightly from Helvetica's (a line it fitted may be a hair too wide here).
    if (text.includes("\n")) return text.split("\n");
    const fits = (s: string) => font.widthOfTextAtSize(s, size) <= width;
    const out: string[] = [];
    let cur = "";
    for (const w of text.split(" ")) {
      const next = cur ? `${cur} ${w}` : w;
      if (fits(next)) {
        cur = next;
        continue;
      }
      if (cur) out.push(cur);
      cur = "";
      for (const ch of w) {
        if (cur && !fits(cur + ch)) {
          out.push(cur);
          cur = ch;
        } else cur += ch;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  private put(col: "side" | "main", text: string, size: number, opts: { bold?: boolean; color?: RGB; gap?: number } = {}) {
    const c = this[col];
    const font = opts.bold ? this.f.bold : this.f.reg;
    const x = col === "side" ? SIDE_X : MAIN_X;
    const width = col === "side" ? SIDE_W : MAIN_W;
    const lh = size * 1.28;
    c.y -= opts.gap ?? 0;
    for (const line of this.wrap(text, font, size, width)) {
      const page = this.pageFor(c, lh);
      c.y -= lh;
      page.drawText(line, { x, y: c.y, size, font, color: opts.color ?? DARK });
    }
  }

  sideHeading(t: string) {
    this.put("side", t, 13, { gap: this.side.y === TOP ? 0 : 14, color: SIDE_HEAD });
    this.side.y -= 3;
  }
  sideItem(t: string) {
    this.put("side", t, 10.5, { gap: 2 });
  }
  name(t: string) {
    this.put("main", t, 26, { color: DARK });
    this.main.y -= 2;
  }
  headline(t: string) {
    this.put("main", t, 12, { gap: 4 });
  }
  location(t: string, size = 10.5) {
    this.put("main", t, size, { gap: 4, color: GREY });
  }
  heading(t: string) {
    this.put("main", t, 15.75, { gap: 20 });
    this.main.y -= 4;
  }
  company(t: string, gap = 10) {
    this.put("main", t, 12, { gap });
  }
  title(t: string, gap = 2) {
    this.put("main", t, 11.5, { bold: true, gap });
  }
  meta(t: string) {
    this.put("main", t, 10.5, { gap: 1, color: GREY });
  }
  body(t: string, gap = 4, size = 10.5) {
    this.put("main", t, size, { gap });
  }

  footers() {
    const n = this.pages.length;
    this.pages.forEach((p, i) => {
      const t = `Page ${i + 1} of ${n}`;
      const w = this.f.reg.widthOfTextAtSize(t, 9);
      p.drawText(t, { x: (W - w) / 2, y: 26, size: 9, font: this.f.reg, color: GREY });
    });
  }
}

async function renderLinkedIn(s: LiSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  // Same document-info fingerprint as a real export.
  doc.setTitle("Resume");
  doc.setAuthor("LinkedIn");
  doc.setSubject("Resume generated from profile");
  doc.setProducer("Apache FOP Version 2.2");
  doc.setCreator("");
  const fonts = { reg: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const w = new Writer(doc, fonts);

  // Sidebar.
  w.sideHeading("Contact");
  for (const c of s.contact) w.sideItem(c);
  if (s.topSkills.length) {
    w.sideHeading("Top Skills");
    for (const t of s.topSkills) w.sideItem(t);
  }
  const lists: [string, string[] | undefined][] = [
    ["Languages", s.languages],
    ["Certifications", s.certifications],
    ["Honors-Awards", s.honors],
    ["Publications", s.publications],
  ];
  for (const [h, items] of lists) {
    if (!items?.length) continue;
    w.sideHeading(h);
    for (const t of items) w.sideItem(t);
  }

  // Main column.
  w.name(s.name);
  w.headline(s.headline);
  w.location(s.location, s.locationSize);
  if (s.summary?.length) {
    w.heading("Summary");
    // Bullet lines sit tight under each other; paragraphs get a blank-line gap.
    s.summary.forEach((para, i) => w.body(para, i === 0 ? 0 : /^• /.test(para) && /^• /.test(s.summary![i - 1]) ? 2 : 9, s.summarySize));
  }
  w.heading("Experience");
  s.experience.forEach((co, ci) => {
    w.company(co.company, ci ? 14 : 0);
    if (co.roles.length > 1) {
      const first = co.roles[co.roles.length - 1].start;
      const total = months(first, co.roles[0].end);
      w.meta(durationText(total));
    }
    co.roles.forEach((r, ri) => {
      w.title(r.title, ri ? 10 : 2);
      w.meta(roleDates(r));
      if (r.location) w.meta(r.location);
      (r.description ?? []).forEach((d, i) => w.body(d, i ? 2 : 5));
    });
  });
  if (s.education.length) {
    w.heading("Education");
    s.education.forEach((e, i) => {
      w.company(e.school, i ? 12 : 0);
      const deg = [e.degree, e.dates ? `· (${e.dates})` : null].filter(Boolean).join(" ");
      if (deg) w.meta(deg);
    });
  }
  w.footers();
  return doc.save({ useObjectStreams: false });
}

/* ---------------- profiles ---------------- */

const STRONG: LiSpec = {
  name: "Amara Okonkwo",
  headline: "Senior Product Designer at Brightpath Health | Design Systems, Accessibility (WCAG) & Healthcare UX | Ex-Shopify",
  location: "Toronto, Ontario, Canada",
  contact: ["amara.okonkwo@example.com", "www.linkedin.com/in/amaraokonkwo (LinkedIn)", "amaraokonkwo.design (Portfolio)", "medium.com/@amaradesigns (Blog)"],
  topSkills: ["Design Systems", "Accessibility", "User Research"],
  languages: ["English (Native or Bilingual)", "Yoruba (Professional Working)", "French (Limited Working)"],
  certifications: ["Certified Professional in Accessibility Core Competencies (CPACC)", "Google UX Design Certificate"],
  honors: ["Brightpath Health Design Excellence Award 2024"],
  summary: [
    "I design healthcare products that patients and clinicians can actually use. For the past nine years I have worked across e-commerce and digital health, most recently leading the design system that now powers 14 patient-facing products at Brightpath Health.",
    "What I bring: a research-first process, accessibility built in from the first sketch rather than bolted on, and close partnership with engineering. At Brightpath I cut appointment-booking drop-off by 31% and helped the company pass its first external WCAG 2.2 AA audit.",
    "How I work: I start with the people who will use the product, often older patients and busy clinicians, and test early with real tasks. I write design documentation engineers actually read, and I measure success with outcomes such as completion rates and support volume rather than screens shipped.",
    "• Design systems: Figma libraries, tokens and React components used by 9 teams",
    "• Accessibility: WCAG 2.2 AA audits, screen-reader testing, inclusive research",
    "• Research: 40+ moderated sessions a year, journey mapping, service blueprints",
    "I'm open to conversations about senior and lead design roles in health and public-sector products. Portfolio and case studies: amaraokonkwo.design",
  ],
  experience: [
    {
      company: "Brightpath Health",
      roles: [
        {
          title: "Senior Product Designer",
          start: [2022, 3],
          end: "present",
          location: "Toronto, Ontario, Canada",
          description: [
            "Lead designer for the patient app and the Lumen design system (120+ components, used by 9 product teams).",
            "• Redesigned appointment booking; drop-off fell 31% and support calls about booking fell by a third.",
            "• Ran 40+ usability sessions with patients over 65 and turned findings into a reusable accessibility checklist.",
            "• Partnered with engineering to ship tokens in Figma and React, cutting UI bug reports by 45%.",
          ],
        },
      ],
    },
    {
      company: "Shopify",
      roles: [
        {
          title: "Product Designer",
          start: [2019, 1],
          end: [2022, 2],
          location: "Ottawa, Ontario, Canada",
          description: [
            "Designed merchant onboarding flows for Shopify Payments in 6 markets.",
            "• Simplified identity verification, raising first-week activation from 58% to 71%.",
            "• Built the onboarding pattern library adopted by three other teams.",
          ],
        },
      ],
    },
    {
      company: "Northlake Digital",
      roles: [
        {
          title: "UX Designer",
          start: [2017, 5],
          end: [2018, 12],
          location: "Toronto, Ontario, Canada",
          description: ["Designed web and mobile experiences for retail and banking clients; led research for a credit-union app rated 4.7 in the App Store."],
        },
      ],
    },
    {
      company: "Ryerson University",
      roles: [
        {
          title: "Research Assistant, Human-Computer Interaction Lab",
          start: [2016, 1],
          end: [2017, 4],
          location: "Toronto, Ontario, Canada",
          description: ["Ran remote usability studies for an accessible transit-planning prototype with 24 participants who use screen readers."],
        },
      ],
    },
  ],
  education: [
    { school: "Toronto Metropolitan University", degree: "Master of Digital Media, Human-Computer Interaction", dates: "2015 - 2017" },
    { school: "University of Lagos", degree: "Bachelor of Science - BS, Computer Science", dates: "2009 - 2013" },
  ],
};

const WEAK: LiSpec = {
  name: "Jake Miller",
  headline: "Student at Riverbend Community College",
  location: "Columbus, Ohio, United States",
  contact: ["www.linkedin.com/in/jake-miller-8a7b3c215 (LinkedIn)"],
  topSkills: ["Microsoft Excel"],
  experience: [
    { company: "Kroger", roles: [{ title: "Cashier", start: [2023, 6], end: "present" }] },
    { company: "Columbus Parks and Recreation", roles: [{ title: "Summer Camp Counselor", start: [2022, 6], end: [2022, 8] }] },
  ],
  education: [
    { school: "Riverbend Community College", degree: "Associate of Applied Science - AAS, Business Administration and Management, General", dates: "2024 - 2026" },
    { school: "Westland High School" },
  ],
};

const MULTI: LiSpec = {
  name: "Rahul Venkataraman",
  headline: "Engineering Manager, Payments Platform at Ledgerline",
  location: "Austin, Texas, United States",
  contact: ["5125550187 (Mobile)", "rahul.v@example.com", "www.linkedin.com/in/rahul-venkataraman-engineering-manager (LinkedIn)", "github.com/rahulv-example (Personal)"],
  topSkills: ["Distributed Systems", "Engineering Management", "Go (Programming Language)"],
  languages: ["English (Full Professional)", "Tamil (Native or Bilingual)"],
  certifications: ["AWS Certified Solutions Architect – Associate"],
  summary: [
    "Engineering manager for Ledgerline's payments platform: 11 engineers across two teams responsible for the ledger, payouts and reconciliation services that move $2B a month.",
    "I joined as a backend engineer in 2017 and grew with the company through three roles. I care about calm on-call rotations, clear technical writing and hiring people who are better than me.",
  ],
  experience: [
    {
      company: "Ledgerline",
      roles: [
        {
          title: "Engineering Manager, Payments Platform",
          start: [2023, 1],
          end: "present",
          location: "Austin, Texas, United States",
          description: [
            "Manage 11 engineers across the Ledger and Payouts teams.",
            "- Cut payout failures from 1.8% to 0.3% by funding a reconciliation rewrite.",
            "- Reduced pages per on-call week from 23 to 6 through SLO-based alerting.",
          ],
        },
        {
          title: "Senior Software Engineer",
          start: [2020, 4],
          end: [2022, 12],
          location: "Austin, Texas, United States",
          description: ["Tech lead for the double-entry ledger service in Go; migrated 400M rows from MySQL to PostgreSQL with zero downtime."],
        },
        {
          title: "Software Engineer",
          start: [2017, 8],
          end: [2020, 3],
          location: "Austin, Texas, United States",
          description: ["Built the first payouts API and the Kafka event pipeline that replaced nightly batch jobs."],
        },
      ],
    },
    {
      company: "Infosys",
      roles: [
        {
          title: "Systems Engineer",
          start: [2014, 7],
          end: [2017, 6],
          location: "Bengaluru, Karnataka, India",
          description: ["Developed Java services for a UK retail bank's card-dispute workflow."],
        },
      ],
    },
  ],
  education: [{ school: "Anna University", degree: "Bachelor of Engineering - BE, Computer Science", dates: "2010 - 2014" }],
};

const SENIOR: LiSpec = {
  name: "Katharina Weber",
  headline: "VP Engineering | Scaling mobility & logistics platforms from 20 to 200 engineers | Board advisor",
  location: "Berlin, Berlin, Germany",
  contact: ["k.weber@example.de", "www.linkedin.com/in/katharinaweber (LinkedIn)", "kweber.example.de (Personal)", "spreewald-mobility.example.com (Company)"],
  topSkills: ["Engineering Leadership", "Platform Architecture", "Organizational Design"],
  languages: ["German (Native or Bilingual)", "English (Full Professional)", "Spanish (Elementary)"],
  certifications: ["Certified Scrum Professional", "AWS Certified Solutions Architect – Professional", "ITIL 4 Foundation", "Kubernetes Administrator (CKA)"],
  honors: ["Top 50 Women in Tech Germany 2023", "Spreewald Mobility Leadership Award"],
  publications: ["Scaling Platform Teams Without Losing Speed", "Event-Driven Logistics at City Scale"],
  summary: [
    "I lead engineering organisations through the awkward middle: past product-market fit, before the processes catch up. Over 18 years I have grown teams from 20 to 200 engineers, moved monoliths to platforms without stopping the business, and built leadership benches that outlast me.",
    "At Spreewald Mobility I run a 180-person engineering organisation across Berlin, Lisbon and remote, responsible for the routing, fleet and payments platforms behind 4 million rides a month. We cut infrastructure cost per ride by 38% in two years while doubling deployment frequency.",
    "Before that I spent eight years in logistics software, from senior engineer to Director of Engineering, and two years consulting for public-transport authorities.",
    "I advise two early-stage startups on engineering strategy and speak about platform teams and organisational design. I'm happy to talk about engineering leadership, hiring in Europe, and mentoring new managers.",
  ],
  experience: [
    {
      company: "Spreewald Mobility GmbH",
      roles: [
        {
          title: "VP Engineering",
          start: [2022, 6],
          end: "present",
          location: "Berlin, Germany",
          description: [
            "Lead a 180-person engineering organisation (14 teams, 3 locations) and own the technical strategy for routing, fleet and payments.",
            "• Cut infrastructure cost per ride by 38% through a platform consolidation programme.",
            "• Doubled deployment frequency to 60 releases a day with a paved-road CI/CD platform.",
            "• Built a management bench of 18 engineering managers, 11 of them promoted internally.",
            "• Introduced a career framework adopted company-wide; regretted attrition fell from 14% to 6%.",
          ],
        },
        {
          title: "Director of Engineering",
          start: [2020, 4],
          end: [2022, 5],
          location: "Berlin, Germany",
          description: [
            "Led the routing and dispatch groups (60 engineers) through 3x ride growth.",
            "• Replaced the dispatch monolith with event-driven services on Kafka, cutting dispatch latency from 9 s to 1.2 s.",
            "• Set up the SRE function and an incident review practice; availability rose from 99.5% to 99.95%.",
          ],
        },
      ],
    },
    {
      company: "Havelland Logistics AG",
      roles: [
        {
          title: "Head of Engineering",
          start: [2016, 9],
          end: [2020, 3],
          location: "Potsdam, Germany",
          description: [
            "Ran engineering for the warehouse management suite used by 300 sites across the DACH region.",
            "• Grew the team from 25 to 70 engineers and opened a second office in Leipzig.",
            "• Led the move to a multi-tenant SaaS product, which became 60% of revenue within two years.",
          ],
        },
        {
          title: "Engineering Manager",
          start: [2014, 1],
          end: [2016, 8],
          location: "Potsdam, Germany",
          description: ["Managed two teams building the route-optimisation engine; cut average delivery mileage by 12% for the largest customer."],
        },
        {
          title: "Senior Software Engineer",
          start: [2012, 2],
          end: [2013, 12],
          location: "Potsdam, Germany",
          description: ["Built the real-time vehicle tracking service in Java and PostgreSQL."],
        },
      ],
    },
    {
      company: "Verkehrsplan Beratung",
      roles: [
        {
          title: "Software Consultant",
          start: [2010, 1],
          end: [2012, 1],
          location: "Hamburg, Germany",
          description: [
            "Delivered timetable-planning tools for three regional public-transport authorities.",
            "• Led a team of five on a passenger-information system that went live across 1,200 stops.",
          ],
        },
      ],
    },
    {
      company: "Fraunhofer Institute for Transportation and Infrastructure Systems",
      roles: [
        {
          title: "Research Engineer",
          start: [2007, 10],
          end: [2009, 12],
          location: "Dresden, Germany",
          description: ["Researched traffic-flow simulation; co-authored four peer-reviewed papers on adaptive signal control."],
        },
      ],
    },
    {
      company: "Startup Advisory",
      roles: [
        {
          title: "Board Advisor",
          start: [2021, null],
          end: "present",
          description: ["Advise two seed-stage mobility startups on engineering strategy, hiring and technical due diligence."],
        },
      ],
    },
  ],
  education: [
    { school: "Technische Universität Dresden", degree: "Diplom-Informatikerin, Computer Science", dates: "2001 - 2007" },
    { school: "Universidad Politécnica de Madrid", degree: "Erasmus exchange, Computer Science", dates: "2005 - 2006" },
  ],
};

const SAMPLE: LiSpec = {
  name: "Jordan Ellis",
  headline: "Marketing Coordinator",
  location: "Seattle, Washington, United States",
  contact: ["jordan.ellis@example.com", "www.linkedin.com/in/jordan-ellis-4b21a9173 (LinkedIn)"],
  topSkills: ["Social Media Marketing", "Content Creation", "Canva"],
  languages: ["English (Native or Bilingual)"],
  summary: [
    "I am a hard-working and passionate marketing professional who is a team player with excellent communication skills. I love creating content and helping brands grow.",
  ],
  experience: [
    {
      company: "Cascade Outdoor Co.",
      roles: [
        {
          title: "Marketing Coordinator",
          start: [2022, 2],
          end: "present",
          location: "Seattle, Washington, United States",
          description: [
            "Responsible for social media accounts and the monthly newsletter.",
            "• Helped with the spring product launch campaign.",
            "• Grew Instagram followers from 4,200 to 11,000 in 18 months.",
          ],
        },
      ],
    },
    {
      company: "Pike Street Creative",
      roles: [{ title: "Marketing Intern", start: [2021, 6], end: [2021, 12], location: "Seattle, Washington, United States" }],
    },
  ],
  education: [{ school: "University of Washington", degree: "Bachelor of Arts - BA, Communication", dates: "2017 - 2021" }],
};

/**
 * Regression for a real export's layout (all content invented): a long About
 * printed at 12pt, the same size as company names, so 12pt dominates the main
 * column; company 12pt over title 11.5pt over 10.5pt dates; a company name
 * that wraps onto two lines; a street address as a role location with no
 * description after it; a degree line that wraps mid-date; and "&amp;" printed
 * literally by LinkedIn.
 */
const FOUNDER: LiSpec = {
  name: "Hamza Rashidi",
  headline: "Founder & CEO at Kestrelworks | Software Engineering Student | Building tools for small accounting firms",
  location: "Lahore, Punjab, Pakistan",
  locationSize: 12,
  contact: ["hamza.rashidi@example.com", "www.linkedin.com/in/hamza-rashidi-kestrelworks (LinkedIn)", "github.com/hrashidi-dev (Other)"],
  topSkills: ["Product Development", "Next.js", "Financial Reporting"],
  certifications: ["Foundations of Project Management"],
  summarySize: 12,
  summary: [
    "I'm the Founder &amp; CEO of Kestrelworks, a small software studio building practical tools for accounting and audit firms in Pakistan. I started it after a summer inside a mid-sized audit practice, where I watched talented people lose whole evenings to copying numbers between spreadsheets, chasing clients for documents and rebuilding the same working papers every year.",
    "Kestrelworks turns that pain into software — document request portals, reconciliation helpers and templates that remember last year's work. Alongside the company I'm studying Software Engineering full time, which keeps me close to new ideas and to a pool of classmates who want to ship real products. I care about clear interfaces, honest estimates and small teams that own their work end to end. If you run a practice that still lives in email threads and shared drives, or you are a student who wants to build something useful, I would love to hear from you — my inbox is open.",
  ],
  experience: [
    {
      company: "Kestrelworks",
      roles: [
        {
          title: "Founder &amp; CEO",
          start: [2026, 8],
          end: "present",
          location: "Lahore, Punjab, Pakistan",
          description: [
            "Started a software studio building document-request and reconciliation tools for small accounting firms.",
            "• Shipped the first client portal; piloting it with three local practices.",
            "• Run discovery interviews with partners and audit staff to choose what we build next.",
            "• Handle sales, onboarding and support for pilot firms.",
          ],
        },
      ],
    },
    {
      company: "Hartley Whitcombe Okafor Lindqvist & Partners LLP (a member firm of the Meridian Accounting Network)",
      roles: [{ title: "Summer Intern, Audit and Assurance", start: [2025, 6], end: [2025, 8], location: "48, Block C-2 Phase 3 Garden Town, Lahore, Pakistan" }],
    },
  ],
  // The "\n" reproduces LinkedIn's wrap inside the date range ("September" / "2028)").
  education: [{ school: "Ravi Valley Institute of Technology", degree: "Bachelor of Science, Software Engineering", dates: "September 2024 - September\n2028" }],
};

async function main() {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out");
  const outDir = outAt >= 0 ? resolve(args[outAt + 1]) : null;
  const filter = args.find((a, i) => !a.startsWith("--") && (outAt < 0 || i !== outAt + 1)) ?? null;
  const out: [string, string, LiSpec][] = [
    [OUT, "li-01-strong.pdf", STRONG],
    [OUT, "li-02-weak.pdf", WEAK],
    [OUT, "li-03-multi-role.pdf", MULTI],
    [OUT, "li-04-senior-3-page.pdf", SENIOR],
    [OUT, "li-05-founder-long-about.pdf", FOUNDER],
    [SAMPLE_OUT, "sample-linkedin.pdf", SAMPLE],
  ];
  for (const [dir, file, spec] of out) {
    if (filter && !file.includes(filter)) continue;
    const target = join(outDir ?? dir, file);
    mkdirSync(outDir ?? dir, { recursive: true });
    writeFileSync(target, await renderLinkedIn(spec));
    console.log(`wrote ${relative(ROOT, target)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
