import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: `The terms for using ${site.name}'s free resume checker, resume builder and LinkedIn profile analyzer.`,
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <div className="container-page pt-12 sm:pt-20">
      <div className="max-w-2xl">
        <p className="eyebrow">Terms of use</p>
        <h1 className="mt-3 font-display text-[2.3rem] leading-[1.12] sm:text-[3.2rem]">The short version.</h1>
        <p className="mt-4 text-ink-muted">Last updated 12 October 2026.</p>
      </div>
      <div className="glass-strong mt-10 max-w-3xl px-6 py-4 sm:px-12 sm:py-8">
        <div className="prose-guide">
          <h2>Using the tools</h2>
          <p>
            {site.name} is free to use for checking, improving and building your own resume and analysing your own
            LinkedIn profile. Please only upload documents you have the right to use. Automated or bulk use, and
            attempts to get around the usage limits, aren&apos;t allowed.
          </p>
          <h2>Scores are guidance, not guarantees</h2>
          <p>
            Our scores apply published, fixed rules about how resumes are commonly parsed and searched. Every employer
            configures its system differently, and people make hiring decisions. A high score is strong evidence your
            resume will be read correctly; it is not a promise of interviews or offers.
          </p>
          <h2>AI suggestions</h2>
          <p>
            AI-written suggestions are drafts. They&apos;re instructed to use only facts you provided, and to leave a{" "}
            <code>[metric]</code> placeholder rather than invent a number, but they can still be wrong. You are
            responsible for checking that everything on your resume or profile is accurate before you use it.
          </p>
          <h2>Your content</h2>
          <p>
            You keep all rights to what you upload and create. We don&apos;t claim any ownership of it and don&apos;t
            keep it; see the <Link href="/privacy">privacy policy</Link> for exactly what happens to your files.
          </p>
          <h2>Templates</h2>
          <p>
            The resume templates are free for you to use for your own job applications. Templates marked{" "}
            <em>Not for ATS uploads</em> are designed for sending directly to a person and may not parse well in an
            applicant tracking system.
          </p>
          <h2>Availability</h2>
          <p>
            The service is provided as is. We aim to keep it running and accurate, but we can&apos;t guarantee it will
            always be available or error-free, and features such as AI rewrites have daily limits.
          </p>
          <h2>Not affiliated</h2>
          <p>
            {site.name} is independent and isn&apos;t affiliated with or endorsed by LinkedIn or any applicant tracking
            system vendor.
          </p>
        </div>
      </div>
    </div>
  );
}
