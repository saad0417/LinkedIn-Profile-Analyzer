import type { Metadata } from "next";
import Link from "next/link";
import { guides, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Resume & ATS Guides",
  description:
    "Plain-English guides to how applicant tracking systems read resumes: formatting that parses, keyword matching, and what ATS really do with your application.",
  alternates: { canonical: "/guides" },
  openGraph: { url: "/guides", title: `Resume & ATS Guides | ${site.name}` },
};

export default function GuidesIndex() {
  return (
    <div className="container-page pt-12 sm:pt-20">
      <div className="max-w-2xl">
        <p className="eyebrow">Guides</p>
        <h1 className="mt-3 font-display text-[2.3rem] leading-[1.12] sm:text-[3.4rem]">
          How resumes are really read.
        </h1>
        <p className="mt-5 text-[1.05rem] text-ink-muted">
          Short, sourced explanations of what applicant tracking systems do with your resume, and what that means
          for how you write and format it.
        </p>
      </div>
      <ul className="mt-12 grid gap-5 md:grid-cols-3">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`} className="glass group flex h-full flex-col p-6 transition-transform hover:-translate-y-0.5 sm:p-7">
              <p className="eyebrow">{g.short}</p>
              <h2 className="mt-3 font-serif text-[1.6rem] leading-[1.15] group-hover:text-accent">{g.title}</h2>
              <p className="mt-3 flex-1 text-sm text-ink-muted">{g.description}</p>
              <span className="mt-5 text-sm font-medium">Read the guide →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
