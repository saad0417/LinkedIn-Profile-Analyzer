// Generates the synthetic CV corpus under fixtures/ and the public sample CV.
//   npx tsx scripts/build-fixtures.ts
// DOCX files are written as raw OOXML; PDFs are produced from DOCX with
// LibreOffice (soffice --headless) and, for a few cases, post-processed with
// pdf-lib (image-only scan, renamed fonts). All people and companies are fictional.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { PDFDocument, PDFName, PDFDict, PDFString } from "pdf-lib";
import { buildDocx, p, h, b, type Block, type DocSpec, type Para, type Run } from "./fixtures/ooxml";
import { skillBar, icon, headshot } from "./fixtures/png";
import { renderResume, sampleFor } from "../src/lib/export";
import type { TemplateId } from "../src/lib/types";

const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "fixtures");
const SAMPLE_OUT = join(ROOT, "public", "samples");
const SCRATCH = process.env.FIXTURE_SCRATCH ?? join(tmpdir(), "parsewise-fixtures");

/* ---------------- content helpers ---------------- */

interface Role {
  title: string;
  company: string;
  location?: string;
  dates: string;
  bullets: string[];
}

type RoleStyle = "tab" | "stacked" | "pipe" | "table" | "company-first";

function roleBlocks(r: Role, style: RoleStyle, width = 9900): Block[] {
  const out: Block[] = [];
  switch (style) {
    case "tab":
      out.push(p([{ text: `${r.title}, ${r.company}`, bold: true }, { text: `\t${r.dates}` }], { rightTab: true, before: 120, after: 40 }));
      if (r.location) out.push(p([{ text: r.location, italic: true }], { after: 40 }));
      break;
    case "stacked":
      out.push(p([{ text: r.title, bold: true }], { before: 120, after: 20 }));
      out.push(p([r.company, r.location, r.dates].filter(Boolean).join(" | "), { after: 40 }));
      break;
    case "pipe":
      out.push(p([{ text: `${r.title} | ${r.company} | ${r.dates}`, bold: true }], { before: 120, after: 40 }));
      break;
    case "company-first":
      out.push(p([{ text: `${r.company}${r.location ? ", " + r.location : ""}`, bold: true }, { text: `\t${r.dates}` }], { rightTab: true, before: 120, after: 20 }));
      out.push(p([{ text: r.title, italic: true }], { after: 40 }));
      break;
    case "table":
      out.push({
        type: "table",
        widths: [Math.round(width * 0.68), Math.round(width * 0.32)],
        rows: [
          [
            [p([{ text: r.title, bold: true }], { after: 0 }), p(r.company + (r.location ? `, ${r.location}` : ""), { after: 0 })],
            [p(r.dates, { align: "right", after: 0 })],
          ],
        ],
      });
      break;
  }
  for (const x of r.bullets) out.push(b(x));
  return out;
}

const contactLine = (...parts: string[]) => p(parts.join("  |  "), { align: "center", after: 160 });
const nameLine = (name: string, font?: string) => p([{ text: name, bold: true, size: 22, font }], { align: "center", after: 40 });
const skillsPara = (s: string) => p(s, { after: 60 });

/* ---------------- fixtures ---------------- */

interface Fixture {
  file: string; // base name without extension
  spec: DocSpec;
  /** Which outputs to produce. */
  outputs: ("docx" | "pdf")[];
  post?: "image-only" | "rename-fonts";
  dest?: string;
}

const fixtures: Fixture[] = [];

// 01 Clean single-column DOCX, US software engineer.
fixtures.push({
  file: "01-clean-software-us",
  outputs: ["docx"],
  spec: {
    font: "Arial",
    size: 10.5,
    body: [
      nameLine("Daniel Okafor"),
      contactLine("Austin, TX", "(512) 555-0142", "daniel.okafor@example.com", "linkedin.com/in/danielokafor", "github.com/dokafor"),
      h("Professional Summary"),
      p("Backend engineer with 7 years of experience building payment and logistics platforms in Go and Python. Led a team of 5 engineers and cut infrastructure spend by 28% through service consolidation."),
      h("Experience"),
      ...roleBlocks(
        {
          title: "Senior Software Engineer",
          company: "Northwind Payments",
          location: "Austin, TX",
          dates: "Mar 2021 – Present",
          bullets: [
            "Designed a ledger service in Go processing 4.2 million transactions per day with 99.98% availability.",
            "Reduced p95 API latency from 480 ms to 120 ms by introducing read replicas and request coalescing.",
            "Mentored 4 engineers through promotion cycles; 3 were promoted within 18 months.",
            "Migrated 35 services from EC2 to Kubernetes (EKS), lowering monthly compute cost by $41,000.",
          ],
        },
        "tab",
      ),
      ...roleBlocks(
        {
          title: "Software Engineer",
          company: "Bluebonnet Logistics",
          location: "Dallas, TX",
          dates: "Jun 2018 – Feb 2021",
          bullets: [
            "Built a route-optimisation API in Python that saved drivers an average of 22 minutes per shift.",
            "Introduced contract testing across 12 services, cutting integration incidents by 40%.",
            "Automated nightly data exports to Snowflake, replacing 6 hours of manual work each week.",
          ],
        },
        "tab",
      ),
      ...roleBlocks(
        {
          title: "Junior Developer",
          company: "Lone Star Web Studio",
          location: "Austin, TX",
          dates: "Jul 2016 – May 2018",
          bullets: [
            "Shipped 20+ client websites using React and Node.js with an average Lighthouse score of 94.",
            "Wrote a reusable checkout component adopted by 9 client projects.",
          ],
        },
        "tab",
      ),
      h("Education"),
      p([{ text: "B.S. Computer Science, University of Texas at Austin", bold: true }, { text: "\t2012 – 2016" }], { rightTab: true }),
      h("Skills"),
      skillsPara("Go, Python, PostgreSQL, Kafka, Kubernetes, Terraform, AWS, gRPC, Redis, React, CI/CD, Docker"),
      h("Certifications"),
      b("AWS Certified Solutions Architect – Associate (2022)"),
      b("Certified Kubernetes Administrator (CKA) (2021)"),
    ],
  },
});

// 02 Clean single-column PDF, UK accountant, stacked roles, Month YYYY dates.
fixtures.push({
  file: "02-clean-accountant-uk",
  outputs: ["pdf"],
  spec: {
    font: "Times New Roman",
    size: 11,
    body: [
      nameLine("Charlotte Hughes"),
      contactLine("Manchester, UK", "+44 161 496 0732", "charlotte.hughes@example.co.uk", "linkedin.com/in/charlottehughes-aca"),
      h("Profile"),
      p("ACA-qualified accountant with 6 years in audit and financial reporting across manufacturing and retail. Managed month-end close for a £240m group with 14 entities and shortened the close from 9 to 5 working days."),
      h("Professional Experience"),
      ...roleBlocks(
        {
          title: "Financial Reporting Manager",
          company: "Pennine Retail Group plc",
          location: "Manchester",
          dates: "September 2021 – Present",
          bullets: [
            "Lead a team of 4 producing consolidated IFRS accounts for 14 subsidiaries with revenue of £240m.",
            "Shortened month-end close from 9 to 5 working days by standardising reconciliations in BlackLine.",
            "Prepared board packs and variance analysis that identified £1.3m of recurring cost savings.",
          ],
        },
        "stacked",
      ),
      ...roleBlocks(
        {
          title: "Audit Senior",
          company: "Holloway & Pratt LLP",
          location: "Leeds",
          dates: "September 2017 – August 2021",
          bullets: [
            "Ran fieldwork for 18 audit clients with turnover between £5m and £150m.",
            "Trained 11 graduate trainees on audit methodology and the firm's sampling tool.",
            "Identified a £430k revenue recognition error before sign-off, avoiding a prior-year restatement.",
          ],
        },
        "stacked",
      ),
      h("Education"),
      p([{ text: "University of Leeds", bold: true }], { after: 20 }),
      p("BSc Accounting and Finance, First Class Honours | September 2014 – June 2017"),
      h("Certifications"),
      b("ACA, Institute of Chartered Accountants in England and Wales (2020)"),
      h("Skills"),
      skillsPara("IFRS, UK GAAP, Consolidations, BlackLine, SAP S/4HANA, Excel (Power Query, VBA), Power BI, Variance Analysis"),
    ],
  },
});

// 03 Single-column PDF with right-aligned dates on the title line (must NOT be multi-column).
fixtures.push({
  file: "03-right-aligned-dates-in",
  outputs: ["pdf"],
  spec: {
    font: "Calibri",
    size: 10.5,
    body: [
      nameLine("Priya Raghunathan"),
      contactLine("Bengaluru, India", "+91 98450 12345", "priya.r@example.in", "linkedin.com/in/priyaraghunathan"),
      h("Summary"),
      p("Data analyst with 5 years of experience in e-commerce analytics, experimentation and forecasting. Built the demand forecast that now drives purchasing for 3,000 SKUs."),
      h("Work Experience"),
      ...roleBlocks(
        {
          title: "Senior Data Analyst",
          company: "Kirana Mart Online",
          dates: "04/2022 – Present",
          bullets: [
            "Built a weekly demand forecast in Python (Prophet) for 3,000 SKUs, reducing stock-outs by 18%.",
            "Designed and analysed 40+ A/B tests on checkout flows, adding an estimated ₹2.1 crore in annual revenue.",
            "Created Tableau dashboards used daily by 60 category managers.",
          ],
        },
        "tab",
      ),
      ...roleBlocks(
        {
          title: "Data Analyst",
          company: "Saffron Travel Technologies",
          dates: "07/2019 – 03/2022",
          bullets: [
            "Wrote SQL pipelines in BigQuery that consolidated 7 booking sources into one reporting layer.",
            "Cut weekly reporting effort by 12 hours by automating Excel reports with Python and Airflow.",
            "Segmented 1.4 million customers using k-means clustering to target loyalty campaigns.",
          ],
        },
        "tab",
      ),
      ...roleBlocks(
        {
          title: "Business Analyst Intern",
          company: "Deccan Fintech Labs",
          dates: "01/2019 – 06/2019",
          bullets: ["Documented 25 loan-origination processes and mapped them to system requirements."],
        },
        "tab",
      ),
      h("Education"),
      p([{ text: "B.Tech, Information Technology — PES University, Bengaluru", bold: true }, { text: "\t2015 – 2019" }], { rightTab: true }),
      h("Technical Skills"),
      skillsPara("SQL | Python | pandas | BigQuery | Tableau | Airflow | A/B Testing | Forecasting | Statistics | Excel"),
    ],
  },
});

// Sidebar CV used by 04 (PDF) and 05 (DOCX).
function sidebarCv(): Block[] {
  const side: Block[] = [
    p([{ text: "CONTACT", bold: true, color: "FFFFFF" }], { after: 60 }),
    p([{ text: "+61 2 9876 5432", color: "FFFFFF" }], { after: 20 }),
    p([{ text: "mia.t@example.com.au", color: "FFFFFF" }], { after: 20 }),
    p([{ text: "Sydney, NSW", color: "FFFFFF" }], { after: 20 }),
    p([{ text: "linkedin.com/in/miathompson", color: "FFFFFF" }], { after: 200 }),
    p([{ text: "SKILLS", bold: true, color: "FFFFFF" }], { after: 60 }),
    ...["Brand Strategy", "Google Analytics 4", "HubSpot", "SEO / SEM", "Content Marketing", "Paid Social", "Market Research", "Budget Management"].map((s) =>
      p([{ text: s, color: "FFFFFF" }], { after: 20 }),
    ),
    p([{ text: "LANGUAGES", bold: true, color: "FFFFFF" }], { before: 200, after: 60 }),
    p([{ text: "English (native)", color: "FFFFFF" }], { after: 20 }),
    p([{ text: "Japanese (conversational)", color: "FFFFFF" }], { after: 20 }),
  ];
  const main: Block[] = [
    p([{ text: "Mia Thompson", bold: true, size: 24 }], { after: 20 }),
    p([{ text: "Marketing Manager", size: 13, color: "555555" }], { after: 200 }),
    h("Profile", { before: 0 }),
    p("Marketing manager with 8 years across consumer brands and B2B software. Grew inbound pipeline by 65% in two years at a Series B SaaS company."),
    h("Experience"),
    ...roleBlocks(
      {
        title: "Marketing Manager",
        company: "Harbourline Software",
        location: "Sydney",
        dates: "Feb 2020 – Present",
        bullets: [
          "Grew marketing-sourced pipeline from A$4.1m to A$6.8m in 24 months.",
          "Managed an annual budget of A$1.2m across paid search, paid social and events.",
          "Launched a content programme producing 48 long-form articles a year.",
        ],
      },
      "stacked",
    ),
    ...roleBlocks(
      {
        title: "Senior Marketing Executive",
        company: "Wattle & Co. Consumer Goods",
        location: "Melbourne",
        dates: "Jan 2016 – Jan 2020",
        bullets: ["Ran 14 product launches with retail partners including national supermarket chains.", "Increased email open rates from 17% to 29% through segmentation."],
      },
      "stacked",
    ),
    h("Education"),
    p("Bachelor of Commerce (Marketing), University of Sydney | 2011 – 2014"),
  ];
  return [{ type: "table", widths: [3100, 6800], shading: ["2E4057", null], rows: [[side, main]] }];
}

fixtures.push({ file: "04-sidebar-two-column-au", outputs: ["pdf"], spec: { font: "Arial", size: 10, body: sidebarCv() } });
fixtures.push({ file: "05-sidebar-two-column-au", outputs: ["docx"], spec: { font: "Arial", size: 10, body: sidebarCv() } });

// 06 Newspaper columns section in DOCX (w:cols num=2).
fixtures.push({
  file: "06-newspaper-columns",
  outputs: ["docx"],
  spec: {
    font: "Calibri",
    size: 10.5,
    cols: 2,
    body: [
      p([{ text: "Tomasz Nowak", bold: true, size: 20 }], { after: 20 }),
      p("Warsaw, Poland | +48 512 345 678 | tomasz.nowak@example.pl", { after: 160 }),
      h("Summary"),
      p("Project manager delivering ERP and warehouse automation programmes for 9 years, with budgets up to €6m."),
      h("Experience"),
      ...roleBlocks(
        {
          title: "Senior Project Manager",
          company: "Vistula Automation",
          dates: "May 2019 – Present",
          bullets: ["Delivered a €6m warehouse automation programme 3 weeks ahead of schedule.", "Ran steering committees with 8 executive stakeholders."],
        },
        "stacked",
      ),
      ...roleBlocks(
        {
          title: "Project Manager",
          company: "Baltic ERP Consulting",
          dates: "Sep 2015 – Apr 2019",
          bullets: ["Implemented SAP ERP for 6 mid-size manufacturers.", "Kept 90% of projects within a 5% budget tolerance."],
        },
        "stacked",
      ),
      h("Education"),
      p("MSc Management, Warsaw School of Economics | 2013 – 2015"),
      h("Skills"),
      skillsPara("PRINCE2, Agile, SAP, MS Project, Jira, Risk Management, Stakeholder Management"),
      h("Certifications"),
      b("PMP – Project Management Professional (2018)"),
    ],
  },
});

// 07 Borderless layout tables for role/date alignment, UAE.
fixtures.push({
  file: "07-borderless-table-dates-ae",
  outputs: ["docx"],
  spec: {
    font: "Calibri",
    size: 10.5,
    body: [
      nameLine("Omar Al-Mansouri"),
      contactLine("Dubai, UAE", "+971 50 123 4567", "omar.almansouri@example.ae", "linkedin.com/in/omaralmansouri"),
      h("Summary"),
      p("Operations manager with 10 years in hospitality and facilities, overseeing teams of up to 120 staff across 3 properties."),
      h("Experience"),
      ...roleBlocks(
        {
          title: "Operations Manager",
          company: "Gulf Crest Hotels",
          location: "Dubai",
          dates: "Jan 2019 – Present",
          bullets: ["Oversee 120 staff across 3 properties with combined revenue of AED 85m.", "Raised guest satisfaction scores from 8.1 to 9.0 within 18 months."],
        },
        "table",
      ),
      ...roleBlocks(
        {
          title: "Assistant Operations Manager",
          company: "Palm Coast Resorts",
          location: "Abu Dhabi",
          dates: "Mar 2015 – Dec 2018",
          bullets: ["Cut energy costs by 14% through a building management system upgrade.", "Coordinated 2 major refurbishments without closing guest floors."],
        },
        "table",
      ),
      h("Education"),
      p("BBA Hospitality Management, Emirates Academy | 2010 – 2014"),
      h("Skills"),
      skillsPara("Operations Management, Budgeting, Opera PMS, Vendor Management, Health & Safety, Team Leadership"),
    ],
  },
});

// 08 Contacts in the page header (DOCX).
fixtures.push({
  file: "08-header-contacts-us",
  outputs: ["docx"],
  spec: {
    font: "Calibri",
    size: 11,
    header: [p([{ text: "Rachel Kim", bold: true, size: 18 }], { align: "center", after: 0 }), p("Chicago, IL  |  (312) 555-0187  |  rachel.kim@example.com", { align: "center" })],
    footer: [p("Rachel Kim – Page 1", { align: "center" })],
    body: [
      h("Summary"),
      p("HR generalist with 6 years supporting 400-person workforces in healthcare and technology, specialising in onboarding and employee relations."),
      h("Experience"),
      ...roleBlocks(
        {
          title: "HR Generalist",
          company: "Lakeshore Health Partners",
          dates: "Aug 2020 – Present",
          bullets: ["Redesigned onboarding for 400 employees, reducing 90-day attrition from 21% to 12%.", "Resolved 85 employee relations cases a year with zero escalations to litigation."],
        },
        "tab",
      ),
      ...roleBlocks(
        {
          title: "HR Coordinator",
          company: "Midway Technologies",
          dates: "Jun 2017 – Jul 2020",
          bullets: ["Coordinated hiring for 140 roles a year using Greenhouse.", "Built a benefits FAQ that cut HR ticket volume by 30%."],
        },
        "tab",
      ),
      h("Education"),
      p("B.A. Psychology, Loyola University Chicago | 2013 – 2017"),
      h("Skills"),
      skillsPara("Workday, Greenhouse, Employee Relations, Onboarding, FMLA, Benefits Administration, HR Policy"),
      h("Certifications"),
      b("SHRM Certified Professional (SHRM-CP), 2019"),
    ],
  },
});

// 09 Text boxes holding contact details and summary.
fixtures.push({
  file: "09-text-boxes",
  outputs: ["docx"],
  spec: {
    font: "Arial",
    size: 10,
    body: [
      {
        type: "textbox",
        widthPt: 480,
        heightPt: 70,
        content: [
          p([{ text: "Lucía Fernández", bold: true, size: 20 }], { after: 20 }),
          p("Graphic Designer | Madrid, Spain | +34 612 345 678 | lucia.fernandez@example.es | behance.net/luciafernandez"),
        ],
      },
      {
        type: "textbox",
        widthPt: 480,
        heightPt: 60,
        content: [p("Brand and packaging designer with 7 years of agency experience for food, beauty and hospitality clients across Spain and Portugal.")],
      },
      h("Experience"),
      ...roleBlocks(
        {
          title: "Senior Graphic Designer",
          company: "Estudio Mirador",
          dates: "Oct 2020 – Present",
          bullets: ["Led packaging redesign for a 40-product olive oil range, lifting retail sell-through by 22%.", "Art-directed 15 photo shoots and managed 3 junior designers."],
        },
        "stacked",
      ),
      ...roleBlocks(
        {
          title: "Graphic Designer",
          company: "Agencia Alba",
          dates: "Sep 2017 – Sep 2020",
          bullets: ["Produced brand identities for 30 restaurants and boutique hotels.", "Prepared print-ready artwork for runs of up to 500,000 units."],
        },
        "stacked",
      ),
      h("Education"),
      p("Grado en Diseño, Universidad Complutense de Madrid | 2013 – 2017"),
      h("Skills"),
      skillsPara("Adobe Illustrator, Photoshop, InDesign, Figma, Packaging Design, Typography, Brand Identity"),
    ],
  },
});

// 10 Creative headings.
fixtures.push({
  file: "10-creative-headings",
  outputs: ["docx"],
  spec: {
    font: "Georgia",
    size: 10.5,
    body: [
      nameLine("Hannah Becker"),
      contactLine("Portland, OR", "503-555-0164", "hannah.becker@example.com", "linkedin.com/in/hannahbecker"),
      h("Hello, I'm Hannah"),
      p("Content designer turning complex financial products into plain language. Previously a journalist for 4 years."),
      h("Where I've Been"),
      ...roleBlocks(
        {
          title: "Senior Content Designer",
          company: "Evergreen Credit Union",
          dates: "May 2021 – Present",
          bullets: ["Rewrote 120 help articles, cutting support contacts about fees by 35%.", "Created a content style guide adopted by 6 product teams."],
        },
        "tab",
      ),
      ...roleBlocks(
        {
          title: "UX Writer",
          company: "Cascade Mobile",
          dates: "Feb 2019 – Apr 2021",
          bullets: ["Wrote onboarding copy for an app with 900,000 monthly users.", "Ran 24 copy tests; the winning sign-up flow raised conversion by 11%."],
        },
        "tab",
      ),
      h("My Journey"),
      p("B.A. Journalism, University of Oregon | 2011 – 2015"),
      h("What I Bring"),
      skillsPara("Content Strategy, UX Writing, Figma, Plain Language, Content Testing, Information Architecture"),
      h("Things I Love"),
      p("Trail running, letterpress printing, community radio."),
    ],
  },
});

// 11 Decorative fonts in DOCX.
fixtures.push({
  file: "11-montserrat-poppins",
  outputs: ["docx"],
  spec: {
    font: "Montserrat",
    headingFont: "Poppins",
    size: 10,
    body: [
      nameLine("Kwame Mensah", "Poppins"),
      contactLine("Accra, Ghana", "+233 24 123 4567", "kwame.mensah@example.com", "linkedin.com/in/kwamemensah"),
      h("Summary"),
      p("Sales lead with 6 years in B2B telecoms, consistently above 110% of quota."),
      h("Experience"),
      ...roleBlocks(
        {
          title: "Enterprise Sales Lead",
          company: "Volta Telecom",
          dates: "Jan 2021 – Present",
          bullets: ["Closed GH₵ 14m in new contracts in 2023, 118% of quota.", "Built a partner channel that sources 30% of pipeline."],
        },
        "tab",
      ),
      ...roleBlocks(
        {
          title: "Account Executive",
          company: "Coastline Networks",
          dates: "Mar 2018 – Dec 2020",
          bullets: ["Managed 45 SME accounts with 96% renewal rate.", "Ranked first of 12 executives for new logos in 2019."],
        },
        "tab",
      ),
      h("Education"),
      p("BSc Business Administration, University of Ghana | 2013 – 2017"),
      h("Skills"),
      skillsPara("B2B Sales, Salesforce, Negotiation, Account Management, Pipeline Management, Forecasting"),
    ],
  },
});

// 12 Decorative fonts in a PDF (fonts renamed after export because they are not installed here).
fixtures.push({
  file: "12-montserrat-pdf",
  outputs: ["pdf"],
  post: "rename-fonts",
  spec: {
    font: "Liberation Sans",
    size: 10,
    body: [
      nameLine("Sofia Rossi"),
      contactLine("Milan, Italy", "+39 02 1234 5678", "sofia.rossi@example.it", "linkedin.com/in/sofiarossi"),
      h("Summary"),
      p("Supply chain planner with 5 years in fashion retail, managing replenishment for 70 stores."),
      h("Experience"),
      ...roleBlocks(
        {
          title: "Supply Chain Planner",
          company: "Moda Lombarda S.p.A.",
          dates: "Jun 2020 – Present",
          bullets: ["Plan replenishment for 70 stores, holding availability above 97%.", "Reduced excess seasonal stock by €2.4m through markdown planning."],
        },
        "tab",
      ),
      ...roleBlocks(
        {
          title: "Inventory Analyst",
          company: "Tessile Nord",
          dates: "Sep 2018 – May 2020",
          bullets: ["Built an SAP inventory report that cut cycle-count variance by 25%."],
        },
        "tab",
      ),
      h("Education"),
      p("Laurea Magistrale, Management Engineering, Politecnico di Milano | 2016 – 2018"),
      h("Skills"),
      skillsPara("SAP APO, Demand Planning, Excel, Power BI, S&OP, Inventory Optimisation"),
    ],
  },
});

// 13 Years-only dates, Canadian nurse.
fixtures.push({
  file: "13-years-only-nurse-ca",
  outputs: ["pdf"],
  spec: {
    font: "Arial",
    size: 10.5,
    body: [
      nameLine("Emily Tremblay"),
      contactLine("Toronto, ON", "(416) 555-0199", "emily.tremblay@example.ca"),
      h("Summary"),
      p("Registered nurse with 8 years in emergency and critical care, trained in triage and trauma nursing."),
      h("Experience"),
      ...roleBlocks(
        {
          title: "Registered Nurse, Emergency Department",
          company: "Lakeview General Hospital",
          dates: "2019 – Present",
          bullets: ["Triage up to 60 patients per shift in a level I trauma centre.", "Precept 2 new graduate nurses per year.", "Led a sepsis screening audit that raised protocol compliance from 72% to 91%."],
        },
        "tab",
      ),
      ...roleBlocks(
        {
          title: "Registered Nurse, ICU",
          company: "St. Brigid's Health Centre",
          dates: "2016 – 2019",
          bullets: ["Cared for ventilated patients in a 24-bed intensive care unit.", "Served on the falls prevention committee."],
        },
        "tab",
      ),
      h("Education"),
      p("Bachelor of Science in Nursing, Toronto Metropolitan University | 2012 – 2016"),
      h("Licenses & Certifications"),
      b("Registered Nurse, College of Nurses of Ontario"),
      b("ACLS, PALS, TNCC"),
      h("Skills"),
      skillsPara("Triage, Patient Assessment, Epic, Critical Care, IV Therapy, Wound Care"),
    ],
  },
});

// 14 Mixed date formats, sales.
fixtures.push({
  file: "14-mixed-dates",
  outputs: ["docx"],
  spec: {
    font: "Calibri",
    size: 11,
    body: [
      nameLine("Marcus Johnson"),
      contactLine("Atlanta, GA", "404.555.0123", "marcus.johnson@example.com", "linkedin.com/in/marcusjohnson"),
      h("Summary"),
      p("Account executive with 7 years in SaaS sales; President's Club 2021 and 2023."),
      h("Experience"),
      ...roleBlocks(
        {
          title: "Account Executive",
          company: "Peachtree Cloud",
          dates: "January 2021 – Present",
          bullets: ["Closed $2.3m ARR in 2023, 131% of quota.", "Shortened average sales cycle from 74 to 51 days."],
        },
        "pipe",
      ),
      ...roleBlocks(
        {
          title: "Sales Development Representative",
          company: "Magnolia Software",
          dates: "03/2018 - 12/2020",
          bullets: ["Booked 310 qualified meetings in 2019, top of a team of 15.", "Built outbound sequences in Outreach with a 14% reply rate."],
        },
        "pipe",
      ),
      ...roleBlocks(
        {
          title: "Retail Sales Associate",
          company: "Southern Outfitters",
          dates: "2016 – 2018",
          bullets: ["Exceeded monthly sales targets in 20 of 24 months."],
        },
        "pipe",
      ),
      h("Education"),
      p("B.B.A. Marketing, Georgia State University, 2016"),
      h("Skills"),
      skillsPara("Salesforce, Outreach, Gong, MEDDIC, Negotiation, Prospecting, Forecasting"),
    ],
  },
});

// 15 Image-only scan (built from 02's content, rasterised).
fixtures.push({
  file: "15-image-only-scan",
  outputs: ["pdf"],
  post: "image-only",
  spec: fixtures[1].spec,
});

// Skill-bar CV used by 16 (PDF) and 17 (DOCX).
function skillBarCv(): Block[] {
  const bars: [string, number][] = [
    ["JavaScript", 0.9],
    ["TypeScript", 0.8],
    ["React", 0.85],
    ["Node.js", 0.7],
    ["CSS", 0.75],
    ["Figma", 0.5],
  ];
  return [
    { type: "images", images: [{ png: headshot(), widthPt: 70, heightPt: 70 }] },
    nameLine("Arjun Mehta"),
    { type: "images", label: [{ text: "Front-end Developer  " }], images: [icon(37, 99, 235), icon(16, 185, 129), icon(234, 88, 12), icon(147, 51, 234)].map((x) => ({ png: x, widthPt: 12, heightPt: 12 })) },
    contactLine("Pune, India", "+91 20 2345 6789", "arjun.mehta@example.in", "linkedin.com/in/arjunmehta", "arjunmehta.dev"),
    h("Summary"),
    p("Front-end developer with 4 years building design systems and accessible web apps."),
    h("Experience"),
    ...roleBlocks(
      {
        title: "Front-end Developer",
        company: "Sahyadri Digital",
        dates: "Aug 2021 – Present",
        bullets: ["Built a React component library used by 7 product teams.", "Raised accessibility audit scores from 68 to 97 across the customer portal."],
      },
      "tab",
    ),
    ...roleBlocks(
      {
        title: "Junior Web Developer",
        company: "Indigo Pixel Labs",
        dates: "Jul 2019 – Jul 2021",
        bullets: ["Converted 30 Figma designs into responsive pages.", "Cut bundle size by 40% with code splitting."],
      },
      "tab",
    ),
    h("Education"),
    p("B.E. Computer Engineering, Savitribai Phule Pune University | 2015 – 2019"),
    h("Skills"),
    ...bars.map(([name, f]): Block => ({ type: "images", label: [{ text: name }], rightTab: true, images: [{ png: skillBar(f), widthPt: 110, heightPt: 9 }] })),
  ];
}

fixtures.push({ file: "16-skill-bars", outputs: ["pdf"], spec: { font: "Arial", size: 10.5, body: skillBarCv() } });
fixtures.push({ file: "17-skill-bars", outputs: ["docx"], spec: { font: "Arial", size: 10.5, body: skillBarCv() } });

// 18 First-person, weak openers, unquantified bullets.
fixtures.push({
  file: "18-pronouns-weak-openers",
  outputs: ["docx"],
  spec: {
    font: "Calibri",
    size: 11,
    body: [
      nameLine("Jessica Moore"),
      contactLine("Phoenix, AZ", "602-555-0110", "jessica.moore@example.com"),
      h("Objective"),
      p("I am a hard-working and passionate customer service professional. I want to bring my people skills to a growing company where we can deliver great service together."),
      h("Work History"),
      ...roleBlocks(
        {
          title: "Customer Service Representative",
          company: "Desert Sun Insurance",
          dates: "Feb 2020 – Present",
          bullets: [
            "Responsible for answering customer calls and emails.",
            "Helped with onboarding new team members.",
            "Worked on improving our team's call scripts.",
            "I handled escalated complaints from policyholders.",
            "Completed Level I and Level II claims training.",
            "Tested I/O of the IVR menu with the IT team.",
          ],
        },
        "stacked",
      ),
      ...roleBlocks(
        {
          title: "Cashier",
          company: "Saguaro Grocery",
          dates: "Jun 2017 – Jan 2020",
          bullets: ["Duties included cash handling.", "Assisted with stocking shelves.", "Handled returns.", "Handled customer questions.", "Handled the opening checklist."],
        },
        "stacked",
      ),
      h("Education"),
      p("High School Diploma, Camelback High School | 2017"),
      h("Skills"),
      skillsPara("Customer Service, Zendesk, Microsoft Office, Conflict Resolution, Bilingual (English/Spanish)"),
    ],
  },
});

// 19 Employment gap (14 months), logistics, PDF.
fixtures.push({
  file: "19-employment-gap",
  outputs: ["pdf"],
  spec: {
    font: "Arial",
    size: 10.5,
    body: [
      nameLine("Ahmed Hassan"),
      contactLine("Birmingham, UK", "07700 900123", "ahmed.hassan@example.co.uk", "linkedin.com/in/ahmedhassan"),
      h("Summary"),
      p("Logistics coordinator with 7 years in freight forwarding and warehouse operations."),
      h("Employment History"),
      ...roleBlocks(
        {
          title: "Logistics Coordinator",
          company: "Midlands Freight Ltd",
          dates: "Jan 2022 – Present",
          bullets: ["Coordinate 250 inbound container moves per month.", "Cut demurrage charges by £86k a year by rescheduling port collections."],
        },
        "tab",
      ),
      ...roleBlocks(
        {
          title: "Warehouse Supervisor",
          company: "Severn Distribution",
          dates: "Mar 2017 – Oct 2020",
          bullets: ["Supervised a team of 18 across two shifts.", "Raised pick accuracy from 97.2% to 99.6%."],
        },
        "tab",
      ),
      ...roleBlocks(
        {
          title: "Warehouse Operative",
          company: "Severn Distribution",
          dates: "Jun 2015 – Feb 2017",
          bullets: ["Picked and packed up to 400 orders per shift."],
        },
        "tab",
      ),
      h("Education"),
      p("BTEC Level 3 Diploma in Business, South & City College Birmingham | 2013 – 2015"),
      h("Skills"),
      skillsPara("Freight Forwarding, Customs Documentation, WMS, SAP, Forklift (Counterbalance), Health & Safety"),
    ],
  },
});

// 20 Entry level, education first, Pakistan.
fixtures.push({
  file: "20-entry-level-pk",
  outputs: ["docx"],
  spec: {
    font: "Calibri",
    size: 11,
    body: [
      nameLine("Ayesha Siddiqui"),
      contactLine("Lahore, Pakistan", "+92 300 1234567", "ayesha.siddiqui@example.pk", "linkedin.com/in/ayeshasiddiqui", "github.com/ayeshas"),
      h("Education"),
      p([{ text: "BS Computer Science, Lahore University of Management Sciences (LUMS)", bold: true }, { text: "\tSep 2020 – Jun 2024" }], { rightTab: true }),
      b("CGPA 3.7/4.0; Dean's Honour List (6 semesters)"),
      b("Final-year project: Urdu speech-to-text for 3 regional accents, 87% word accuracy"),
      h("Internships"),
      ...roleBlocks(
        {
          title: "Software Engineering Intern",
          company: "Ravi Tech Solutions",
          dates: "Jun 2023 – Aug 2023",
          bullets: ["Built 6 REST endpoints in Django for a school management system.", "Wrote unit tests that raised coverage from 41% to 78%."],
        },
        "tab",
      ),
      h("Projects"),
      p([{ text: "Bazaar Price Tracker", bold: true }], { after: 20 }),
      b("Scraped prices for 1,200 grocery items daily and charted trends with React and Chart.js."),
      p([{ text: "Campus Ride Share", bold: true }], { after: 20 }),
      b("Flutter app used by 300 students to share rides to campus."),
      h("Skills"),
      skillsPara("Python, Django, JavaScript, React, SQL, Git, Flutter, Machine Learning"),
      h("Certifications"),
      b("Google Data Analytics Professional Certificate (2023)"),
    ],
  },
});

// 21 Senior two-page CV, Germany, with "Résumé" title.
function seniorRoles(): Block[] {
  const roles: Role[] = [
    {
      title: "Director of Engineering",
      company: "Spreewald Mobility GmbH",
      location: "Berlin",
      dates: "Apr 2020 – Present",
      bullets: [
        "Lead 6 teams (48 engineers) building the routing and pricing platform for 2.5 million monthly riders.",
        "Cut cloud spend by €1.1m a year through rightsizing and reserved capacity planning.",
        "Introduced quarterly planning and DORA metrics; deployment frequency rose from weekly to 30 per day.",
        "Hired 22 engineers and 4 engineering managers, with 92% 12-month retention.",
        "Sponsored the migration of the monolith into 14 domain services without a customer-facing outage.",
      ],
    },
    {
      title: "Engineering Manager",
      company: "Hanse Commerce AG",
      location: "Hamburg",
      dates: "Jan 2016 – Mar 2020",
      bullets: [
        "Managed 3 teams responsible for checkout and payments handling €400m GMV a year.",
        "Reduced checkout errors by 63% by introducing end-to-end monitoring and SLOs.",
        "Ran the PCI DSS Level 1 certification programme across 9 services.",
        "Grew the team from 9 to 24 engineers while keeping on-call load under 2 pages a week.",
      ],
    },
    {
      title: "Senior Software Engineer",
      company: "Hanse Commerce AG",
      location: "Hamburg",
      dates: "Jun 2012 – Dec 2015",
      bullets: [
        "Built the product search service in Java and Elasticsearch, serving 1,800 queries per second.",
        "Designed the A/B testing framework used for 300+ experiments a year.",
        "Led the move from SVN to Git and trunk-based development for 60 developers.",
      ],
    },
    {
      title: "Software Engineer",
      company: "Rheinland Systems",
      location: "Cologne",
      dates: "Sep 2008 – May 2012",
      bullets: [
        "Developed insurance claims workflows in Java EE for 4 regional insurers.",
        "Wrote a batch reconciliation job that cut nightly runtime from 5 hours to 40 minutes.",
        "Maintained an Oracle database of 120 million policy records.",
      ],
    },
    {
      title: "Junior Developer",
      company: "Nordlicht Software",
      location: "Bremen",
      dates: "Oct 2006 – Aug 2008",
      bullets: ["Implemented reporting modules in Java for logistics customers.", "Fixed over 300 defects in the first year as part of the maintenance team."],
    },
  ];
  return roles.flatMap((r) => roleBlocks(r, "company-first"));
}

fixtures.push({
  file: "21-senior-two-page-de",
  outputs: ["pdf"],
  spec: {
    font: "Arial",
    size: 11,
    body: [
      p([{ text: "Résumé", italic: true, color: "777777" }], { align: "center", after: 0 }),
      nameLine("Katharina Weber"),
      contactLine("Berlin, Germany", "+49 30 1234 5678", "katharina.weber@example.de", "linkedin.com/in/katharinaweber"),
      h("Executive Summary"),
      p(
        "Engineering leader with 18 years of experience in mobility, e-commerce and insurance software. Has built and scaled teams from 9 to 48 engineers, owned platforms handling €400m in annual transactions and led three large-scale migrations to the cloud. Known for pairing delivery discipline with strong engineering culture.",
      ),
      h("Professional Experience"),
      ...seniorRoles(),
      h("Education"),
      p([{ text: "Diplom-Informatiker (Computer Science), Technische Universität Berlin", bold: true }, { text: "\t2001 – 2006" }], { rightTab: true }),
      h("Skills"),
      skillsPara("Engineering Leadership, Java, Kotlin, Go, AWS, Kubernetes, Kafka, PostgreSQL, Microservices, SRE, OKRs, Hiring, Budget Planning"),
      h("Languages"),
      p("German (native), English (C2), French (B1)"),
      h("Publications"),
      b("\"Scaling Checkout to Black Friday\", talk at code.talks Hamburg (2018)"),
      b("\"Domain Services Without the Downtime\", InfoQ article (2022)"),
      h("Volunteer"),
      p("Mentor at ReDI School of Digital Integration, Berlin (2019 – Present): coach 3 career changers per cohort."),
    ],
  },
});

/* ---------------- public sample ---------------- */

function sampleCv(): Block[] {
  const white = (text: string, extra: Partial<Run> = {}): Run => ({ text, color: "FFFFFF", ...extra });
  const side: Block[] = [
    p([white("Get in touch", { bold: true, size: 11 })], { after: 80 }),
    p([white("+1 (206) 555-0175")], { after: 20 }),
    p([white("jordan.ellis@example.com")], { after: 20 }),
    p([white("Seattle, WA")], { after: 200 }),
    p([white("SKILLS", { bold: true })], { after: 60 }),
    ...["SQL", "Tableau", "Python (pandas)", "Excel", "Looker", "dbt", "Stakeholder Management", "Data Storytelling"].map((s) => p([white(s)], { after: 20 })),
    p([white("LANGUAGES", { bold: true })], { before: 200, after: 60 }),
    p([white("English, Spanish")], { after: 20 }),
  ];
  const main: Block[] = [
    p([{ text: "Jordan Ellis", bold: true, size: 24 }], { after: 20 }),
    p([{ text: "Business Intelligence Analyst", size: 13, color: "555555" }], { after: 200 }),
    h("About Me", { before: 0 }),
    p("I am a curious analyst who loves turning messy data into clear stories for operations and finance teams."),
    h("Experience"),
    ...roleBlocks(
      {
        title: "Business Intelligence Analyst",
        company: "Cedar & Pine Outdoor Co.",
        location: "Seattle, WA",
        dates: "2021 – Present",
        bullets: [
          "Built a Looker sales dashboard used weekly by 45 regional managers.",
          "Responsible for maintaining dbt models for the finance team.",
          "Automated the monthly inventory report, saving 10 hours a month.",
        ],
      },
      "stacked",
    ),
    ...roleBlocks(
      {
        title: "Data Analyst",
        company: "Rainier Health Network",
        location: "Tacoma, WA",
        dates: "Jun 2018 – Dec 2020",
        bullets: ["Helped with reporting for the patient experience team.", "Worked on cleaning appointment data in SQL.", "Presented findings."],
      },
      "stacked",
    ),
    h("Education"),
    p("B.S. Statistics, Western Washington University | 2014 – 2018"),
  ];
  return [{ type: "table", widths: [3000, 6900], shading: ["1F4E5F", null], rows: [[side, main]] }];
}

/* ---------------- job descriptions ---------------- */

const JDS: Record<string, string> = {
  "backend-engineer.txt": `Job Title: Senior Software Engineer (Backend)

About the role
We are looking for a Senior Software Engineer to join our payments platform team. You will design and operate high-throughput services in Go and Python on AWS.

What you'll do
- Design, build and operate distributed services handling millions of transactions per day
- Own services end to end: design, CI/CD, monitoring and on-call
- Work with PostgreSQL, Kafka and Redis at scale
- Run workloads on Kubernetes with Terraform-managed infrastructure
- Mentor engineers and lead technical design reviews

Requirements
- 5+ years of backend software engineering experience
- Strong Go or Python skills
- Experience with AWS, Kubernetes, Docker and Terraform
- Solid understanding of PostgreSQL, Kafka and event-driven architecture
- Experience with gRPC and microservices
- Strong communication and collaboration skills; stakeholder management experience is a plus
- Nice to have: Rust, GraphQL, Datadog

We value ownership, mentoring and clear written communication.`,
  "financial-analyst.txt": `Financial Reporting Manager

Pennant Holdings is hiring a Financial Reporting Manager to lead group consolidation and statutory reporting.

Responsibilities
- Prepare consolidated IFRS financial statements and management accounts
- Own the month-end close and balance sheet reconciliations
- Produce variance analysis and board reporting
- Improve processes using BlackLine and Power BI
- Support external audit and tax teams

Requirements
- ACA, ACCA or CIMA qualified
- Strong IFRS knowledge and consolidation experience
- Advanced Excel; experience with SAP and Power BI
- Team leadership and stakeholder management
- Excellent attention to detail and communication skills`,
  "registered-nurse.txt": `Position: Registered Nurse – Emergency Department

We are seeking a Registered Nurse for our busy Emergency Department.

Responsibilities
- Triage and assess patients; deliver emergency nursing care
- Administer medications and IV therapy
- Document care in Epic
- Collaborate with physicians and the multidisciplinary team

Qualifications
- Current RN registration
- BLS and ACLS required; TNCC and PALS preferred
- 2+ years of emergency or critical care experience
- Strong patient assessment, communication and teamwork skills`,
};

/* ---------------- build ---------------- */

function soffice(inputs: string[], outDir: string) {
  const profile = join(SCRATCH, "lo-profile");
  execFileSync("soffice", [`-env:UserInstallation=file://${profile}`, "--headless", "--convert-to", "pdf", "--outdir", outDir, ...inputs], { stdio: "pipe" });
}

async function renameFonts(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const map = (name: string) =>
    name
      .replace(/LiberationSans-?Bold/i, "Montserrat-Bold")
      .replace(/LiberationSans-?Italic/i, "Montserrat-Italic")
      .replace(/LiberationSans(-Regular)?/i, "Montserrat-Regular");
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    const type = obj.get(PDFName.of("Type"));
    if (type === PDFName.of("Font")) {
      const base = obj.get(PDFName.of("BaseFont"));
      if (base instanceof PDFName) obj.set(PDFName.of("BaseFont"), PDFName.of(map(base.decodeText())));
    } else if (type === PDFName.of("FontDescriptor")) {
      const fn = obj.get(PDFName.of("FontName"));
      if (fn instanceof PDFName) obj.set(PDFName.of("FontName"), PDFName.of(map(fn.decodeText())));
      const fam = obj.get(PDFName.of("FontFamily"));
      if (fam) obj.set(PDFName.of("FontFamily"), PDFString.of("Montserrat"));
    }
  }
  return doc.save({ useObjectStreams: false });
}

async function imageOnly(pdfPath: string, work: string): Promise<Uint8Array> {
  const prefix = join(work, "scan");
  execFileSync("pdftoppm", ["-r", "110", "-png", pdfPath, prefix]);
  const pngs = readdirSync(work)
    .filter((f) => f.startsWith("scan") && f.endsWith(".png"))
    .sort();
  const doc = await PDFDocument.create();
  for (const f of pngs) {
    const img = await doc.embedPng(readFileSync(join(work, f)));
    const page = doc.addPage([595.28, 841.89]);
    page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  doc.setProducer("Fixture Scanner");
  doc.setCreationDate(new Date("2024-01-01T00:00:00Z"));
  doc.setModificationDate(new Date("2024-01-01T00:00:00Z"));
  return doc.save();
}

async function main() {
  rmSync(SCRATCH, { recursive: true, force: true });
  mkdirSync(SCRATCH, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(OUT, "jd"), { recursive: true });
  mkdirSync(SAMPLE_OUT, { recursive: true });

  const all: Fixture[] = [...fixtures, { file: "sample-resume", outputs: ["pdf"], spec: { font: "Arial", size: 10, body: sampleCv() }, dest: SAMPLE_OUT }];

  const toConvert: string[] = [];
  for (const f of all) {
    const bytes = await buildDocx(f.spec);
    if (f.outputs.includes("docx")) writeFileSync(join(f.dest ?? OUT, `${f.file}.docx`), bytes);
    if (f.outputs.includes("pdf")) {
      const tmp = join(SCRATCH, `${f.file}.docx`);
      writeFileSync(tmp, bytes);
      toConvert.push(tmp);
    }
  }
  const pdfDir = join(SCRATCH, "pdf");
  mkdirSync(pdfDir, { recursive: true });
  soffice(toConvert, pdfDir);

  for (const f of all.filter((x) => x.outputs.includes("pdf"))) {
    const src = join(pdfDir, `${f.file}.pdf`);
    if (!existsSync(src)) throw new Error(`LibreOffice did not produce ${src}`);
    let bytes: Uint8Array = readFileSync(src);
    if (f.post === "rename-fonts") bytes = await renameFonts(bytes);
    if (f.post === "image-only") {
      const work = join(SCRATCH, `${f.file}-scan`);
      mkdirSync(work, { recursive: true });
      bytes = await imageOnly(src, work);
    }
    writeFileSync(join(f.dest ?? OUT, `${f.file}.pdf`), bytes);
  }

  for (const [name, text] of Object.entries(JDS)) writeFileSync(join(OUT, "jd", name), text + "\n");

  // Error cases: files analyzeDocument must reject with UnreadableDocumentError, or handle without text.
  const errDir = join(OUT, "errors");
  mkdirSync(errDir, { recursive: true });
  const encSrc = join(SCRATCH, "encrypted.docx");
  writeFileSync(encSrc, await buildDocx(fixtures[0].spec));
  const encOut = join(SCRATCH, "enc");
  mkdirSync(encOut, { recursive: true });
  execFileSync("soffice", [`-env:UserInstallation=file://${join(SCRATCH, "lo-profile")}`, "--headless", "--convert-to",
    'pdf:writer_pdf_Export:{"EncryptFile":{"type":"boolean","value":"true"},"DocumentOpenPassword":{"type":"string","value":"secret"}}',
    "--outdir", encOut, encSrc], { stdio: "pipe" });
  writeFileSync(join(errDir, "encrypted.pdf"), readFileSync(join(encOut, "encrypted.pdf")));
  const good = readFileSync(join(OUT, "02-clean-accountant-uk.pdf"));
  writeFileSync(join(errDir, "truncated.pdf"), good.subarray(0, 1500));
  writeFileSync(join(errDir, "garbage.pdf"), Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(4000, 0x41)]));
  writeFileSync(join(errDir, "not-a-zip.docx"), Buffer.from("PK\u0003\u0004 this is not really a zip archive"));
  const JSZipMod = (await import("jszip")).default;
  const noDoc = new JSZipMod();
  noDoc.file("word/other.xml", "<x/>");
  writeFileSync(join(errDir, "no-document-xml.docx"), await noDoc.generateAsync({ type: "nodebuffer" }));
  // Valid DOCX whose body is empty: everything sits in a text box.
  writeFileSync(
    join(errDir, "textbox-only.docx"),
    await buildDocx({ font: "Arial", size: 11, body: [{ type: "textbox", widthPt: 400, heightPt: 120, content: [p("Sam Carter"), p("sam.carter@example.com | +1 555 010 2030"), p("Experience: Barista, Bean There Cafe, 2020 – 2023")] }] }),
  );

  // Round-trip fixtures: our own export templates must parse back cleanly.
  for (const t of ["standard", "technical", "entry"] as TemplateId[])
    for (const fmt of ["docx", "pdf"] as const) writeFileSync(join(OUT, `export-${t}.${fmt}`), await renderResume(sampleFor(t), t, fmt));
  console.log(`Wrote ${fixtures.length} fixtures to ${OUT} and the sample to ${SAMPLE_OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export type { Para };
