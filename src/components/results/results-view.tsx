"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { setSession, useSession } from "@/lib/client/session";
import { Uploader } from "@/components/uploader";
import { ExportPanel } from "./export-panel";
import { ExtractionPreview } from "./extraction-preview";
import { IssueList } from "./issue-list";
import { JobMatch } from "./job-match";
import { ScoreSummary } from "./score-summary";
import { AtsHero } from "./ats-hero";

export function ResultsView() {
  const session = useSession();
  const onClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  if (!onClient) {
    return <div className="container-page min-h-[60vh] py-14" aria-busy="true" />;
  }

  if (!session) {
    return (
      <div className="container-page py-12 sm:py-16">
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">No resume checked yet</h1>
        <p className="mt-3 max-w-prose text-ink-muted">
          Results only live in this browser tab and disappear when you close it. Check a file to see them.
        </p>
        <div className="mt-8">
          <Uploader />
        </div>
      </div>
    );
  }

  const { result, file, fileName, jd, accepted } = session;
  const nonMatch = result.checks.filter((c) => c.category !== "match");
  const toFix = nonMatch.filter((c) => c.status !== "pass").length;
  const noText = result.checks.some((c) => c.id === "extraction.text" && c.status === "fail");
  const roleHint = result.match?.jobTitle ?? result.profile.experience[0]?.title ?? null;
  const pages = result.document.pageCount;

  return (
    <div className="pb-8">
      <div className="container-page pt-10 sm:pt-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow break-all">
              {fileName} · {result.document.kind.toUpperCase()}
              {pages ? ` · ${pages} ${pages === 1 ? "page" : "pages"}` : ""} · {result.document.wordCount} words
            </p>
            <h1 className="mt-3 font-display text-[2.2rem] leading-[1.12] sm:text-[3.2rem]">
              {noText ? "The parser saw nothing." : "This is what the parser saw."}
            </h1>
          </div>
          <Link
            href="/#check"
            onClick={() => setSession(null)}
            className="btn btn-secondary self-start sm:self-auto"
          >
            Check another file
          </Link>
        </div>

        <div className="mt-8 space-y-5">
          <AtsHero scores={result.scores} checks={result.checks} />
          <ScoreSummary result={result} />
        </div>

        <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2 text-sm">
          {[
            ["#preview", "Parser view"],
            ["#issues", `What to fix · ${toFix}`],
            ["#job-match", "Job match"],
            ["#download", "Download a fixed version"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="btn btn-quiet">
              {label}
            </a>
          ))}
        </nav>
      </div>

      <Section id="preview" title="Your document, and what came out of it" lede="Compare the two. Every empty field and every merged role on the right is something a recruiter searching their system won't find.">
        <ExtractionPreview result={result} file={file} />
      </Section>

      <Section
        id="issues"
        title="What to fix"
        lede={
          toFix
            ? "Ordered by impact. Each one quotes your text and says exactly what to change."
            : "Nothing is blocking the parser or weakening your content."
        }
      >
        <div className="max-w-3xl">
          <IssueList checks={nonMatch} accepted={accepted} roleHint={roleHint} />
        </div>
      </Section>

      <Section
        id="job-match"
        title="Job match"
        lede="Recruiters find candidates by searching for a job's title and skills. This compares your resume against one specific posting, the only way a match score means anything."
      >
        <div className="max-w-3xl">
          <JobMatch key={result.match ? "has" : "none"} result={result} jd={jd} />
          {result.match && (
            <div className="mt-8">
              <IssueList
                checks={result.checks.filter((c) => c.category === "match")}
                accepted={accepted}
                roleHint={roleHint}
              />
            </div>
          )}
        </div>
      </Section>

      <Section
        id="download"
        title="Download a parse-safe version"
        lede="Your content, poured into a clean single-column layout with standard headings, body-only contact details and a system font. Want to approve fixes and edit first? Use the resume builder."
      >
        <div className="mb-6">
          <Link href="/improve" className="btn btn-primary">
            Improve and edit in the builder
          </Link>
        </div>
        <ExportPanel result={result} accepted={accepted} />
      </Section>
    </div>
  );
}

const noopSubscribe = () => () => {};

function Section({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="container-page scroll-mt-20 pt-16 sm:pt-24" aria-labelledby={`${id}-h`}>
      <div className="mb-7 max-w-2xl">
        <h2 id={`${id}-h`} className="font-serif text-[2rem] leading-[1.1] sm:text-[2.4rem]">
          {title}
        </h2>
        <p className="mt-2 text-ink-muted">{lede}</p>
      </div>
      {children}
    </section>
  );
}
