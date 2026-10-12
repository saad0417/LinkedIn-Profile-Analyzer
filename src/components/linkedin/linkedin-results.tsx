"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { callLlm } from "@/lib/client/api";
import { setLinkedIn, useLinkedIn, type LinkedInSession } from "@/lib/client/linkedin-session";
import type { LinkedInAnalysis } from "@/lib/linkedin/types";
import { useAi } from "@/components/ai-context";
import { AiThinking, Busy, SkeletonLines, StepList } from "@/components/loading";
import { ScoreRing } from "@/components/results/ats-hero";
import { IssueList } from "@/components/results/issue-list";
import { LinkedInUploader } from "./linkedin-uploader";

const noop = () => () => {};

export function linkedInBand(score: number) {
  if (score >= 85) return { label: "Standout profile", tone: "pass" as const };
  if (score >= 70) return { label: "Strong, with gaps", tone: "warn" as const };
  if (score >= 50) return { label: "Needs work", tone: "fail" as const };
  return { label: "Easy to overlook", tone: "fail" as const };
}

export function LinkedInResultsView() {
  const session = useLinkedIn();
  const onClient = useSyncExternalStore(noop, () => true, () => false);
  if (!onClient) return <div className="container-page min-h-[60vh] py-14" aria-busy="true" />;
  if (!session) {
    return (
      <div className="container-page py-12 sm:py-16">
        <h1 className="font-display text-[2.2rem] leading-[1.12] sm:text-[3rem]">No profile analysed yet</h1>
        <p className="mt-3 max-w-prose text-ink-muted">Results only live in this browser tab. Upload your LinkedIn PDF to see them.</p>
        <div className="mt-8 max-w-2xl">
          <LinkedInUploader />
        </div>
      </div>
    );
  }
  return <Results session={session} />;
}

function Results({ session }: { session: LinkedInSession }) {
  const { result } = session;
  const p = result.profile;
  const band = linkedInBand(result.score);
  const checks = result.sections.flatMap((s) => s.checks);
  const open = checks.filter((c) => c.status !== "pass").length;

  return (
    <div className="container-page pt-10 sm:pt-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow">LinkedIn profile analysis</p>
          <h1 className="mt-3 font-display text-[2.2rem] leading-[1.12] sm:text-[3rem]">{p.name ?? "Your profile"}</h1>
          {p.headline && <p className="mt-2 text-ink-muted">{p.headline}</p>}
        </div>
        <Link href="/linkedin" onClick={() => setLinkedIn(null)} className="btn btn-secondary self-start sm:self-auto">
          Analyze another profile
        </Link>
      </div>

      {!result.looksLikeLinkedIn && (
        <p className="glass-thin mt-6 !border-warn/25 !bg-warn-soft/80 px-5 py-3 text-sm text-warn">
          This doesn&apos;t look like a LinkedIn &ldquo;Save to PDF&rdquo; export, so some sections may be missed. For the
          most accurate score, download the PDF directly from your LinkedIn profile.
        </p>
      )}

      <section className="glass-strong mt-8 grid gap-8 p-6 sm:p-8 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-12" aria-label="Profile score">
        <div className="flex items-center gap-6">
          <ScoreRing score={result.score} tone={band.tone} />
          <div className="lg:hidden">
            <p className="eyebrow">Profile score</p>
            <p className="mt-1 font-display text-2xl leading-tight">{band.label}</p>
          </div>
        </div>
        <div>
          <p className="eyebrow hidden lg:block">Profile score</p>
          <p className="mt-1 hidden font-display text-[2rem] leading-tight lg:block">{band.label}</p>
          <p className="mt-2 max-w-xl text-ink-muted">
            Scored by fixed rules on what recruiters see and search: headline, About, experience, skills, education,
            credentials and contact details. {open ? `${open} things to improve below.` : "Nothing major to fix."}
          </p>
          <div className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {result.sections.map((s) => (
              <a key={s.id} href={`#sec-${s.id}`} className="group block">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium group-hover:text-accent">{s.label}</span>
                  <span className="font-mono text-xs text-ink-muted tabular-nums">{s.score}/100</span>
                </div>
                <div className="grow-x mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/8">
                  <div
                    className={`h-full rounded-full ${s.score >= 80 ? "bg-good" : s.score >= 55 ? "bg-warn" : "bg-bad"}`}
                    style={{ width: `${Math.max(3, s.score)}%` }}
                  />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <AiReview session={session} />

      <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-12">
          {result.sections.map((s) => (
            <section key={s.id} id={`sec-${s.id}`} className="scroll-mt-24" aria-labelledby={`h-${s.id}`}>
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 id={`h-${s.id}`} className="font-serif text-[2rem] leading-tight">
                  {s.label}
                </h2>
                <span className="font-mono text-sm text-ink-muted tabular-nums">{s.score}/100</span>
              </div>
              <IssueList checks={s.checks} accepted={{}} roleHint={p.headline} />
            </section>
          ))}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ProfileExtract result={result} />
        </aside>
      </div>
    </div>
  );
}

function AiReview({ session }: { session: LinkedInSession }) {
  const ai = useAi();
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const [copied, setCopied] = useState<string | null>(null);
  const review = session.review;

  async function run() {
    setState({ busy: true, error: null });
    const findings = session.result.sections
      .flatMap((s) => s.checks)
      .filter((c) => c.status !== "pass")
      .slice(0, 30)
      .map((c) => `${c.title}: ${c.summary}`.slice(0, 300));
    const r = await callLlm({ task: "linkedin-review", profile: session.result.profile, score: session.result.score, findings });
    if (r.ok && r.review) {
      setLinkedIn({ ...session, review: r.review });
      setState({ busy: false, error: null });
    } else setState({ busy: false, error: r.ok ? "The review came back incomplete. Try again." : r.error });
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (!review && !ai) return null;
  if (!review && state.busy) {
    return (
      <section className="glass mt-6 p-6 sm:p-8" aria-busy="true">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <AiThinking label="Writing your profile review…" detail="Built only from what's on your profile. Usually 10–20 seconds." />
            <SkeletonLines lines={3} className="mt-6 max-w-2xl" />
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <SkeletonLines lines={4} />
              <SkeletonLines lines={4} />
            </div>
          </div>
          <div className="glass-well shrink-0 p-4 md:w-72">
            <StepList
              steps={["Reading your profile", "Finding strengths and gaps", "Drafting three headlines", "Rewriting your About section"]}
              stepMs={2200}
            />
          </div>
        </div>
      </section>
    );
  }
  if (!review) {
    return (
      <section className="glass mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-2xl">
          <h2 className="font-serif text-[1.7rem] leading-tight">Get an AI review</h2>
          <p className="mt-1 text-sm text-ink-muted">
            A written read of your profile, three headline options and a rewritten About section, built only from what
            is already on your profile. The score above doesn&apos;t change: it comes from fixed rules.
          </p>
          {state.error && <p className="mt-2 text-sm text-warn">{state.error}</p>}
        </div>
        <button type="button" onClick={run} disabled={state.busy} className="btn btn-primary shrink-0">
          {state.busy ? <Busy>Writing…</Busy> : "Write my review"}
        </button>
      </section>
    );
  }

  return (
    <section className="glass fade-in mt-6 p-6 sm:p-8" aria-labelledby="review-h">
      <p className="eyebrow">AI review</p>
      <h2 id="review-h" className="mt-2 font-serif text-[1.85rem] leading-tight">
        What a recruiter would notice
      </h2>
      <p className="mt-3 max-w-3xl text-[1.02rem] leading-relaxed">{review.verdict}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {review.strengths.length > 0 && (
          <div>
            <h3 className="font-semibold text-good">Working well</h3>
            <ul className="mt-3 space-y-2 text-[0.95rem]">
              {review.strengths.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-good" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {review.improvements.length > 0 && (
          <div>
            <h3 className="font-semibold text-accent">Improve next</h3>
            <ol className="mt-3 space-y-3 text-[0.95rem]">
              {review.improvements.map((s, i) => (
                <li key={i}>
                  <span className="font-medium">{s.title}.</span> <span className="text-ink-muted">{s.detail}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {review.headlines.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold">Headline options</h3>
          <ul className="mt-3 space-y-2">
            {review.headlines.map((h, i) => (
              <li key={i} className="glass-well flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[0.95rem]">{h}</span>
                <button type="button" onClick={() => copy(h, `h${i}`)} className="btn btn-quiet shrink-0 self-start sm:self-auto">
                  {copied === `h${i}` ? "Copied" : "Copy"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.about && (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Suggested About section</h3>
            <button type="button" onClick={() => copy(review.about, "about")} className="btn btn-quiet">
              {copied === "about" ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="glass-well mt-3 whitespace-pre-line px-4 py-4 text-[0.95rem] leading-relaxed">{review.about}</p>
          <p className="mt-2 text-xs text-ink-muted">
            Replace each [metric] with a real number before you paste it into LinkedIn. Written by AI from your profile.
          </p>
        </div>
      )}
    </section>
  );
}

function ProfileExtract({ result }: { result: LinkedInAnalysis }) {
  const p = result.profile;
  const rows: [string, string | null][] = [
    ["Name", p.name],
    ["Headline", p.headline],
    ["Location", p.location],
    ["Email", p.email],
    ["Profile URL", p.profileUrl],
  ];
  return (
    <div className="glass-strong overflow-hidden">
      <div className="border-b border-[var(--glass-line)] px-5 py-3">
        <p className="eyebrow">What we read from your PDF</p>
      </div>
      <dl className="space-y-2 px-5 py-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-ink-muted">{k}</dt>
            <dd className={v ? "break-words" : "text-ink-faint"}>{v ?? "not found"}</dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-ink-muted">About</dt>
          <dd>{p.summary ? `${p.summary.length.toLocaleString("en-US")} characters` : <span className="text-ink-faint">empty</span>}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Experience</dt>
          <dd>
            {p.experience.length} {p.experience.length === 1 ? "role" : "roles"},{" "}
            {p.experience.filter((r) => r.description && r.description.length > 40).length} with descriptions
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Top skills</dt>
          <dd>{p.topSkills.length ? p.topSkills.join(", ") : <span className="text-ink-faint">none listed</span>}</dd>
        </div>
        {p.certifications.length > 0 && (
          <div>
            <dt className="text-xs text-ink-muted">Certifications</dt>
            <dd>{p.certifications.length}</dd>
          </div>
        )}
      </dl>
      <p className="border-t border-[var(--glass-line)] px-5 py-3 text-xs text-ink-muted">
        LinkedIn&apos;s PDF leaves out your photo, banner, recommendations and activity, so those aren&apos;t scored.
      </p>
    </div>
  );
}
