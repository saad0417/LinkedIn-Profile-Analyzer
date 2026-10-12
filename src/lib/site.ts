/**
 * The public origin every absolute URL is built from: canonical links, Open Graph URLs,
 * sitemap.xml, robots.txt and JSON-LD.
 *
 * Rules (this module is also bundled for the browser, so it only reads NEXT_PUBLIC_* values,
 * which are inlined at build time and identical on server and client):
 *
 * 1. NEXT_PUBLIC_SITE_URL set: it must be an absolute http(s) URL, otherwise we throw. A Vercel
 *    production build that points at localhost also throws.
 * 2. Unset on Vercel: fall back to https://<NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL>, the
 *    project's real production domain (Vercel exposes it automatically). Safe for canonicals.
 * 3. Unset in development: http://localhost:3000.
 * 4. Unset in any other production build: throw, so the build fails.
 *
 * Why fail rather than guess: a wrong origin does not break anything you can see. It quietly puts
 * localhost or a preview host into every canonical tag and the sitemap, and Search Console only
 * reports it weeks later. A failed build gets noticed straight away.
 */
function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  const vercelProductionHost = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (raw) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`NEXT_PUBLIC_SITE_URL is not a valid absolute URL (expected e.g. https://parsewise.app).`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error(`NEXT_PUBLIC_SITE_URL must start with https:// (got ${url.protocol}).`);
    }
    if (vercelEnv === "production" && /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(url.hostname)) {
      throw new Error("NEXT_PUBLIC_SITE_URL points at localhost in a Vercel production build. Set it to your real domain.");
    }
    // Origin plus any base path, never a trailing slash, query or hash.
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  }

  if (vercelEnv && vercelProductionHost) return `https://${vercelProductionHost.replace(/\/+$/, "")}`;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";

  throw new Error(
    "NEXT_PUBLIC_SITE_URL is not set. Set it to the public origin (e.g. https://parsewise.app) before building for production.",
  );
}

export const site = {
  name: "Parsewise",
  tagline: "See your resume the way an applicant tracking system reads it.",
  description:
    "Free ATS resume checker. Upload your resume to see exactly what an applicant tracking system extracts, what it drops and how to fix it. Nothing is stored.",
  url: resolveSiteUrl(),
  locale: "en_US",
  /** Brand colour used for theme-color, the manifest and generated images. */
  paper: "#faf8f4",
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
    /** <title> tag: search keyword first, kept under 60 characters with the " | Parsewise" suffix. */
    seoTitle: "ATS Resume Format: 8 Rules for Clean Parsing",
    short: "ATS resume format",
    description:
      "The formatting choices that break resume parsing, and the plain alternatives that do not: columns, tables, headers, fonts, dates and file type.",
    published: "2026-10-11",
    updated: "2026-10-11",
  },
  {
    slug: "do-ats-reject-resumes",
    title: "Do applicant tracking systems reject resumes automatically?",
    seoTitle: "Do ATS Reject Resumes Automatically? What's True",
    short: "Do ATS reject resumes?",
    description:
      "Most ATS do not score or auto-reject your resume. The real risk is quieter: a resume that parses badly never comes up when a recruiter searches.",
    published: "2026-10-11",
    updated: "2026-10-11",
  },
  {
    slug: "resume-keywords",
    title: "How to match resume keywords to a job description honestly",
    seoTitle: "Resume Keywords: How to Match a Job Description",
    short: "Resume keywords",
    description:
      "Which words in a job posting matter, how recruiters actually search an ATS, and how to add the right resume keywords to close gaps without stuffing.",
    published: "2026-10-11",
    updated: "2026-10-12",
  },
] as const;

export type Guide = (typeof guides)[number];

/**
 * Every indexable page, with the date its content last changed in a way a reader would notice.
 * Update `lastModified` when you edit a page's copy; Google ignores lastmod values that are
 * always "now", so these are deliberately hand-maintained rather than set to the build time.
 * Result and improve pages are client-only and noindex, so they are not listed here.
 */
export const indexablePages: { path: `/${string}`; lastModified: string; priority: number }[] = [
  { path: "/", lastModified: "2026-10-12", priority: 1 },
  { path: "/builder", lastModified: "2026-10-12", priority: 0.9 },
  { path: "/linkedin", lastModified: "2026-10-12", priority: 0.9 },
  { path: "/templates", lastModified: "2026-10-12", priority: 0.8 },
  { path: "/how-it-works", lastModified: "2026-10-12", priority: 0.7 },
  { path: "/guides", lastModified: "2026-10-12", priority: 0.7 },
  ...guides.map((g) => ({ path: `/guides/${g.slug}` as const, lastModified: g.updated, priority: 0.7 })),
  { path: "/about", lastModified: "2026-10-12", priority: 0.4 },
  { path: "/privacy", lastModified: "2026-10-12", priority: 0.3 },
  { path: "/terms", lastModified: "2026-10-12", priority: 0.3 },
];
