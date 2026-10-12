"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { atsBand, atsScore } from "@/lib/ats-score";
import { callLlm } from "@/lib/client/api";
import { setDraft } from "@/lib/client/draft";
import { useSession } from "@/lib/client/session";
import { profileToResumeContent } from "@/lib/export/content";
import type { AnalysisResult } from "@/lib/types";
import { useAi } from "@/components/ai-context";
import { AiThinking, AiWorking, Busy } from "@/components/loading";
import { ScoreRing } from "@/components/results/ats-hero";
import { StatusMark } from "@/components/results/ui";

/** Problems that disappear simply by rebuilding the content in a clean template. */
const AUTO_FIXED: Record<string, string> = {
  "layout.columns": "Rebuilt as a single column, so lines are read in the right order.",
  "layout.tables": "Layout tables removed; dates and titles become plain lines.",
  "layout.header-footer": "Contact details moved into the body of the page.",
  "layout.text-boxes": "Text boxes removed; their content becomes normal text.",
  "layout.graphics": "Skill bars and icons replaced with plain text.",
  "layout.fonts": "Switched to a font every system has.",
  "extraction.headings": "Section headings renamed to the standard ones parsers expect.",
  "extraction.date-format": "Every date written in one consistent month-and-year format.",
};

const noop = () => () => {};

export function ImproveView() {
  const session = useSession();
  const onClient = useSyncExternalStore(noop, () => true, () => false);
  if (!onClient) return <div className="container-page min-h-[60vh] py-14" aria-busy="true" />;

  if (!session) {
    return (
      <div className="container-page py-12 sm:py-16">
        <div className="glass-strong max-w-2xl p-8 sm:p-10">
          <h1 className="font-display text-[2.2rem] leading-[1.12]">Check your resume first</h1>
          <p className="mt-3 text-ink-muted">
            Improvements are based on what we find in your current resume. Upload it, or start a new one from
            scratch in the builder.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/#check" className="btn btn-primary">
              Check my resume
            </Link>
            <Link href="/builder" className="btn btn-secondary">
              Build one from scratch
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return <Improve result={session.result} fileName={session.fileName} jd={session.jd} accepted={session.accepted} />;
}

interface Suggestion {
  text: string;
  approved: boolean;
  fromAi: boolean;
}

function Improve({
  result,
  fileName,
  jd,
  accepted,
}: {
  result: AnalysisResult;
  fileName: string;
  jd: string | null;
  accepted: Record<string, string>;
}) {
  const router = useRouter();
  const ai = useAi();
  const p = result.profile;
  const before = atsScore(result.scores, result.checks);
  const band = atsBand(before);

  const autoFixed = result.checks.filter((c) => c.status !== "pass" && AUTO_FIXED[c.id]);
  const weakBullets = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of result.checks)
      for (const t of c.rewriteTargets ?? [])
        if (t.kind === "bullet" && !seen.has(t.text)) {
          seen.add(t.text);
          out.push(t.text);
        }
    return out;
  }, [result.checks]);
  const missingSkills = (result.match?.keywords ?? []).filter((k) => k.kind === "hard" && k.inResume === 0);

  const [details, setDetails] = useState({
    name: p.name ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    location: p.location ?? "",
    linkedin: p.linkedin ?? "",
  });
  const missingFields = (["name", "email", "phone", "location", "linkedin"] as const).filter((k) => !p[k]);

  const [targetRole, setTargetRole] = useState(result.match?.jobTitle ?? p.experience[0]?.title ?? "");
  const [bullets, setBullets] = useState<Record<string, Suggestion>>(() =>
    Object.fromEntries(
      weakBullets.map((b) => [b, { text: accepted[b] ?? b, approved: !!accepted[b], fromAi: !!accepted[b] }]),
    ),
  );
  const [bulletState, setBulletState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  const [summaryDraft, setSummaryDraft] = useState(p.summary ?? "");
  const [summaryNew, setSummaryNew] = useState<Suggestion | null>(null);
  const [summaryState, setSummaryState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  const [skillsToAdd, setSkillsToAdd] = useState<Set<string>>(new Set());

  async function suggestBullets() {
    setBulletState({ busy: true, error: null });
    const next = { ...bullets };
    for (let i = 0; i < weakBullets.length; i += 15) {
      const chunk = weakBullets.slice(i, i + 15);
      const r = await callLlm({ task: "rewrite-bullets", bullets: chunk, role: targetRole || null });
      if (!r.ok || !r.items) {
        setBullets(next);
        setBulletState({ busy: false, error: r.ok ? "The suggestions came back incomplete. Try again." : r.error });
        return;
      }
      chunk.forEach((orig, j) => {
        const text = r.items![j] ?? orig;
        next[orig] = { text, approved: text !== orig, fromAi: text !== orig };
      });
    }
    setBullets(next);
    setBulletState({ busy: false, error: null });
  }

  async function suggestSummary() {
    if (!targetRole.trim()) return;
    setSummaryState({ busy: true, error: null });
    const context = p.experience
      .slice(0, 4)
      .map((r) => [r.title, r.company, r.dates].filter(Boolean).join(", "))
      .join("; ");
    const base =
      summaryDraft.trim() ||
      `${p.experience[0]?.title ?? "Professional"} with experience at ${p.experience
        .map((r) => r.company)
        .filter(Boolean)
        .slice(0, 3)
        .join(", ")}. Skills: ${p.skills.slice(0, 8).join(", ")}.`;
    const r = await callLlm({ task: "rewrite-summary", summary: base.slice(0, 2000), targetRole: targetRole.trim(), context });
    if (r.ok) {
      setSummaryNew({ text: r.text, approved: true, fromAi: true });
      setSummaryState({ busy: false, error: null });
    } else setSummaryState({ busy: false, error: r.error });
  }

  function continueToBuilder() {
    const c = profileToResumeContent(p);
    const swap = (b: string) => (bullets[b]?.approved ? bullets[b].text : b);
    const summary = summaryNew?.approved ? summaryNew.text : summaryDraft.trim() || c.summary;
    setDraft({
      content: {
        ...c,
        name: details.name.trim() || c.name,
        email: details.email.trim() || null,
        phone: details.phone.trim() || null,
        location: details.location.trim() || null,
        linkedin: details.linkedin.trim() || null,
        headline: targetRole.trim() || c.headline,
        summary: summary || null,
        experience: c.experience.map((r) => ({ ...r, bullets: r.bullets.map(swap) })),
        skills: [...c.skills, ...[...skillsToAdd].filter((s) => !c.skills.includes(s))],
      },
      template: "standard",
      targetRole: targetRole.trim(),
      jobDescription: jd ?? "",
      source: "improve",
      baseline: { ats: before, fileName },
      updatedAt: Date.now(),
    });
    router.push("/builder");
  }

  const approvedCount =
    Object.values(bullets).filter((b) => b.approved).length + (summaryNew?.approved ? 1 : 0) + skillsToAdd.size;

  return (
    <div className="container-page pt-10 sm:pt-14">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow break-all">Improving {fileName}</p>
          <h1 className="mt-3 font-display text-[2.2rem] leading-[1.12] sm:text-[3rem]">Approve your fixes.</h1>
          <p className="mt-3 text-ink-muted">
            Nothing changes until you say so. Approve the suggestions you agree with, edit any of them, then
            continue to the builder to pick a template and download.
          </p>
        </div>
        <div className="glass flex items-center gap-4 self-start p-4 pr-6">
          <ScoreRing score={before} tone={band.tone} size={84} label="now" />
          <div>
            <p className="eyebrow">Current ATS score</p>
            <p className="mt-1 text-sm text-ink-muted">You&apos;ll re-check after rebuilding.</p>
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-6">
        {/* 1. Target role */}
        <Step n="1" title="What role is this resume for?" lede="Used to aim your summary and bullet rewrites. It appears as the headline under your name.">
          <input
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            maxLength={120}
            className="field max-w-md"
            placeholder="e.g. Senior Data Analyst"
            aria-label="Target role"
          />
        </Step>

        {/* 2. Automatic */}
        <Step
          n="2"
          title="Fixed automatically when we rebuild"
          lede={
            autoFixed.length
              ? "These come from your current file's layout. Moving your content into a clean template removes them."
              : "Your layout already parses cleanly. Rebuilding keeps it that way."
          }
        >
          {autoFixed.length > 0 && (
            <ul className="space-y-2.5">
              {autoFixed.map((c) => (
                <li key={c.id} className="flex gap-3 text-[0.95rem]">
                  <StatusMark status="pass" className="mt-1.5" />
                  <span>
                    <span className="font-medium">{c.title}.</span>{" "}
                    <span className="text-ink-muted">{AUTO_FIXED[c.id]}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Step>

        {/* 3. Missing details */}
        {missingFields.length > 0 && (
          <Step
            n="3"
            title="Fill in what the parser couldn't find"
            lede="These came back empty. If they exist in your file, they were in a header, text box or image. Type them here and they'll go in the body."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {missingFields.map((k) => (
                <label key={k} className="block text-sm">
                  <span className="mb-1 block font-medium capitalize">{k === "linkedin" ? "LinkedIn URL" : k}</span>
                  <input
                    value={details[k]}
                    onChange={(e) => setDetails({ ...details, [k]: e.target.value })}
                    className="field"
                    type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
                    placeholder={
                      k === "linkedin" ? "linkedin.com/in/your-name" : k === "location" ? "City, Country" : ""
                    }
                  />
                </label>
              ))}
            </div>
          </Step>
        )}

        {/* 4. Bullets */}
        <Step
          n={missingFields.length ? "4" : "3"}
          title={`Stronger bullets${weakBullets.length ? ` (${weakBullets.length})` : ""}`}
          lede={
            !weakBullets.length
              ? "No weak bullets found."
              : ai
                ? "These bullets have no numbers or start weakly. AI suggests a rewrite using only your facts; where a number belongs it writes [metric] for you to fill in."
                : "These bullets have no numbers or start weakly. Rewrite each one below: open with a strong past-tense verb and add a result or number where you can."
          }
        >
          {weakBullets.length > 0 && (
            <>
              {ai && (
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={suggestBullets} disabled={bulletState.busy} className="btn btn-primary">
                    {bulletState.busy ? <Busy>Writing suggestions…</Busy> : "Suggest rewrites with AI"}
                  </button>
                  <span className="text-sm text-ink-muted">Or edit any bullet yourself below.</span>
                </div>
              )}
              {bulletState.error && <p className="mb-3 text-sm text-warn">{bulletState.error}</p>}
              {bulletState.busy && (
                <div className="glass-well mb-4 p-4">
                  <AiThinking
                    label={`Rewriting ${weakBullets.length} bullet${weakBullets.length === 1 ? "" : "s"} for ${targetRole.trim() || "your role"}…`}
                    detail="Using only your facts. Where a number would help, you'll see [metric] to fill in."
                  />
                </div>
              )}
              <ul className="space-y-3" aria-busy={bulletState.busy}>
                {weakBullets.map((orig) => {
                  const s = bullets[orig];
                  const changed = s.text.trim() !== orig.trim();
                  return (
                    <li key={orig} className="glass-well relative overflow-hidden">
                      {bulletState.busy && (
                        <div className="skeleton pointer-events-none absolute inset-0 z-10 opacity-70" aria-hidden="true" />
                      )}
                      {changed && (
                        <p className="border-b border-[var(--glass-line)] px-3.5 py-2 font-mono text-[0.92rem] text-ink-faint line-through decoration-ink/20">
                          {orig}
                        </p>
                      )}
                      <div className="flex gap-3 px-3.5 py-3">
                        <input
                          type="checkbox"
                          checked={s.approved}
                          disabled={!changed}
                          onChange={(e) => setBullets({ ...bullets, [orig]: { ...s, approved: e.target.checked } })}
                          className="mt-1.5 h-4 w-4 shrink-0 accent-[var(--color-ink)]"
                          aria-label="Use this version"
                        />
                        <textarea
                          value={s.text}
                          onChange={(e) =>
                            setBullets({
                              ...bullets,
                              [orig]: { ...s, text: e.target.value, approved: e.target.value.trim() !== orig.trim() },
                            })
                          }
                          rows={2}
                          className="field resize-y !py-2.5 text-[0.95rem] leading-relaxed"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Step>

        {/* 5. Summary */}
        <Step
          n={missingFields.length ? "5" : "4"}
          title="Summary for this role"
          lede={
            ai
              ? "Two to four sentences at the top that say who you are for this job. Write a rough version, or let AI draft one from your experience."
              : "Two to four sentences at the top that say who you are for this job: your role, years of experience, strongest skills and the kind of results you deliver."
          }
        >
          <textarea
            value={summaryDraft}
            onChange={(e) => setSummaryDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            className="field text-sm leading-relaxed"
            placeholder="A rough sentence or two about your experience and what you're looking for."
          />
          <div className={`mt-3 flex-wrap items-center gap-3 ${ai ? "flex" : "hidden"}`}>
            <button
              type="button"
              onClick={suggestSummary}
              disabled={summaryState.busy || !targetRole.trim()}
              className="btn btn-secondary"
            >
              {summaryState.busy ? <Busy>Writing…</Busy> : summaryNew ? "Write another version" : "Write it with AI"}
            </button>
            {!targetRole.trim() && <span className="text-sm text-ink-muted">Add a target role in step 1 first.</span>}
            {summaryState.error && <span className="text-sm text-warn">{summaryState.error}</span>}
          </div>
          {summaryState.busy && (
            <div className="mt-4">
              <AiWorking label={`Writing a summary for ${targetRole.trim()}…`} lines={3} />
            </div>
          )}
          {summaryNew && !summaryState.busy && (
            <div className="glass-well fade-in mt-4 flex gap-3 px-3.5 py-3">
              <input
                type="checkbox"
                checked={summaryNew.approved}
                onChange={(e) => setSummaryNew({ ...summaryNew, approved: e.target.checked })}
                className="mt-1.5 h-4 w-4 shrink-0 accent-[var(--color-ink)]"
                aria-label="Use this summary"
              />
              <textarea
                value={summaryNew.text}
                onChange={(e) => setSummaryNew({ ...summaryNew, text: e.target.value })}
                rows={4}
                className="field resize-y !py-2.5 text-[0.95rem] leading-relaxed"
              />
            </div>
          )}
        </Step>

        {/* 6. JD skills */}
        {missingSkills.length > 0 && (
          <Step
            n={missingFields.length ? "6" : "5"}
            title="Skills the job asks for that your resume doesn't mention"
            lede="Tick only the ones you genuinely have. They'll be added to your Skills section; consider also showing them in a bullet."
          >
            <ul className="flex flex-wrap gap-2">
              {missingSkills.map((k) => {
                const on = skillsToAdd.has(k.term);
                return (
                  <li key={k.term}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const next = new Set(skillsToAdd);
                        if (on) next.delete(k.term);
                        else next.add(k.term);
                        setSkillsToAdd(next);
                      }}
                      className={`chip cursor-pointer !px-3 !py-1 transition-colors ${
                        on ? "!border-good/30 !bg-good-soft text-good" : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {on ? "✓ " : "+ "}
                      {k.term}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Step>
        )}
      </div>

      <div className="glass-strong sticky bottom-4 z-30 mt-8 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-ink-muted">
          {approvedCount > 0 ? `${approvedCount} change${approvedCount === 1 ? "" : "s"} approved.` : "No changes approved yet."}{" "}
          Next: choose a template and download.
        </p>
        <button type="button" onClick={continueToBuilder} className="btn btn-primary">
          Continue to the builder
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, lede, children }: { n: string; title: string; lede: string; children?: React.ReactNode }) {
  return (
    <section className="glass p-6 sm:p-8">
      <div className="flex gap-4">
        <span className="font-display text-[1.6rem] leading-none text-accent">{n.padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{lede}</p>
          {children && <div className="mt-5">{children}</div>}
        </div>
      </div>
    </section>
  );
}
