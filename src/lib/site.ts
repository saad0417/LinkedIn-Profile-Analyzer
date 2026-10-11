export const site = {
  name: "Parsewise",
  tagline: "See your resume the way an applicant tracking system reads it.",
  description:
    "Free ATS resume checker. Upload your CV and see exactly what an applicant tracking system extracts from it, what it drops, and how to fix it. Add a job description for a keyword match. Your file is never stored.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  locale: "en_US",
} as const;

export const nav = [
  { href: "/", label: "Resume checker" },
  { href: "/builder", label: "Resume builder" },
  { href: "/linkedin", label: "LinkedIn analyzer" },
  { href: "/templates", label: "Templates" },
  { href: "/guides", label: "Guides" },
] as const;

export const guides = [
  {
    slug: "ats-resume-format",
    title: "How to format a resume so an ATS can read it",
    short: "ATS resume format",
    description:
      "The formatting choices that break resume parsing, and the plain alternatives that do not: columns, tables, headers, fonts, dates and file type.",
    published: "2026-10-11",
  },
  {
    slug: "do-ats-reject-resumes",
    title: "Do applicant tracking systems reject resumes automatically?",
    short: "Do ATS reject resumes?",
    description:
      "Most ATS do not score or auto-reject your resume. The real risk is quieter: a resume that parses badly never comes up when a recruiter searches.",
    published: "2026-10-11",
  },
  {
    slug: "resume-keywords",
    title: "How to match resume keywords to a job description honestly",
    short: "Resume keywords",
    description:
      "Which words in a job posting matter, how recruiters actually search an ATS, and how to close keyword gaps without stuffing.",
    published: "2026-10-11",
  },
] as const;

export type Guide = (typeof guides)[number];
