"use client";

import { useState } from "react";
import type { AnalysisResult, Check } from "@/lib/types";
import { anchorFor, scoreBand, sortChecks, statusBg, statusColor, StatusMark, type ScoreKind } from "./ui";

export function ScoreSummary({ result }: { result: AnalysisResult }) {
  const by = (cats: Check["category"][]) => result.checks.filter((c) => cats.includes(c.category));
  return (
    <div className="glass grid overflow-hidden lg:grid-cols-3">
      <ScoreCard
        kind="parse"
        title="Parse Integrity"
        blurb="How much of your resume survives being read by a parser: text, contact details, dates, headings and layout."
        score={result.scores.parseIntegrity}
        checks={by(["extraction", "layout"])}
      />
      <ScoreCard
        kind="content"
        title="Content"
        blurb="Conventions recruiters expect: quantified bullets, strong openers, no gaps left unexplained."
        score={result.scores.content}
        checks={by(["content"])}
      />
      {result.scores.jobMatch === null ? (
        <div className="flex flex-col justify-between gap-4 border-t border-[var(--glass-line)] p-6 sm:p-7 lg:border-l lg:border-t-0">
          <div>
            <h2 className="eyebrow">Job Match</h2>
            <p className="mt-3 font-serif text-2xl leading-tight">Not scored yet</p>
            <p className="mt-2 text-sm text-ink-muted">
              There is no honest match score without a job to match against. Paste a job description to see
              which of its keywords and title your resume is missing.
            </p>
          </div>
          <a href="#job-match" className="btn btn-secondary self-start">
            Add a job description
          </a>
        </div>
      ) : (
        <ScoreCard
          kind="match"
          title="Job Match"
          blurb="Overlap with the job description you pasted: job title, hard skills and other keywords."
          score={result.scores.jobMatch}
          checks={by(["match"])}
        />
      )}
    </div>
  );
}

function ScoreCard({
  kind,
  title,
  blurb,
  score,
  checks,
}: {
  kind: ScoreKind;
  title: string;
  blurb: string;
  score: number;
  checks: Check[];
}) {
  const [open, setOpen] = useState(false);
  const band = scoreBand(kind, score);
  const passed = checks.filter((c) => c.status === "pass").length;
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0) || 1;
  const sorted = sortChecks(checks);
  const borders = kind === "parse" ? "" : "border-t border-[var(--glass-line)] lg:border-l lg:border-t-0";

  return (
    <section className={`p-6 sm:p-7 ${borders}`} aria-label={`${title} score`}>
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-3 flex items-end gap-3">
        <span className="font-display text-[4.25rem] leading-[0.85] tracking-tight tabular-nums">{score}</span>
        <span className="pb-1 text-sm text-ink-muted">/ 100</span>
        <span className={`ml-auto pb-1 text-sm font-medium ${statusColor[band.tone]}`}>{band.label}</span>
      </div>

      {/* One segment per check, width by weight, coloured by status: the score, decomposed. */}
      <div className="mt-5 flex h-2 gap-[3px] overflow-hidden rounded-full bg-ink/5" aria-hidden="true">
        {sorted.map((c) => (
          <span
            key={c.id}
            title={`${c.title}: ${c.status}`}
            className={`${statusBg[c.status]} rounded-full ${c.status === "pass" ? "opacity-75" : ""}`}
            style={{ flexGrow: c.weight / totalWeight }}
          />
        ))}
      </div>

      <p className="mt-4 text-sm text-ink-muted">{blurb}</p>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium hover:text-accent"
      >
        <Caret open={open} />
        {passed} of {checks.length} checks passed
      </button>

      {open && (
        <ul className="glass-well mt-3 divide-y divide-[var(--glass-line)] px-3 text-sm">
          {sorted.map((c) => (
            <li key={c.id}>
              <a href={`#${anchorFor(c.id)}`} className="flex items-center gap-3 py-2 hover:text-accent">
                <StatusMark status={c.status} />
                <span className="flex-1">{c.title}</span>
                <span className="font-mono text-xs text-ink-faint tabular-nums">
                  {c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0}/{c.weight}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={`transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
