import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, ldIds, orgRef } from "@/components/json-ld";
import { site } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/about",
  title: `About ${site.name}: Free, Honest Resume Tools`,
  absoluteTitle: true,
  description:
    "Why Parsewise exists: free, honest tools that show job seekers what an applicant tracking system actually reads from their resume and LinkedIn profile.",
});

const principles: [string, string][] = [
  [
    "Show the evidence first",
    "Every score breaks down into named checks that quote your own text. You can see what the parser extracted before you see a number.",
  ],
  [
    "Scores come from rules, not AI",
    "The same file always gets the same score. AI is used only to write suggestions you ask for, and it is told never to invent employers, dates or numbers.",
  ],
  [
    "Your files are not our product",
    "Uploads are processed in memory and discarded. There are no accounts, no database of resumes and nothing to sell.",
  ],
  [
    "Say what we can't measure",
    "We don't simulate one vendor's ATS, predict interviews, or score parts of a LinkedIn profile that the PDF doesn't contain. We say so where it matters.",
  ],
];

export default function About() {
  return (
    <div className="container-page pt-12 sm:pt-20">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: `About ${site.name}`,
          url: `${site.url}/about`,
          about: orgRef(),
          isPartOf: { "@id": ldIds.website() },
        }}
      />
      <div className="max-w-3xl">
        <p className="eyebrow">About</p>
        <h1 className="mt-3 font-display text-[2.3rem] leading-[1.12] sm:text-[3.3rem]">
          Resume tools that show their working.
        </h1>
        <p className="mt-5 text-[1.06rem] leading-relaxed text-ink-muted">
          Most resume checkers give you a single &ldquo;ATS score&rdquo; and a list of upsells. The real problem is
          quieter: when a resume parses badly, its details are stored empty or scrambled, and it never comes up when a
          recruiter searches. {site.name} was built to make that visible, and to help you fix it for free.
        </p>
      </div>

      <section className="mt-12 grid gap-5 md:grid-cols-2" aria-label="What we believe">
        {principles.map(([t, d]) => (
          <div key={t} className="glass p-6 sm:p-8">
            <h2 className="font-serif text-[1.6rem] leading-tight">{t}</h2>
            <p className="mt-2 text-ink-muted">{d}</p>
          </div>
        ))}
      </section>

      <section className="glass-strong mt-12 p-7 sm:p-10" aria-labelledby="tools-h">
        <h2 id="tools-h" className="font-serif text-[2rem] leading-tight">
          What you can do here
        </h2>
        <ul className="mt-6 grid gap-6 md:grid-cols-2">
          <li>
            <Link href="/" className="font-medium underline decoration-rule-strong underline-offset-4 hover:text-accent">
              Check a resume
            </Link>
            <p className="mt-1 text-sm text-ink-muted">
              See what a parser extracts, get an ATS score out of 100, and compare against a job description.
            </p>
          </li>
          <li>
            <Link href="/builder" className="font-medium underline decoration-rule-strong underline-offset-4 hover:text-accent">
              Build or rebuild a resume
            </Link>
            <p className="mt-1 text-sm text-ink-muted">
              Approve suggested fixes or start from scratch, then download a clean Word or PDF file.
            </p>
          </li>
          <li>
            <Link href="/linkedin" className="font-medium underline decoration-rule-strong underline-offset-4 hover:text-accent">
              Analyze a LinkedIn profile
            </Link>
            <p className="mt-1 text-sm text-ink-muted">Score your profile PDF and get headline and About drafts.</p>
          </li>
          <li>
            <Link href="/how-it-works" className="font-medium underline decoration-rule-strong underline-offset-4 hover:text-accent">
              Read the scoring method
            </Link>
            <p className="mt-1 text-sm text-ink-muted">Every check, its weight, and what we deliberately don&apos;t claim.</p>
          </li>
        </ul>
      </section>

      <p className="mt-10 max-w-2xl text-sm text-ink-muted">
        {site.name} is independent and not affiliated with LinkedIn, Workday, Greenhouse or any other applicant tracking
        system vendor. Product names are used only to describe how they work.
      </p>
    </div>
  );
}
