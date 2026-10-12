/**
 * Fictional sample content for template previews and "download template"
 * links. These people, companies and numbers are invented; any resemblance
 * to real persons is coincidental. Domains use the reserved example.com.
 */
import type { ResumeContent, TemplateId } from "@/lib/types";

export const SAMPLE_CONTENT: ResumeContent = {
  name: "Maya Okafor",
  headline: "Operations Manager",
  email: "maya.okafor@example.com",
  phone: "(555) 014-2290",
  location: "Columbus, OH",
  linkedin: "linkedin.com/in/maya-okafor-example",
  links: [],
  summary:
    "Operations manager with eight years of experience running fulfilment and customer support teams in high-volume retail. Known for turning messy processes into simple, measurable routines, and for coaching new team leads. Comfortable owning budgets, vendor relationships and weekly reporting to senior leadership.",
  experience: [
    {
      title: "Operations Manager",
      company: "Northfield Home Goods",
      location: "Columbus, OH",
      start: "Apr 2021",
      end: "Present",
      bullets: [
        "Lead a team of 24 across two fulfilment shifts, covering scheduling, hiring and performance reviews.",
        "Redesigned the returns workflow, cutting average processing time from 6 days to 2 days.",
        "Negotiated new carrier contracts that reduced outbound shipping costs by 11% year over year.",
        "Introduced a weekly operations dashboard now used by finance and merchandising leads.",
      ],
    },
    {
      title: "Customer Support Team Lead",
      company: "Brightline Outfitters",
      location: "Dayton, OH",
      start: "Jun 2018",
      end: "Mar 2021",
      bullets: [
        "Managed a 9-person support team handling roughly 3,000 tickets a month across email and chat.",
        "Wrote the team's first knowledge base, lifting first-contact resolution from 58% to 74%.",
        "Trained four agents who were later promoted into team lead roles.",
      ],
    },
    {
      title: "Fulfilment Associate",
      company: "Brightline Outfitters",
      location: "Dayton, OH",
      start: "Aug 2016",
      end: "May 2018",
      bullets: [
        "Picked, packed and audited orders during peak season, consistently in the top 10% for accuracy.",
        "Flagged recurring inventory mismatches that led to a revised cycle-count schedule.",
      ],
    },
  ],
  education: [
    {
      institution: "Ohio State University",
      degree: "B.S. Business Administration, Operations Management",
      dates: "2012 – 2016",
      details: [],
    },
  ],
  skills: [
    "Team leadership",
    "Process improvement",
    "Vendor negotiation",
    "Budget management",
    "Workforce scheduling",
    "Microsoft Excel",
    "SQL",
    "Zendesk",
    "NetSuite",
    "Lean Six Sigma",
  ],
  certifications: ["Lean Six Sigma Green Belt, 2020", "OSHA 10-Hour General Industry"],
};

export const SAMPLE_TECHNICAL: ResumeContent = {
  name: "Daniel Reyes",
  headline: "Senior Backend Engineer",
  email: "daniel.reyes@example.com",
  phone: "(555) 018-7731",
  location: "Austin, TX",
  linkedin: "linkedin.com/in/daniel-reyes-example",
  links: ["github.com/dreyes-example"],
  summary:
    "Backend engineer with seven years of experience building payment and data services in Go and Python. Focused on reliable APIs, clear observability and pragmatic system design, with a track record of mentoring engineers and leading migrations without downtime.",
  experience: [
    {
      title: "Senior Backend Engineer",
      company: "Ledgerline",
      location: "Austin, TX",
      start: "Feb 2022",
      end: "Present",
      bullets: [
        "Led the migration of the payments ledger from a monolith to three Go services with zero customer-facing downtime.",
        "Cut p99 latency on the transaction API from 820 ms to 190 ms by reworking PostgreSQL indexes and caching hot reads in Redis.",
        "Built an event pipeline on Kafka that replaced nightly batch jobs and made balances available in near real time.",
        "Mentor three engineers and run the team's weekly design review.",
      ],
    },
    {
      title: "Software Engineer",
      company: "Parcelwise",
      location: "Remote",
      start: "Jul 2019",
      end: "Jan 2022",
      bullets: [
        "Designed a Python and FastAPI service for carrier rate quotes, serving about 2 million requests a day.",
        "Introduced Terraform and GitHub Actions for infrastructure changes, ending manual console edits in AWS.",
        "Added structured logging and Grafana dashboards that halved the mean time to detect incidents.",
      ],
    },
    {
      title: "Junior Developer",
      company: "Copperleaf Analytics",
      location: "San Antonio, TX",
      start: "Jun 2017",
      end: "Jun 2019",
      bullets: [
        "Maintained Django reporting tools used by 40 client accounts.",
        "Wrote integration tests that raised coverage of the billing module from 35% to 80%.",
      ],
    },
  ],
  education: [
    {
      institution: "University of Texas at San Antonio",
      degree: "B.S. Computer Science",
      dates: "2013 – 2017",
      details: [],
    },
  ],
  skills: [
    "Go",
    "Python",
    "SQL",
    "TypeScript",
    "FastAPI",
    "Django",
    "gRPC",
    "PostgreSQL",
    "Redis",
    "Kafka",
    "AWS",
    "Docker",
    "Kubernetes",
    "Terraform",
    "GitHub Actions",
    "Grafana",
    "Git",
    "pytest",
    "Postman",
  ],
  certifications: ["AWS Certified Solutions Architect – Associate"],
};

export const SAMPLE_ENTRY: ResumeContent = {
  name: "Priya Nandakumar",
  headline: null,
  email: "priya.nandakumar@example.com",
  phone: "(555) 012-4408",
  location: "Madison, WI",
  linkedin: "linkedin.com/in/priya-nandakumar-example",
  links: [],
  summary:
    "Recent marketing graduate with hands-on experience running social campaigns for a campus nonprofit and supporting a regional agency's content team. Comfortable with analytics tools, clear writing and turning feedback into better work quickly.",
  experience: [
    {
      title: "Marketing Intern",
      company: "Lakeshore Creative Agency",
      location: "Madison, WI",
      start: "May 2025",
      end: "Aug 2025",
      bullets: [
        "Drafted 30+ social posts and two client newsletters, all approved with minor edits.",
        "Compiled weekly campaign reports in Google Analytics and Looker Studio for three accounts.",
        "Researched competitor messaging to support a pitch the agency went on to win.",
      ],
    },
    {
      title: "Social Media Volunteer",
      company: "Campus Food Share",
      location: "Madison, WI",
      start: "Sep 2023",
      end: "May 2025",
      bullets: [
        "Ran the organisation's Instagram account, growing followers from 600 to 2,100.",
        "Designed flyers and event pages that helped double volunteer sign-ups for the spring drive.",
      ],
    },
    {
      title: "Barista",
      company: "Union Street Coffee",
      location: "Madison, WI",
      start: "Jan 2022",
      end: "Apr 2024",
      bullets: ["Trained new staff on opening procedures and handled the morning rush on a two-person shift."],
    },
  ],
  education: [
    {
      institution: "University of Wisconsin–Madison",
      degree: "B.A. Marketing, minor in Communication Arts",
      dates: "Sep 2021 – May 2025",
      details: [
        "GPA: 3.7 / 4.0, Dean's List (six semesters)",
        "Relevant coursework: Consumer Behavior, Digital Marketing Analytics, Brand Strategy",
        "Capstone: built a go-to-market plan for a local bike-share pilot, presented to city staff",
      ],
    },
  ],
  skills: [
    "Social media marketing",
    "Copywriting",
    "Google Analytics",
    "Looker Studio",
    "Canva",
    "Microsoft Excel",
    "Email marketing",
    "Market research",
  ],
  certifications: ["Google Analytics Certification", "HubSpot Content Marketing Certification"],
};

export const SAMPLE_EXECUTIVE: ResumeContent = {
  name: "Catherine Molloy",
  headline: "Chief Financial Officer",
  email: "catherine.molloy@example.com",
  phone: "(555) 017-3384",
  location: "Chicago, IL",
  linkedin: "linkedin.com/in/catherine-molloy-example",
  links: [],
  summary:
    "Finance executive with 18 years of experience leading finance, FP&A and investor relations for mid-market manufacturing and distribution companies. Has steered two businesses through private-equity ownership, one acquisition-led growth plan and a successful sale. Builds lean finance teams, plain-English reporting and a close partnership with operations.",
  experience: [
    {
      title: "Chief Financial Officer",
      company: "Halvorsen Industrial Supply",
      location: "Chicago, IL",
      start: "Jan 2019",
      end: "Present",
      bullets: [
        "Lead a 32-person finance, IT and procurement organisation for a $410M industrial distributor with 14 branches.",
        "Directed the finance side of three acquisitions, including diligence, financing and integration, adding $96M in annual revenue.",
        "Refinanced $180M of debt during a rising-rate period, lowering annual interest expense by $2.7M.",
        "Introduced rolling 13-week cash forecasting and branch-level P&Ls, freeing $22M of working capital in 18 months.",
        "Prepared the business for a 2024 sale to a strategic buyer at 11.5x EBITDA.",
      ],
    },
    {
      title: "Vice President of Finance",
      company: "Corwin Packaging Group",
      location: "Milwaukee, WI",
      start: "Mar 2013",
      end: "Dec 2018",
      bullets: [
        "Ran FP&A, accounting and treasury for a private-equity-backed packaging manufacturer with $260M in revenue.",
        "Rebuilt the monthly close from 12 days to 5 by standardising reconciliations and moving to NetSuite.",
        "Partnered with plant leaders on a pricing review that lifted gross margin by 3.1 points.",
      ],
    },
    {
      title: "Director of Financial Planning & Analysis",
      company: "Lakeview Foods",
      location: "Chicago, IL",
      start: "Jun 2008",
      end: "Feb 2013",
      bullets: [
        "Built the company's first driver-based budget model and board reporting pack.",
        "Led a team of six analysts supporting sales, supply chain and capital planning.",
      ],
    },
  ],
  education: [
    {
      institution: "University of Chicago Booth School of Business",
      degree: "MBA, Finance and Strategy",
      dates: "2006 – 2008",
      details: [],
    },
    {
      institution: "University of Illinois Urbana-Champaign",
      degree: "B.S. Accountancy",
      dates: "1998 – 2002",
      details: [],
    },
  ],
  skills: [
    "Financial strategy",
    "Mergers & acquisitions",
    "Capital markets",
    "FP&A",
    "Investor relations",
    "Cash management",
    "Board reporting",
    "ERP implementation",
    "Team building",
  ],
  certifications: ["Certified Public Accountant (CPA), Illinois", "Chartered Financial Analyst (CFA)"],
};

export const SAMPLE_COMPACT: ResumeContent = {
  name: "Aisha Rahman",
  headline: "Registered Nurse, Emergency Department",
  email: "aisha.rahman@example.com",
  phone: "(555) 019-6621",
  location: "Phoenix, AZ",
  linkedin: "linkedin.com/in/aisha-rahman-example",
  links: [],
  summary:
    "Emergency department nurse with seven years of acute care experience in Level I and Level II trauma centres. Calm under pressure, quick at triage and known for clear handovers and patient education. Precepts new graduate nurses and serves on the unit's practice council.",
  experience: [
    {
      title: "Registered Nurse, Emergency Department",
      company: "Desert Valley Medical Center",
      location: "Phoenix, AZ",
      start: "Aug 2021",
      end: "Present",
      bullets: [
        "Triage and treat 18 to 25 patients per 12-hour shift in a 64-bed Level I trauma department.",
        "Precepted 11 new graduate nurses through a 12-week orientation, all retained past their first year.",
        "Led the unit's sepsis bundle refresher, raising 3-hour bundle compliance from 71% to 89%.",
        "Serve as charge nurse two shifts a month, coordinating 14 staff and bed flow with admitting.",
        "Member of the unit practice council; co-led the switch to a new rapid-triage protocol in 2023.",
      ],
    },
    {
      title: "Registered Nurse, Emergency Department",
      company: "Saguaro Community Hospital",
      location: "Tucson, AZ",
      start: "Jun 2019",
      end: "Jul 2021",
      bullets: [
        "Cared for adult and paediatric patients in a 28-bed Level II trauma centre during the COVID-19 surge.",
        "Co-wrote discharge teaching sheets in English and Spanish for common ED diagnoses.",
        "Rotated as float nurse to ICU step-down during staffing shortages.",
      ],
    },
    {
      title: "Registered Nurse, Medical-Surgical Unit",
      company: "Saguaro Community Hospital",
      location: "Tucson, AZ",
      start: "Jul 2017",
      end: "May 2019",
      bullets: [
        "Managed a five-patient assignment on a 36-bed med-surg floor, including post-operative and telemetry patients.",
        "Joined the falls-prevention committee; unit falls dropped 30% over the following year.",
      ],
    },
    {
      title: "Patient Care Technician",
      company: "Mesa Ridge Hospital",
      location: "Tempe, AZ",
      start: "Jan 2015",
      end: "Jun 2017",
      bullets: [
        "Took vital signs, drew blood and ran EKGs for up to 12 patients a shift on a busy telemetry unit.",
        "Trained six new technicians on charting and patient-safety routines.",
      ],
    },
  ],
  education: [
    {
      institution: "Arizona State University",
      degree: "Bachelor of Science in Nursing (BSN)",
      dates: "2013 – 2017",
      details: ["Graduated cum laude; clinical rotations in emergency, intensive care and paediatrics"],
    },
  ],
  skills: [
    "Clinical: Triage (ESI), Trauma care, Sepsis protocols, IV insertion, Wound care, Telemetry",
    "Systems: Epic, Pyxis, Omnicell",
    "Communication: Patient education, Spanish (conversational)",
  ],
  certifications: [
    "Registered Nurse, Arizona State Board of Nursing",
    "Certified Emergency Nurse (CEN)",
    "Advanced Cardiovascular Life Support (ACLS)",
    "Pediatric Advanced Life Support (PALS)",
    "Trauma Nursing Core Course (TNCC)",
    "Basic Life Support (BLS)",
    "Stroke Scale Certification (NIHSS)",
  ],
};

export const SAMPLE_MODERN: ResumeContent = {
  name: "Jordan Ellis",
  headline: "Senior Product Designer",
  email: "jordan.ellis@example.com",
  phone: "(555) 015-8842",
  location: "Seattle, WA",
  linkedin: "linkedin.com/in/jordan-ellis-example",
  links: ["jordanellis.example.com"],
  summary:
    "Product designer with eight years of experience shaping web and mobile products for fintech and health. Turns research into clear flows and calm interfaces, and works closely with engineers to ship. Built and maintained two design systems used by more than 40 designers and engineers.",
  experience: [
    {
      title: "Senior Product Designer",
      company: "Fernway Health",
      location: "Seattle, WA",
      start: "May 2022",
      end: "Present",
      bullets: [
        "Lead design for the patient app's scheduling and billing journeys, used by 1.2 million members.",
        "Redesigned appointment booking after 24 user interviews, cutting drop-off from 38% to 21%.",
        "Built the Tidewater design system in Figma and React with engineering, now covering 90% of screens.",
        "Mentor two product designers and run a fortnightly design critique.",
        "Partner with data science on experiment design; shipped 9 A/B tests in 2024 with clear decision memos.",
      ],
    },
    {
      title: "Product Designer",
      company: "Copperline Bank",
      location: "Portland, OR",
      start: "Feb 2019",
      end: "Apr 2022",
      bullets: [
        "Designed the mobile onboarding flow for a new checking account, reaching a 72% completion rate.",
        "Ran usability tests every sprint and shared findings in short video reels for the wider team.",
        "Partnered with compliance to rewrite disclosures in plain language without slowing approvals.",
        "Created an accessibility checklist for every release, closing 140 WCAG issues across web and mobile.",
      ],
    },
    {
      title: "UX Designer",
      company: "Northbeam Studio",
      location: "Portland, OR",
      start: "Jul 2016",
      end: "Jan 2019",
      bullets: [
        "Delivered research, wireframes and prototypes for 15 client projects across retail and nonprofit.",
        "Ran discovery workshops with client stakeholders and turned findings into prioritised roadmaps.",
      ],
    },
  ],
  education: [
    {
      institution: "University of Washington",
      degree: "B.Des. Interaction Design",
      dates: "2012 – 2016",
      details: [],
    },
  ],
  skills: [
    "Product design",
    "Interaction design",
    "User research",
    "Usability testing",
    "Prototyping",
    "Design systems",
    "Accessibility (WCAG 2.2)",
    "Figma",
    "Framer",
    "HTML",
    "CSS",
  ],
  certifications: ["Nielsen Norman Group UX Certification"],
};

export const SAMPLE_MINIMAL: ResumeContent = {
  name: "Elena Marsh",
  headline: "Content Strategist & Editor",
  email: "elena.marsh@example.com",
  phone: "(555) 016-2207",
  location: "Brooklyn, NY",
  linkedin: "linkedin.com/in/elena-marsh-example",
  links: [],
  summary:
    "Editor and content strategist with ten years of experience across publishing and technology. Builds editorial standards, voice guidelines and calm, useful content that readers trust. Comfortable leading small teams, working with legal and product, and editing everything from help articles to long-form features.",
  experience: [
    {
      title: "Lead Content Strategist",
      company: "Brightpath Software",
      location: "New York, NY",
      start: "Mar 2021",
      end: "Present",
      bullets: [
        "Own voice, tone and content standards for a product used by 300,000 small businesses.",
        "Rewrote the help centre's 120 most-visited articles, reducing related support tickets by 18%.",
        "Lead a team of three writers and partner with product design on every new feature launch.",
        "Launched a content style guide and terminology list now used by 60 people across product, support and marketing.",
        "Partner with legal to keep billing and privacy pages accurate, clear and up to date.",
      ],
    },
    {
      title: "Senior Editor",
      company: "Hudson & Pine Publishing",
      location: "New York, NY",
      start: "Jan 2017",
      end: "Feb 2021",
      bullets: [
        "Acquired and edited 22 non-fiction titles, four of which became regional bestsellers.",
        "Introduced a shared style sheet and production checklist adopted across the imprint.",
        "Guided authors from proposal to publication, including structural edits, line edits and launch copy.",
      ],
    },
    {
      title: "Assistant Editor",
      company: "The Ledger Review",
      location: "Boston, MA",
      start: "Jun 2014",
      end: "Dec 2016",
      bullets: [
        "Edited weekly features and managed a roster of 30 freelance contributors.",
        "Fact-checked and copy-edited the print edition to house style on a weekly deadline.",
      ],
    },
  ],
  education: [
    {
      institution: "Boston University",
      degree: "B.A. English Literature",
      dates: "2010 – 2014",
      details: [],
    },
  ],
  skills: [
    "Content strategy",
    "Editing",
    "Voice and tone",
    "Information architecture",
    "SEO writing",
    "Style guides",
    "Team leadership",
    "Contentful",
    "WordPress",
  ],
  certifications: [],
};

export const SAMPLE_BOLD: ResumeContent = {
  name: "Marcus Bell",
  headline: "Enterprise Account Executive",
  email: "marcus.bell@example.com",
  phone: "(555) 011-9035",
  location: "Atlanta, GA",
  linkedin: "linkedin.com/in/marcus-bell-example",
  links: [],
  summary:
    "Enterprise account executive with nine years of B2B software sales, consistently above quota. Runs disciplined, multi-threaded deals with finance, IT and operations buyers, and builds relationships that turn into expansions. Known for clear forecasting and for coaching newer reps.",
  experience: [
    {
      title: "Enterprise Account Executive",
      company: "Clearwater Logistics Software",
      location: "Atlanta, GA",
      start: "Jan 2021",
      end: "Present",
      bullets: [
        "Closed $4.8M in new annual recurring revenue across 2023 and 2024, finishing at 132% and 118% of quota.",
        "Landed the company's largest deal to date, a $1.1M three-year contract with a national grocery distributor.",
        "Built a partner channel with two freight brokers that now sources 20% of the team's pipeline.",
        "Mentor four new account executives through their first two quarters.",
      ],
    },
    {
      title: "Mid-Market Account Executive",
      company: "Summit Payroll",
      location: "Charlotte, NC",
      start: "Apr 2017",
      end: "Dec 2020",
      bullets: [
        "Exceeded quota in 14 of 15 quarters selling payroll and HR software to companies with 100 to 1,000 staff.",
        "Named President's Club in 2018 and 2019.",
        "Grew average deal size by 35% by leading with multi-module bundles for finance and HR buyers.",
      ],
    },
    {
      title: "Sales Development Representative",
      company: "Summit Payroll",
      location: "Charlotte, NC",
      start: "Jun 2015",
      end: "Mar 2017",
      bullets: [
        "Booked 60+ qualified meetings a quarter through calls, email and LinkedIn outreach.",
        "Promoted to account executive after five consecutive quarters as the top SDR.",
      ],
    },
  ],
  education: [
    {
      institution: "Georgia State University",
      degree: "B.B.A. Marketing",
      dates: "2011 – 2015",
      details: [],
    },
  ],
  skills: [
    "Enterprise sales",
    "Solution selling",
    "MEDDICC",
    "Negotiation",
    "Pipeline management",
    "Forecasting",
    "Salesforce",
    "Gong",
    "Outreach",
  ],
  certifications: ["Challenger Sales Certification"],
};

export const SAMPLE_TIMELINE: ResumeContent = {
  name: "Hannah Whitfield",
  headline: "Construction Project Manager",
  email: "hannah.whitfield@example.com",
  phone: "(555) 013-4470",
  location: "Salt Lake City, UT",
  linkedin: "linkedin.com/in/hannah-whitfield-example",
  links: [],
  summary:
    "Construction project manager with ten years of experience delivering commercial and healthcare buildings on time and within budget. Coordinates owners, architects and trades with clear schedules and honest reporting. Strong on preconstruction, cost control and site safety.",
  experience: [
    {
      title: "Senior Project Manager",
      company: "Granite Peak Builders LLC",
      location: "Salt Lake City, UT",
      start: "Feb 2020",
      end: "Present",
      bullets: [
        "Delivered a $64M outpatient medical centre two weeks early with zero lost-time incidents.",
        "Manage budgets, schedules and subcontracts for up to three concurrent projects worth $90M in total.",
        "Introduced weekly look-ahead planning with trade foremen, cutting rework requests by 25%.",
        "Mentor two assistant project managers and run monthly cost reviews with the owner's representative.",
      ],
    },
    {
      title: "Project Manager",
      company: "Front Range Construction Group",
      location: "Provo, UT",
      start: "May 2016",
      end: "Jan 2020",
      bullets: [
        "Ran tenant improvement and mid-rise office projects from $3M to $18M.",
        "Negotiated change orders and closeout with owners, recovering $1.2M in disputed costs.",
        "Coordinated design teams and city inspectors to secure occupancy permits ahead of schedule on five projects.",
      ],
    },
    {
      title: "Assistant Project Manager",
      company: "Front Range Construction Group",
      location: "Provo, UT",
      start: "Jun 2014",
      end: "Apr 2016",
      bullets: [
        "Managed RFIs, submittals and owner meeting minutes on a $40M university residence hall.",
        "Tracked subcontractor progress against the master schedule and flagged risks weekly.",
      ],
    },
  ],
  education: [
    {
      institution: "Colorado State University",
      degree: "B.S. Construction Management",
      dates: "2010 – 2014",
      details: [],
    },
  ],
  skills: [
    "Project management",
    "Preconstruction",
    "Cost control",
    "Scheduling",
    "Contract negotiation",
    "Site safety",
    "Procore",
    "Primavera P6",
    "Bluebeam",
  ],
  certifications: ["Project Management Professional (PMP)", "OSHA 30-Hour Construction"],
};

export const SAMPLE_SIDEBAR: ResumeContent = {
  name: "Sofia Marin",
  headline: "Brand Designer",
  email: "sofia.marin@example.com",
  phone: "(555) 012-7719",
  location: "Austin, TX",
  linkedin: "linkedin.com/in/sofia-marin-example",
  links: ["sofiamarin.example.com"],
  summary:
    "Brand designer with six years of experience building identities, packaging and campaign systems for food, hospitality and consumer brands. Loves a sharp brief, a tight grid and a good typeface pairing, and works happily with founders, marketers and print vendors.",
  experience: [
    {
      title: "Senior Brand Designer",
      company: "Juniper & Oak Studio",
      location: "Austin, TX",
      start: "Mar 2022",
      end: "Present",
      bullets: [
        "Lead identity projects for 12 clients a year, from discovery workshops to brand guidelines.",
        "Designed packaging for a regional coffee roaster's relaunch, which doubled retail placements in a year.",
        "Built a reusable campaign toolkit that cut social asset production time by 50%.",
        "Mentor two junior designers and run the studio's monthly type and layout critique.",
      ],
    },
    {
      title: "Brand Designer",
      company: "Lantern Creative",
      location: "Houston, TX",
      start: "Jun 2019",
      end: "Feb 2022",
      bullets: [
        "Created logos, signage and menus for 20+ restaurant and hotel openings.",
        "Managed print production with 8 vendors, keeping every launch on schedule and within budget.",
        "Designed a seasonal campaign for a 6-property boutique hotel group across print, social and in-room.",
      ],
    },
    {
      title: "Junior Designer",
      company: "Bright Day Agency",
      location: "Houston, TX",
      start: "Aug 2018",
      end: "May 2019",
      bullets: [
        "Produced social, email and in-store graphics for retail clients.",
        "Prepared print-ready files and proofs for signage, packaging and direct mail.",
      ],
    },
    {
      title: "Design Intern",
      company: "Sixth Ward Press",
      location: "Houston, TX",
      start: "May 2017",
      end: "Aug 2017",
      bullets: [
        "Set type and laid out two poetry chapbooks and a quarterly arts newsletter.",
        "Hand-lettered event posters for 6 readings and gallery nights.",
      ],
    },
  ],
  education: [
    {
      institution: "University of Houston",
      degree: "BFA Graphic Design",
      dates: "2014 – 2018",
      details: [],
    },
  ],
  skills: [
    "Brand identity",
    "Packaging",
    "Typography",
    "Art direction",
    "Illustration",
    "Adobe Illustrator",
    "InDesign",
    "Photoshop",
    "Figma",
    "Print production",
  ],
  certifications: ["Type Design Fundamentals, Cooper Union Continuing Education"],
};

export const SAMPLE_STUDIO: ResumeContent = {
  name: "Isabel Duarte",
  headline: "Events & Experiential Marketing Producer",
  email: "isabel.duarte@example.com",
  phone: "(555) 014-6683",
  location: "Los Angeles, CA",
  linkedin: "linkedin.com/in/isabel-duarte-example",
  links: ["isabelduarte.example.com"],
  summary:
    "Producer of brand events and pop-ups with seven years of experience turning a creative idea into a guest experience that runs on time and on budget. Manages vendors, venues, permits and crews, and keeps clients calm on show day.",
  experience: [
    {
      title: "Senior Experiential Producer",
      company: "Marigold Live",
      location: "Los Angeles, CA",
      start: "Apr 2021",
      end: "Present",
      bullets: [
        "Produced 30+ brand activations a year, from 200-guest launches to a 12-city mobile tour.",
        "Managed budgets up to $1.4M per program, finishing every 2024 program at or under budget.",
        "Built a vendor roster and run-of-show template now used across the production team.",
        "Lead on-site crews of up to 40 staff and freelancers, including load-in, guest flow and strike.",
      ],
    },
    {
      title: "Event Producer",
      company: "Copper Street Agency",
      location: "San Diego, CA",
      start: "Jan 2018",
      end: "Mar 2021",
      bullets: [
        "Planned conferences and product launches for technology and beverage clients.",
        "Pivoted six in-person events to hybrid formats in 2020 with no client cancellations.",
        "Negotiated venue and catering contracts, saving clients an average of 12% against first quotes.",
      ],
    },
    {
      title: "Event Coordinator",
      company: "Seaside Venues Group",
      location: "San Diego, CA",
      start: "Jun 2016",
      end: "Dec 2017",
      bullets: [
        "Coordinated weddings and corporate dinners for up to 400 guests.",
        "Built supplier timelines and floor plans with the venue's catering and AV teams.",
      ],
    },
  ],
  education: [
    {
      institution: "San Diego State University",
      degree: "B.S. Hospitality and Tourism Management",
      dates: "2012 – 2016",
      details: [],
    },
  ],
  skills: [
    "Event production",
    "Budgeting",
    "Vendor management",
    "Run of show",
    "Permitting",
    "Hybrid events",
    "Client relations",
    "Asana",
    "Cvent",
  ],
  certifications: ["Certified Meeting Professional (CMP)"],
};

export const SAMPLE_CORPORATE: ResumeContent = {
  name: "Charlotte Whitfield",
  headline: "Senior Associate, Corporate Finance",
  email: "charlotte.whitfield@example.com",
  phone: "+44 7700 900417",
  location: "London, UK",
  linkedin: "linkedin.com/in/charlotte-whitfield-example",
  links: [],
  summary:
    "Corporate finance professional with seven years of experience in mid-market M&A, refinancing and valuation advisory. Leads deal workstreams from first model to completion, manages junior analysts and is trusted by founders and private equity sponsors for clear, careful advice.",
  experience: [
    {
      title: "Senior Associate",
      company: "Harrowgate Partners LLP",
      location: "London, UK",
      start: "Sep 2021",
      end: "Present",
      bullets: [
        "Led the financial workstream on 9 completed transactions with a combined enterprise value of £640M.",
        "Built and reviewed integrated three-statement models, LBO cases and sensitivity analyses for investment committees.",
        "Managed due diligence with legal, tax and commercial advisers across UK and Benelux targets.",
        "Supervise three analysts and run the team's quarterly modelling standards review.",
      ],
    },
    {
      title: "Valuations Associate",
      company: "Calder & Finch Advisory",
      location: "Manchester, UK",
      start: "Aug 2018",
      end: "Aug 2021",
      bullets: [
        "Prepared valuations for purchase price allocation, impairment testing and shareholder disputes.",
        "Delivered 40+ engagements across manufacturing, retail and software clients.",
        "Introduced a shared comparables database that cut benchmarking time by roughly a third.",
      ],
    },
    {
      title: "Graduate Audit Analyst",
      company: "Northbank Accountants",
      location: "Leeds, UK",
      start: "Sep 2016",
      end: "Jul 2018",
      bullets: [
        "Audited statutory accounts for owner-managed businesses with turnover up to £80M.",
        "Passed all ACA exams at first attempt while working full time.",
      ],
    },
  ],
  education: [
    {
      institution: "University of Warwick",
      degree: "BSc Accounting and Finance, First Class Honours",
      dates: "2013 – 2016",
      details: [],
    },
  ],
  skills: [
    "Financial modelling",
    "M&A due diligence",
    "Valuation",
    "LBO analysis",
    "Debt advisory",
    "Stakeholder management",
    "Microsoft Excel",
    "PowerPoint",
    "Capital IQ",
  ],
  certifications: ["Chartered Accountant (ACA), ICAEW", "CFA Level II Candidate"],
};

export const SAMPLE_SENIOR: ResumeContent = {
  name: "Grace Oyelaran",
  headline: "Director, Supply Chain Operations",
  email: "grace.oyelaran@example.com",
  phone: "(416) 555-0173",
  location: "Toronto, ON",
  linkedin: "linkedin.com/in/grace-oyelaran-example",
  links: [],
  summary:
    "Supply chain leader with 17 years of experience across distribution, procurement and planning for consumer goods and healthcare products. Has run networks of up to six distribution centres and 900 staff, delivered multi-year cost programmes and built planning teams that executives trust. Calm in a crisis, rigorous with data and committed to developing people.",
  experience: [
    {
      title: "Director of Supply Chain Operations",
      company: "Maplecrest Health Products",
      location: "Toronto, ON",
      start: "Mar 2020",
      end: "Present",
      bullets: [
        "Lead a national network of 6 distribution centres, 900 employees and a $210M annual operating budget.",
        "Delivered a three-year network redesign that reduced cost per unit shipped by 14% while improving on-time delivery to 98.6%.",
        "Kept critical medical supplies in stock through the 2020–2022 disruptions by qualifying 22 alternate suppliers in under a year.",
        "Introduced sales and operations planning with finance and commercial teams, lifting forecast accuracy from 71% to 86%.",
        "Sponsor the company's women-in-operations mentoring programme, now in its fourth cohort.",
      ],
    },
    {
      title: "Senior Distribution Manager",
      company: "Northway Consumer Brands",
      location: "Mississauga, ON",
      start: "Jun 2015",
      end: "Feb 2020",
      bullets: [
        "Ran two high-volume distribution centres shipping 40M cases a year to retail and e-commerce customers.",
        "Implemented a new warehouse management system across both sites on schedule and 6% under budget.",
        "Reduced recordable safety incidents by 58% through daily safety huddles and a near-miss reporting app.",
        "Negotiated a five-year third-party logistics agreement worth $48M with performance-based pricing.",
      ],
    },
    {
      title: "Procurement and Planning Manager",
      company: "Northway Consumer Brands",
      location: "Mississauga, ON",
      start: "Apr 2011",
      end: "May 2015",
      bullets: [
        "Managed $120M of annual spend across packaging, raw materials and freight.",
        "Built the first supplier scorecard, used to consolidate the supplier base from 140 to 85 vendors.",
        "Led a team of 8 planners and buyers; three were later promoted into management roles.",
      ],
    },
    {
      title: "Operations Analyst",
      company: "Lakeshore Logistics",
      location: "Hamilton, ON",
      start: "Jul 2008",
      end: "Mar 2011",
      bullets: [
        "Modelled labour and space requirements for new client onboarding at four warehouses.",
        "Automated weekly KPI reporting, saving the operations team around 10 hours a week.",
        "Supported the rollout of handheld scanning across 300 warehouse associates.",
      ],
    },
    {
      title: "Logistics Coordinator",
      company: "Trillium Freight Services",
      location: "Oakville, ON",
      start: "Jun 2006",
      end: "Jun 2008",
      bullets: [
        "Booked and tracked 150+ truckload and LTL shipments a week for retail and industrial customers.",
        "Resolved carrier claims and delivery exceptions, recovering $85K in freight overcharges.",
        "Worked part time while completing an engineering degree, moving to full time in the final year.",
      ],
    },
  ],
  education: [
    {
      institution: "York University",
      degree: "MBA, Operations Management",
      dates: "2012 – 2014",
      details: [],
    },
    {
      institution: "McMaster University",
      degree: "B.Eng. Industrial Engineering",
      dates: "2004 – 2008",
      details: [],
    },
  ],
  skills: [
    "Operations Management: Multi-site operations, Budget ownership, Change management, Talent development",
    "Supply Chain: Network design, S&OP, Procurement, 3PL management, Warehouse automation",
    "Systems: SAP S/4HANA, Manhattan WMS, Power BI, Microsoft Excel",
  ],
  certifications: [
    "Supply Chain Management Professional (SCMP), Supply Chain Canada",
    "Lean Six Sigma Black Belt",
    "APICS Certified in Planning and Inventory Management (CPIM)",
  ],
};

export const SAMPLE_SERIF: ResumeContent = {
  name: "Margot Ellison",
  headline: "Senior Editor, Non-Fiction",
  email: "margot.ellison@example.com",
  phone: "+61 491 570 156",
  location: "Melbourne, VIC",
  linkedin: "linkedin.com/in/margot-ellison-example",
  links: [],
  summary:
    "Editor with ten years of experience acquiring and developing narrative non-fiction, memoir and popular science. Works closely with first-time and established authors from proposal to publication, and has edited three titles shortlisted for national literary prizes.",
  experience: [
    {
      title: "Senior Editor",
      company: "Wattle & Quill Publishing",
      location: "Melbourne, VIC",
      start: "Feb 2020",
      end: "Present",
      bullets: [
        "Acquire and edit 8 to 10 titles a year, from offer to publication.",
        "Edited a debut memoir that sold 60,000 copies and was shortlisted for a national award.",
        "Lead the list's acquisitions meetings and present new titles to sales and marketing teams.",
      ],
    },
    {
      title: "Editor",
      company: "Southerly Books",
      location: "Sydney, NSW",
      start: "Mar 2016",
      end: "Jan 2020",
      bullets: [
        "Structurally edited and copyedited 30+ titles across history, science and current affairs.",
        "Commissioned an essay anthology that became the imprint's best-selling title of 2018.",
        "Coordinated freelance proofreaders, indexers and designers on tight schedules.",
      ],
    },
    {
      title: "Editorial Assistant",
      company: "Harbour Street Press",
      location: "Sydney, NSW",
      start: "Jan 2014",
      end: "Feb 2016",
      bullets: [
        "Assessed unsolicited manuscripts and wrote reader reports for the publishing director.",
        "Prepared cover copy, author biographies and metadata for 25 titles a year.",
      ],
    },
  ],
  education: [
    {
      institution: "University of Melbourne",
      degree: "Master of Publishing and Communications",
      dates: "2012 – 2013",
      details: [],
    },
    {
      institution: "University of Sydney",
      degree: "Bachelor of Arts, English Literature and History",
      dates: "2008 – 2011",
      details: [],
    },
  ],
  skills: [
    "Structural editing",
    "Copyediting",
    "Acquisitions",
    "Author development",
    "Proposal assessment",
    "Production scheduling",
    "Australian Manual of Style",
    "InDesign",
  ],
  certifications: ["Accredited Editor (AE), Institute of Professional Editors"],
};

export const SAMPLE_ACCENT: ResumeContent = {
  name: "Amara Nwosu",
  headline: "Clinical Nurse Lead, Cardiac Care",
  email: "amara.nwosu@example.com",
  phone: "(713) 555-0148",
  location: "Houston, TX",
  linkedin: "linkedin.com/in/amara-nwosu-example",
  links: [],
  summary:
    "Registered nurse with nine years of acute care experience, the last five in cardiac step-down and telemetry. Leads a unit of 32 nurses on day shift, champions evidence-based practice and is known for calm escalation and patient education that families remember.",
  experience: [
    {
      title: "Clinical Nurse Lead, Cardiac Step-Down",
      company: "Bayou Ridge Medical Center",
      location: "Houston, TX",
      start: "May 2021",
      end: "Present",
      bullets: [
        "Coordinate day-shift care for a 28-bed unit and a team of 32 RNs and patient care technicians.",
        "Led a falls-prevention project that cut unit falls by 41% over 12 months.",
        "Precept new graduate nurses; 11 of 12 completed orientation and stayed beyond their first year.",
        "Partner with cardiology and pharmacy on discharge teaching, lowering 30-day readmissions by 9%.",
      ],
    },
    {
      title: "Registered Nurse, Telemetry",
      company: "Bayou Ridge Medical Center",
      location: "Houston, TX",
      start: "Jun 2018",
      end: "Apr 2021",
      bullets: [
        "Cared for 4 to 5 telemetry patients per shift, including post-cardiac catheterization recovery.",
        "Served on the unit practice council and rewrote the heparin titration quick reference.",
        "Charge nurse on rotation for a 24-bed unit.",
      ],
    },
    {
      title: "Registered Nurse, Medical-Surgical",
      company: "Gulf Coast Community Hospital",
      location: "Galveston, TX",
      start: "Aug 2016",
      end: "May 2018",
      bullets: [
        "Provided post-operative and medical care for adult patients on a 32-bed unit.",
        "Recognized with the hospital's DAISY Award for compassionate care in 2017.",
      ],
    },
  ],
  education: [
    {
      institution: "University of Texas Medical Branch",
      degree: "Bachelor of Science in Nursing",
      dates: "2012 – 2016",
      details: [],
    },
  ],
  skills: [
    "Cardiac monitoring",
    "Telemetry",
    "Patient education",
    "Charge nurse",
    "Preceptorship",
    "Quality improvement",
    "Epic EHR",
    "Pyxis",
  ],
  certifications: [
    "Registered Nurse, Texas Board of Nursing",
    "Progressive Care Certified Nurse (PCCN)",
    "Advanced Cardiovascular Life Support (ACLS)",
  ],
};

export const SAMPLE_SPLIT: ResumeContent = {
  name: "Kenji Watanabe",
  headline: "Senior Product Designer",
  email: "kenji.watanabe@example.com",
  phone: "(604) 555-0129",
  location: "Vancouver, BC",
  linkedin: "linkedin.com/in/kenji-watanabe-example",
  links: [],
  summary:
    "Product designer with eight years of experience shaping B2B and fintech products from research to release. Pairs closely with engineering and product, runs scrappy research when data is thin, and builds design systems that teams actually adopt.",
  experience: [
    {
      title: "Senior Product Designer",
      company: "Tidewater Payments",
      location: "Vancouver, BC",
      start: "Jan 2022",
      end: "Present",
      bullets: [
        "Lead design for merchant onboarding, which now converts 23% more sign-ups to active accounts.",
        "Built and maintain a design system of 90+ components used by 6 product squads.",
        "Run monthly usability studies with 8 to 10 merchants and share findings with leadership.",
        "Coach 3 designers through portfolio reviews and weekly critiques.",
      ],
    },
    {
      title: "Product Designer",
      company: "Northgrid Software",
      location: "Victoria, BC",
      start: "Apr 2018",
      end: "Dec 2021",
      bullets: [
        "Redesigned the scheduling workflow for field service teams, cutting task time by 35%.",
        "Introduced journey mapping and service blueprints, now used in all 4 product planning cycles a year.",
        "Shipped an accessible colour palette and keyboard patterns that met WCAG 2.1 AA across 40 screens.",
      ],
    },
    {
      title: "UX Designer",
      company: "Pacific Harbour Digital",
      location: "Vancouver, BC",
      start: "Jun 2016",
      end: "Mar 2018",
      bullets: [
        "Designed responsive websites and apps for 15+ retail, tourism and non-profit clients.",
        "Facilitated discovery workshops and turned findings into wireframes and prototypes.",
      ],
    },
  ],
  education: [
    {
      institution: "Emily Carr University of Art and Design",
      degree: "Bachelor of Design, Interaction Design",
      dates: "2012 – 2016",
      details: [],
    },
  ],
  skills: [
    "Product design",
    "User research",
    "Prototyping",
    "Design systems",
    "Accessibility",
    "Figma",
    "FigJam",
    "Maze",
    "HTML",
    "CSS",
  ],
  certifications: ["Certified Professional in Accessibility Core Competencies (CPACC)"],
};

export const SAMPLE_MONOGRAM: ResumeContent = {
  name: "Lucia Ferraro",
  headline: "Hotel General Manager",
  email: "lucia.ferraro@example.com",
  phone: "+61 491 570 112",
  location: "Sydney, NSW",
  linkedin: "linkedin.com/in/lucia-ferraro-example",
  links: [],
  summary:
    "Hotel general manager with 14 years in luxury and boutique hospitality across Australia and Italy. Leads teams through openings, renovations and repositioning, with a track record of lifting guest scores and profit together. Fluent in English and Italian.",
  experience: [
    {
      title: "General Manager",
      company: "The Lantern House Hotel",
      location: "Sydney, NSW",
      start: "Jul 2020",
      end: "Present",
      bullets: [
        "Run a 164-room boutique hotel with two restaurants, a rooftop bar and 210 team members.",
        "Grew RevPAR by 27% in two years while holding guest satisfaction above 94%.",
        "Led a $12M room renovation delivered in phases with no full-floor closures.",
        "Rebuilt the leadership team and cut annual staff turnover from 48% to 29%.",
      ],
    },
    {
      title: "Hotel Manager",
      company: "Coastline Collection Resorts",
      location: "Byron Bay, NSW",
      start: "Mar 2016",
      end: "Jun 2020",
      bullets: [
        "Oversaw rooms, food and beverage and events for a 92-room beachfront resort.",
        "Launched a weddings and retreats programme that added $2.1M in annual revenue.",
        "Introduced revenue management reviews that lifted average daily rate by 15%.",
      ],
    },
    {
      title: "Front Office Manager",
      company: "Albergo San Lorenzo",
      location: "Florence, Italy",
      start: "Apr 2011",
      end: "Feb 2016",
      bullets: [
        "Managed reception, concierge and reservations for a 70-room heritage hotel.",
        "Trained a multilingual front office team of 18 in service standards and upselling.",
      ],
    },
  ],
  education: [
    {
      institution: "Blue Mountains International Hotel Management School",
      degree: "Bachelor of Business, International Hotel and Resort Management",
      dates: "2007 – 2010",
      details: [],
    },
  ],
  skills: [
    "Hotel operations",
    "Revenue management",
    "P&L ownership",
    "Pre-opening",
    "Guest experience",
    "Team leadership",
    "Opera PMS",
    "Italian (fluent)",
  ],
  certifications: ["Certified Hotel Administrator (CHA)", "Responsible Service of Alcohol (RSA), NSW"],
};

export const SAMPLE_BAND: ResumeContent = {
  name: "Aisha Rahman",
  headline: "Data Analyst",
  email: "aisha.rahman@example.com",
  phone: "+44 7700 900634",
  location: "Manchester, UK",
  linkedin: "linkedin.com/in/aisha-rahman-example",
  links: [],
  summary:
    "Data analyst with five years of experience turning messy operational data into dashboards and analysis that people act on. Comfortable from SQL to stakeholder workshop, with a focus on retail and public transport data.",
  experience: [
    {
      title: "Data Analyst",
      company: "Greater Pennine Transport",
      location: "Manchester, UK",
      start: "Mar 2022",
      end: "Present",
      bullets: [
        "Built a ridership dashboard used daily by 120 planners and managers across the network.",
        "Analysed ticketing and journey data to support a timetable change that cut overcrowding by 18%.",
        "Automated monthly performance reporting in Python, freeing four days of analyst time each month.",
        "Run fortnightly data clinics that teach colleagues to answer their own questions in Power BI.",
      ],
    },
    {
      title: "Junior Data Analyst",
      company: "Hartley & Moss Retail",
      location: "Leeds, UK",
      start: "Sep 2019",
      end: "Feb 2022",
      bullets: [
        "Maintained weekly sales and stock reports for 140 stores and the online channel.",
        "Built a markdown analysis that helped reduce end-of-season stock write-offs by 12%.",
        "Cleaned and documented the loyalty data model, reducing ad hoc query errors.",
      ],
    },
    {
      title: "Research Assistant (Part-Time)",
      company: "Northern Lights Research",
      location: "Leeds, UK",
      start: "Jun 2018",
      end: "Jul 2019",
      bullets: [
        "Coded open-ended survey responses and prepared charts for client presentations.",
        "Wrote a short guide to weighting survey samples, used to onboard 6 new assistants.",
      ],
    },
  ],
  education: [
    {
      institution: "University of Leeds",
      degree: "BSc Mathematics and Statistics",
      dates: "2016 – 2019",
      details: [],
    },
  ],
  skills: ["SQL", "Python", "pandas", "Power BI", "Tableau", "Microsoft Excel", "dbt", "Statistics", "Data visualisation"],
  certifications: ["Microsoft Certified: Power BI Data Analyst Associate", "Google Data Analytics Certificate"],
};

export const SAMPLE_RAIL: ResumeContent = {
  name: "Theo Laurent",
  headline: "Content Marketing Lead",
  email: "theo.laurent@example.com",
  phone: "(312) 555-0186",
  location: "Chicago, IL",
  linkedin: "linkedin.com/in/theo-laurent-example",
  links: ["theolaurent.example.com"],
  summary:
    "Content marketer with seven years of experience building editorial programmes for B2B software brands. Turns product expertise into stories, guides and newsletters that grow pipeline, and manages writers, freelancers and budgets with a steady hand.",
  experience: [
    {
      title: "Content Marketing Lead",
      company: "Brightfield Analytics",
      location: "Chicago, IL",
      start: "Feb 2022",
      end: "Present",
      bullets: [
        "Own the content strategy, editorial calendar and a team of 3 writers and 10 freelancers.",
        "Grew organic traffic from 40K to 210K monthly visits in 24 months.",
        "Launched a weekly newsletter that reached 38,000 subscribers and sources 15% of demo requests.",
        "Produced an annual industry report covered by four trade publications.",
      ],
    },
    {
      title: "Senior Content Marketer",
      company: "Lakeview Cloud",
      location: "Chicago, IL",
      start: "May 2019",
      end: "Jan 2022",
      bullets: [
        "Wrote and edited case studies, guides and webinars for a mid-market sales team.",
        "Built a customer story programme with 30 published case studies in two years.",
        "Ran SEO refreshes that recovered 60% of lost search traffic after a site migration.",
      ],
    },
    {
      title: "Marketing Coordinator",
      company: "Prairie State Media",
      location: "Springfield, IL",
      start: "Jul 2017",
      end: "Apr 2019",
      bullets: [
        "Managed social channels and email campaigns for regional news and events brands.",
        "Coordinated sponsor content for 12 live events a year.",
      ],
    },
    {
      title: "Editorial Intern",
      company: "Lakefront Weekly",
      location: "Chicago, IL",
      start: "Jun 2016",
      end: "Aug 2016",
      bullets: [
        "Wrote event listings and short profiles of local businesses for print and web.",
        "Fact-checked features and updated the newsroom style guide.",
      ],
    },
  ],
  education: [
    {
      institution: "Northwestern University",
      degree: "B.S. Journalism",
      dates: "2013 – 2017",
      details: [],
    },
  ],
  skills: ["Content strategy", "SEO", "Editing", "Newsletters", "Webinars", "HubSpot", "Google Analytics", "Ahrefs", "Webflow"],
  certifications: ["HubSpot Content Marketing Certification"],
};

export const SAMPLE_MAGAZINE: ResumeContent = {
  name: "Zoe Harrington",
  headline: "Features Journalist and Audio Producer",
  email: "zoe.harrington@example.com",
  phone: "(718) 555-0164",
  location: "Brooklyn, NY",
  linkedin: "linkedin.com/in/zoe-harrington-example",
  links: ["zoeharrington.example.com"],
  summary:
    "Features journalist with eight years of reporting on culture, cities and climate for print, web and podcasts. Finds the human story inside complex topics, files clean copy on deadline and produces audio from first interview to final mix.",
  experience: [
    {
      title: "Senior Features Writer",
      company: "The Hudson Ledger",
      location: "New York, NY",
      start: "Mar 2021",
      end: "Present",
      bullets: [
        "Report and write long-form features, averaging 2 cover stories a quarter.",
        "Created a six-part climate adaptation series read by 1.2M people online.",
        "Co-host and produce a weekly culture podcast with 45,000 regular listeners.",
        "Edit freelance pitches and mentor two fellows in the newsroom's training programme.",
      ],
    },
    {
      title: "Staff Writer",
      company: "Metro Weekly Review",
      location: "Philadelphia, PA",
      start: "Jun 2018",
      end: "Feb 2021",
      bullets: [
        "Covered arts, food and neighborhood change with 3 to 4 published pieces a week.",
        "Broke a story on venue closures that led to a city relief fund for small stages.",
        "Shot and edited photos and short video for social versions of each story.",
      ],
    },
    {
      title: "Reporting Fellow",
      company: "Delaware Valley Public Radio",
      location: "Philadelphia, PA",
      start: "Sep 2016",
      end: "May 2018",
      bullets: [
        "Produced daily news spots and two-way interviews for morning drive time.",
        "Reported a three-part series on river cleanup that won a regional broadcasting award.",
      ],
    },
  ],
  education: [
    {
      institution: "Columbia University",
      degree: "M.S. Journalism",
      dates: "2015 – 2016",
      details: [],
    },
    {
      institution: "Temple University",
      degree: "B.A. English",
      dates: "2011 – 2015",
      details: [],
    },
  ],
  skills: ["Long-form features", "Interviewing", "Audio production", "Fact-checking", "Photography", "Adobe Audition", "Descript", "Premiere Pro"],
  certifications: ["Investigative Reporters and Editors Data Bootcamp"],
};

export const SAMPLE_NOIR: ResumeContent = {
  name: "Diego Alvarez",
  headline: "Creative Director, Film and Brand",
  email: "diego.alvarez@example.com",
  phone: "(305) 555-0192",
  location: "Miami, FL",
  linkedin: "linkedin.com/in/diego-alvarez-example",
  links: ["diegoalvarez.example.com"],
  summary:
    "Creative director with eleven years of experience leading campaigns, short films and brand launches for travel, music and fashion clients. Builds and directs small, sharp teams, writes the idea and stays with it through edit, grade and delivery.",
  experience: [
    {
      title: "Creative Director",
      company: "Palmetto Light Studio",
      location: "Miami, FL",
      start: "Jan 2020",
      end: "Present",
      bullets: [
        "Lead a team of 14 designers, editors and producers across campaign, film and social work.",
        "Directed a hotel brand film that won a regional advertising award and passed 3M views.",
        "Grew retained clients from 4 to 11 while keeping studio margin above 30%.",
        "Introduced a pitch process that lifted the new-business win rate from 22% to 41%.",
      ],
    },
    {
      title: "Associate Creative Director",
      company: "Coral & Signal",
      location: "Miami, FL",
      start: "Apr 2016",
      end: "Dec 2019",
      bullets: [
        "Concepted and shot campaigns for music festivals, airlines and a regional fashion label.",
        "Managed production budgets up to $600K across shoots in four countries.",
        "Hired and mentored the agency's first in-house motion design team.",
      ],
    },
    {
      title: "Video Producer and Editor",
      company: "Southbeach Media",
      location: "Miami, FL",
      start: "Jun 2013",
      end: "Mar 2016",
      bullets: [
        "Produced and edited 200+ branded videos for hospitality and lifestyle clients.",
        "Built the studio's colour-grading workflow and asset library.",
      ],
    },
  ],
  education: [
    {
      institution: "Florida State University",
      degree: "BFA Film Production",
      dates: "2009 – 2013",
      details: [],
    },
  ],
  skills: ["Creative direction", "Brand film", "Art direction", "Copywriting", "Pitching", "Premiere Pro", "DaVinci Resolve", "After Effects"],
  certifications: ["Adobe Certified Professional, Premiere Pro"],
};

/** The sample that best shows off each template. */
export function sampleFor(template: TemplateId): ResumeContent {
  switch (template) {
    case "technical":
      return SAMPLE_TECHNICAL;
    case "entry":
      return SAMPLE_ENTRY;
    case "executive":
      return SAMPLE_EXECUTIVE;
    case "compact":
      return SAMPLE_COMPACT;
    case "modern":
      return SAMPLE_MODERN;
    case "minimal":
      return SAMPLE_MINIMAL;
    case "bold":
      return SAMPLE_BOLD;
    case "timeline":
      return SAMPLE_TIMELINE;
    case "sidebar":
      return SAMPLE_SIDEBAR;
    case "studio":
      return SAMPLE_STUDIO;
    case "corporate":
      return SAMPLE_CORPORATE;
    case "senior":
      return SAMPLE_SENIOR;
    case "serif":
      return SAMPLE_SERIF;
    case "accent":
      return SAMPLE_ACCENT;
    case "split":
      return SAMPLE_SPLIT;
    case "monogram":
      return SAMPLE_MONOGRAM;
    case "band":
      return SAMPLE_BAND;
    case "rail":
      return SAMPLE_RAIL;
    case "magazine":
      return SAMPLE_MAGAZINE;
    case "noir":
      return SAMPLE_NOIR;
    default:
      return SAMPLE_CONTENT;
  }
}
