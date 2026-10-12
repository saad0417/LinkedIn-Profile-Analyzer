"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { atsBand, atsScore } from "@/lib/ats-score";
import { callLlm, exportResume, recheck, saveFile } from "@/lib/client/api";
import { emptyContent, patchDraft, setDraft, useDraft, type Draft } from "@/lib/client/draft";
import { getTemplate } from "@/lib/export/registry";
import type { AnalysisResult, ResumeContent, TemplateId } from "@/lib/types";
import { useAi } from "@/components/ai-context";
import { Busy, StepList } from "@/components/loading";
import { ScoreRing } from "@/components/results/ats-hero";
import { PdfPages } from "@/components/results/document-pane";
import { sortChecks, StatusMark } from "@/components/results/ui";
import { TemplatePicker } from "./template-picker";

type Role = ResumeContent["experience"][number];
type School = ResumeContent["education"][number];

const blankRole = (): Role => ({ title: "", company: "", location: null, start: "", end: "", bullets: [""] });
const blankSchool = (): School => ({ institution: "", degree: "", dates: "", details: [] });

/** Trim everything and drop empty rows before anything leaves the page. */
export function cleanContent(c: ResumeContent): ResumeContent {
  const t = (s: string | null | undefined) => (s ?? "").trim();
  const n = (s: string | null | undefined) => t(s) || null;
  const list = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
  return {
    name: t(c.name),
    headline: n(c.headline),
    email: n(c.email),
    phone: n(c.phone),
    location: n(c.location),
    linkedin: n(c.linkedin),
    links: list(c.links),
    summary: n(c.summary),
    experience: c.experience
      .map((r) => ({ ...r, title: t(r.title), company: t(r.company), location: n(r.location), start: t(r.start), end: t(r.end), bullets: list(r.bullets) }))
      .filter((r) => r.title || r.company || r.bullets.length),
    education: c.education
      .map((e) => ({ institution: t(e.institution), degree: t(e.degree), dates: t(e.dates), details: list(e.details) }))
      .filter((e) => e.institution || e.degree),
    skills: [...new Set(list(c.skills))],
    certifications: list(c.certifications),
  };
}

const noop = () => () => {};

export function BuilderView() {
  const draft = useDraft();
  const onClient = useSyncExternalStore(noop, () => true, () => false);
  // Server render (and first client paint) shows the start screen, so crawlers and the first
  // paint get real content; a saved draft, which only exists in this browser, swaps in after.
  if (!onClient) return <StartScreen />;
  if (!draft) return <StartScreen />;
  return <Builder draft={draft} />;
}

function startScratch(template: TemplateId = "standard") {
  setDraft({
    content: { ...emptyContent(), experience: [blankRole()], education: [blankSchool()] },
    template,
    targetRole: "",
    jobDescription: "",
    source: "scratch",
    baseline: null,
    updatedAt: Date.now(),
  });
}

function StartScreen() {
  const ai = useAi();
  return (
    <div className="container-page pt-12 sm:pt-20">
      <div className="max-w-2xl">
        <p className="eyebrow">Resume builder</p>
        <h1 className="mt-3 font-display text-[2.3rem] leading-[1.12] sm:text-[3.3rem]">Build an ATS-friendly resume.</h1>
        <p className="mt-4 text-[1.05rem] text-ink-muted">
          {ai
            ? "Tell us the role you want and your experience in your own words. AI turns your notes into clear, ATS-ready wording without inventing anything, then you pick a template and download Word or PDF."
            : "Enter the role you want, your experience, education and skills. Pick a template and download a clean, ATS-ready Word or PDF file."}
        </p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <button type="button" onClick={() => startScratch()} className="glass group p-7 text-left transition-transform hover:-translate-y-0.5 sm:p-8">
          <span className="font-display text-[2rem] leading-none text-accent">01</span>
          <h2 className="mt-4 font-serif text-[1.8rem] leading-tight">Start from scratch</h2>
          <p className="mt-2 text-ink-muted">
            A guided form: target role, contact details, each job with rough notes, education and skills. About ten
            minutes.
          </p>
          <span className="btn btn-primary mt-6">Start a new resume</span>
        </button>
        <Link href="/#check" className="glass group p-7 transition-transform hover:-translate-y-0.5 sm:p-8">
          <span className="font-display text-[2rem] leading-none text-accent">02</span>
          <h2 className="mt-4 font-serif text-[1.8rem] leading-tight">Improve the one you have</h2>
          <p className="mt-2 text-ink-muted">
            Upload your current resume. We score it, show what an ATS loses, and bring your content in here with the
            fixes you approve.
          </p>
          <span className="btn btn-secondary mt-6">Check my resume first</span>
        </Link>
      </div>
      <p className="mt-6 text-sm text-ink-muted">
        Prefer to pick a design first? Browse the{" "}
        <Link href="/templates" className="link">
          template library
        </Link>
        .
      </p>
    </div>
  );
}

function Builder({ draft }: { draft: Draft }) {
  const c = draft.content;
  const ai = useAi();
  const set = (content: ResumeContent) => patchDraft({ content });
  const [aiState, setAiState] = useState<{ busy: boolean; error: string | null; undo: ResumeContent | null }>({
    busy: false,
    error: null,
    undo: null,
  });
  const [showJd, setShowJd] = useState(!!draft.jobDescription);
  const [pickTemplate, setPickTemplate] = useState(false);
  const [justPicked, setJustPicked] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Open the picker where the user is looking: scroll down to it.
  useEffect(() => {
    if (pickTemplate) pickerRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  }, [pickTemplate]);

  useEffect(() => {
    if (!justPicked) return;
    const t = setTimeout(() => setJustPicked(false), 1400);
    return () => clearTimeout(t);
  }, [justPicked]);

  function openPicker() {
    if (pickTemplate) pickerRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    else setPickTemplate(true);
  }

  /** Close the picker and take the user back to the template panel. */
  function closePicker(picked: boolean) {
    setPickTemplate(false);
    if (picked) setJustPicked(true);
    requestAnimationFrame(() => {
      // Desktop: the panel is sticky beside the form, so the top of the page shows it.
      if (window.matchMedia("(min-width: 1024px)").matches) window.scrollTo({ top: 0, behavior: scrollBehavior() });
      else panelRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    });
  }
  const template = getTemplate(draft.template);

  async function polish() {
    if (!draft.targetRole.trim()) {
      setAiState({ ...aiState, error: "Add the role you're applying for first." });
      return;
    }
    const clean = cleanContent(c);
    if (!clean.experience.length && !clean.education.length) {
      setAiState({ ...aiState, error: "Add at least one job or your education so there's something to work from." });
      return;
    }
    setAiState({ busy: true, error: null, undo: null });
    const r = await callLlm({
      task: "generate-resume",
      targetRole: draft.targetRole.trim(),
      draft: clean,
      jobDescription: draft.jobDescription.trim() || null,
    });
    if (r.ok && r.content) {
      set(r.content);
      setAiState({ busy: false, error: null, undo: c });
    } else setAiState({ busy: false, error: r.ok ? "The AI response was incomplete. Try again." : r.error, undo: null });
  }

  return (
    <div className="container-page pt-10 sm:pt-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow">Resume builder</p>
          <h1 className="mt-3 font-display text-[2.2rem] leading-[1.12] sm:text-[3rem]">
            {draft.source === "improve" ? "Review and download." : "Your resume."}
          </h1>
          <p className="mt-3 text-ink-muted">
            Saved in this browser as you type. Nothing is uploaded until you {ai ? "download, check or ask AI for help" : "download or check it"}.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-quiet self-start sm:self-auto"
          onClick={() => {
            if (confirm("Clear this draft and start over? This can't be undone.")) setDraft(null);
          }}
        >
          Start over
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-6">
          {/* Target role + AI */}
          <Card title="The job you want" lede="Everything is aimed at this role: the headline, the summary and how your bullets are phrased.">
            <Field label="Role you're applying for" required>
              <input
                value={draft.targetRole}
                onChange={(e) => patchDraft({ targetRole: e.target.value })}
                maxLength={120}
                className="field"
                placeholder="e.g. Marketing Coordinator"
              />
            </Field>
            {showJd ? (
              <Field label="Job description (optional)" hint="Paste a posting to tailor wording and skill order to it.">
                <textarea
                  value={draft.jobDescription}
                  onChange={(e) => patchDraft({ jobDescription: e.target.value })}
                  rows={5}
                  maxLength={20000}
                  className="field text-sm"
                />
              </Field>
            ) : (
              <button type="button" onClick={() => setShowJd(true)} className="mt-3 text-sm underline underline-offset-4">
                + Add a job description to tailor it
              </button>
            )}
            <div className={`glass-well mt-5 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${ai ? "flex" : "hidden"}`}>
              <p className="text-sm text-ink-muted">
                Fill in your details below in your own words, then let AI write the summary and turn your notes into
                strong bullets. It only uses facts you gave it.
              </p>
              <button type="button" onClick={polish} disabled={aiState.busy} className="btn btn-primary shrink-0">
                {aiState.busy ? <Busy>Writing…</Busy> : "Write it with AI"}
              </button>
            </div>
            {aiState.error && <p className="mt-3 text-sm text-warn">{aiState.error}</p>}
            {aiState.undo && (
              <p className="mt-3 text-sm text-good">
                Done. Read it through and replace any [metric] with real numbers.{" "}
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() => {
                    set(aiState.undo!);
                    setAiState({ busy: false, error: null, undo: null });
                  }}
                >
                  Undo
                </button>
              </p>
            )}
          </Card>

          {/* Contact */}
          <Card title="Contact details" lede="These go in the body of the page, where every parser reads them.">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label="Full name" required>
                <input value={c.name} onChange={(e) => set({ ...c, name: e.target.value })} className="field" autoComplete="name" />
              </Field>
              <Field label="Headline" hint="Usually the target role.">
                <input value={c.headline ?? ""} onChange={(e) => set({ ...c, headline: e.target.value })} className="field" placeholder={draft.targetRole || "e.g. Data Analyst"} />
              </Field>
              <Field label="Email" required>
                <input value={c.email ?? ""} onChange={(e) => set({ ...c, email: e.target.value })} className="field" type="email" autoComplete="email" />
              </Field>
              <Field label="Phone">
                <input value={c.phone ?? ""} onChange={(e) => set({ ...c, phone: e.target.value })} className="field" type="tel" autoComplete="tel" />
              </Field>
              <Field label="City, Country">
                <input value={c.location ?? ""} onChange={(e) => set({ ...c, location: e.target.value })} className="field" />
              </Field>
              <Field label="LinkedIn URL">
                <input value={c.linkedin ?? ""} onChange={(e) => set({ ...c, linkedin: e.target.value })} className="field" placeholder="linkedin.com/in/your-name" />
              </Field>
            </div>
            <Field label="Other links" hint="Portfolio, GitHub. Separate with commas.">
              <input
                value={c.links.join(",")}
                onChange={(e) => set({ ...c, links: e.target.value.split(",") })}
                className="field"
              />
            </Field>
          </Card>

          {/* Summary */}
          <Card title="Summary" lede={ai ? "Two to four sentences. A rough version is fine; AI can polish it." : "Two to four sentences: your role, experience, strongest skills and the results you deliver."}>
            <textarea
              value={c.summary ?? ""}
              onChange={(e) => set({ ...c, summary: e.target.value })}
              rows={4}
              maxLength={2000}
              className="field text-sm leading-relaxed"
              placeholder="e.g. 3 years running social media for small brands, grew accounts, good with Canva and analytics, want a marketing role."
            />
          </Card>

          {/* Experience */}
          <Card
            title="Experience"
            lede={
              ai
                ? "Most recent first. For each job, jot down what you did and any results, one point per line. Rough notes are fine."
                : "Most recent first. One bullet per line: start with a strong verb and include a number or result where you can."
            }
          >
            <div className="space-y-4">
              {c.experience.map((r, i) => (
                <div key={i} className="glass-well p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">Job {i + 1}</span>
                    <RowActions
                      index={i}
                      count={c.experience.length}
                      onMove={(to) => set({ ...c, experience: move(c.experience, i, to) })}
                      onRemove={() => set({ ...c, experience: c.experience.filter((_, j) => j !== i) })}
                    />
                  </div>
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    <Field label="Job title">
                      <input value={r.title} onChange={(e) => set({ ...c, experience: replace(c.experience, i, { ...r, title: e.target.value }) })} className="field" />
                    </Field>
                    <Field label="Company">
                      <input value={r.company} onChange={(e) => set({ ...c, experience: replace(c.experience, i, { ...r, company: e.target.value }) })} className="field" />
                    </Field>
                    <Field label="Start">
                      <input value={r.start} onChange={(e) => set({ ...c, experience: replace(c.experience, i, { ...r, start: e.target.value }) })} className="field" placeholder="Mar 2022" />
                    </Field>
                    <Field label="End">
                      <input value={r.end} onChange={(e) => set({ ...c, experience: replace(c.experience, i, { ...r, end: e.target.value }) })} className="field" placeholder="Present" />
                    </Field>
                  </div>
                  <Field label="Location (optional)">
                    <input value={r.location ?? ""} onChange={(e) => set({ ...c, experience: replace(c.experience, i, { ...r, location: e.target.value }) })} className="field" />
                  </Field>
                  <Field label="What you did" hint="One point per line. Include numbers where you have them.">
                    <textarea
                      value={r.bullets.join("\n")}
                      onChange={(e) => set({ ...c, experience: replace(c.experience, i, { ...r, bullets: e.target.value.split("\n") }) })}
                      rows={5}
                      className="field text-sm leading-relaxed"
                      placeholder={"handled customer emails and complaints\ntrained 4 new staff\nmade the weekly sales report in Excel"}
                    />
                  </Field>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => set({ ...c, experience: [...c.experience, blankRole()] })} className="btn btn-quiet mt-4">
              + Add a job
            </button>
          </Card>

          {/* Education */}
          <Card title="Education" lede="Degree, school and dates. Add coursework, grades or projects as extra lines if you're early in your career.">
            <div className="space-y-4">
              {c.education.map((ed, i) => (
                <div key={i} className="glass-well p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">Education {i + 1}</span>
                    <RowActions
                      index={i}
                      count={c.education.length}
                      onMove={(to) => set({ ...c, education: move(c.education, i, to) })}
                      onRemove={() => set({ ...c, education: c.education.filter((_, j) => j !== i) })}
                    />
                  </div>
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    <Field label="School or university">
                      <input value={ed.institution} onChange={(e) => set({ ...c, education: replace(c.education, i, { ...ed, institution: e.target.value }) })} className="field" />
                    </Field>
                    <Field label="Degree">
                      <input value={ed.degree} onChange={(e) => set({ ...c, education: replace(c.education, i, { ...ed, degree: e.target.value }) })} className="field" placeholder="BSc Computer Science" />
                    </Field>
                    <Field label="Dates">
                      <input value={ed.dates} onChange={(e) => set({ ...c, education: replace(c.education, i, { ...ed, dates: e.target.value }) })} className="field" placeholder="Sep 2019 – Jun 2023" />
                    </Field>
                  </div>
                  <Field label="Details (optional)" hint="One per line: GPA, coursework, thesis, awards.">
                    <textarea
                      value={ed.details.join("\n")}
                      onChange={(e) => set({ ...c, education: replace(c.education, i, { ...ed, details: e.target.value.split("\n") }) })}
                      rows={2}
                      className="field text-sm"
                    />
                  </Field>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => set({ ...c, education: [...c.education, blankSchool()] })} className="btn btn-quiet mt-4">
              + Add education
            </button>
          </Card>

          {/* Skills */}
          <Card title="Skills and certifications" lede="List the tools, technologies and methods you actually use. Recruiters search for these words.">
            <Field label="Skills" hint="Separate with commas.">
              <textarea
                value={c.skills.join(",")}
                onChange={(e) => set({ ...c, skills: e.target.value.split(",") })}
                rows={3}
                className="field text-sm"
                placeholder="Excel, SQL, Google Analytics, Canva, Customer service"
              />
            </Field>
            <Field label="Certifications" hint="One per line.">
              <textarea
                value={c.certifications.join("\n")}
                onChange={(e) => set({ ...c, certifications: e.target.value.split("\n") })}
                rows={2}
                className="field text-sm"
              />
            </Field>
          </Card>

          {pickTemplate && (
            <div ref={pickerRef} className="scroll-mt-24">
              <Card title="Choose a template" lede="ATS-safe templates are built to parse cleanly. Creative ones look great for emailing a person, but aren't meant for job-portal uploads.">
                <TemplatePicker
                  value={draft.template}
                  onChange={(id) => {
                    patchDraft({ template: id });
                    closePicker(true);
                  }}
                  columns="sm:grid-cols-2 xl:grid-cols-3"
                />
                <button type="button" onClick={() => closePicker(false)} className="btn btn-quiet mt-5">
                  Keep current template
                </button>
              </Card>
            </div>
          )}
        </div>

        <aside ref={panelRef} className="scroll-mt-24 space-y-5 lg:sticky lg:top-24">
          <OutputPanel
            draft={draft}
            templateName={template?.name ?? draft.template}
            atsSafe={template?.atsSafe ?? true}
            preview={template?.preview}
            onPick={openPicker}
            highlight={justPicked}
          />
        </aside>
      </div>
      {aiState.busy && <WritingOverlay role={draft.targetRole.trim()} withJd={!!draft.jobDescription.trim()} />}
    </div>
  );
}

/** Shown while AI writes the resume: blocks edits that would be overwritten, and shows what's happening. */
function WritingOverlay({ role, withJd }: { role: string; withJd: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex cursor-wait items-center justify-center bg-[rgba(250,248,244,0.6)] p-4 backdrop-blur-md">
      <div role="status" aria-live="polite" className="glass-strong fade-in w-full max-w-md p-7 sm:p-9">
        <div className="flex items-center gap-4">
          <span className="ai-orb relative h-12 w-12 shrink-0 rounded-full" aria-hidden="true" />
          <div>
            <p className="font-display text-[1.7rem] leading-tight">Writing your resume</p>
            <p className="shimmer-text text-sm font-medium">for {role || "your target role"}</p>
          </div>
        </div>
        <div className="mt-6">
          <StepList
            steps={[
              "Reading your notes",
              ...(withJd ? ["Reading the job description"] : []),
              "Writing a summary for the role",
              "Turning notes into strong bullets",
              "Ordering skills by relevance",
              "Checking nothing was invented",
            ]}
            stepMs={1400}
          />
        </div>
        <p className="mt-6 text-xs text-ink-muted">Uses only the facts you entered. This can take up to half a minute.</p>
      </div>
    </div>
  );
}

function OutputPanel({
  draft,
  templateName,
  atsSafe,
  preview,
  onPick,
  highlight,
}: {
  draft: Draft;
  templateName: string;
  atsSafe: boolean;
  preview?: string;
  onPick: () => void;
  highlight: boolean;
}) {
  const [busy, setBusy] = useState<null | "docx" | "pdf" | "preview" | "check">(null);
  const [error, setError] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [check, setCheck] = useState<AnalysisResult | null>(null);
  const content = cleanContent(draft.content);
  const missing = [!content.name && "your name", !content.email && !content.phone && "an email or phone"].filter(Boolean);

  async function run(kind: "docx" | "pdf" | "preview" | "check") {
    if (missing.length) {
      setError(`Add ${missing.join(" and ")} first.`);
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      if (kind === "docx" || kind === "pdf") saveFile(await exportResume(content, draft.template, kind));
      else if (kind === "preview") setPreviewBlob((await exportResume(content, draft.template, "pdf")).blob);
      else {
        const file = await exportResume(content, draft.template, "pdf");
        const r = await recheck(file, draft.jobDescription.trim() || null);
        if (r.ok) setCheck(r.result);
        else setError(r.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const after = check ? atsScore(check.scores, check.checks) : null;
  const remaining = check ? sortChecks(check.checks.filter((x) => x.status !== "pass")).slice(0, 4) : [];

  return (
    <>
      <div
        className={`glass-strong p-5 transition-shadow duration-500 ${
          highlight ? "shadow-[0_0_0_3px_rgba(63,107,74,0.35),var(--glass-shadow)]" : ""
        }`}
      >
        <p className="eyebrow">Template</p>
        <div className="mt-3 flex gap-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-28 w-[86px] shrink-0 rounded-[var(--radius-xs)] bg-white object-cover object-top shadow-[0_1px_3px_rgba(60,40,20,0.15)]" />
          )}
          <div className="min-w-0">
            <p className="font-medium">{templateName}</p>
            <p className={`mt-1 text-sm ${atsSafe ? "text-good" : "text-warn"}`}>
              {atsSafe ? "ATS-safe" : "Creative: for emailing a person, not ATS uploads"}
            </p>
            <button type="button" onClick={onPick} className="btn btn-quiet mt-3">
              Change template
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => run("docx")} disabled={!!busy} className="btn btn-primary !px-3">
            {busy === "docx" ? <Busy>Word</Busy> : "Word"}
          </button>
          <button type="button" onClick={() => run("pdf")} disabled={!!busy} className="btn btn-primary !px-3">
            {busy === "pdf" ? <Busy>PDF</Busy> : "PDF"}
          </button>
          <button type="button" onClick={() => run("preview")} disabled={!!busy} className="btn btn-secondary col-span-2">
            {busy === "preview" ? <Busy>Rendering preview…</Busy> : "Preview"}
          </button>
          <button type="button" onClick={() => run("check")} disabled={!!busy} className="btn btn-secondary col-span-2">
            {busy === "check" ? <Busy>Checking…</Busy> : "Check its ATS score"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-bad">
            {error}
          </p>
        )}
        {busy === "check" && (
          <div className="glass-well fade-in mt-4 p-4" role="status" aria-live="polite">
            <StepList
              steps={["Building your file in this template", "Running the same checks as an upload", "Scoring"]}
              stepMs={900}
            />
          </div>
        )}
        <p className="mt-4 text-xs text-ink-muted">
          Search the file for <span className="font-mono text-accent">[metric]</span> before you send it and replace
          each with a real number.
        </p>
      </div>

      {check && after !== null && (
        <div className="glass p-5" aria-live="polite">
          <p className="eyebrow">New ATS score</p>
          <div className="mt-3 flex items-center gap-4">
            <ScoreRing score={after} tone={atsBand(after).tone} size={96} label="new" />
            <div className="text-sm">
              {draft.baseline ? (
                <p>
                  Up from <span className="font-semibold">{draft.baseline.ats}</span> for your original file.
                </p>
              ) : (
                <p>{atsBand(after).label}.</p>
              )}
              <p className="mt-1 text-ink-muted">Checked with the same rules as any upload.</p>
            </div>
          </div>
          {remaining.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-[var(--glass-line)] pt-3 text-sm">
              {remaining.map((r) => (
                <li key={r.id} className="flex gap-2">
                  <StatusMark status={r.status} className="mt-1" />
                  <span>
                    <span className="font-medium">{r.title}.</span> <span className="text-ink-muted">{r.fix ?? r.summary}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {previewBlob && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Resume preview"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-ink/30 p-4 backdrop-blur-sm sm:p-10"
          onClick={() => setPreviewBlob(null)}
        >
          <div className="glass-strong w-full max-w-3xl p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Preview: {templateName}</p>
              <button type="button" onClick={() => setPreviewBlob(null)} className="btn btn-quiet">
                Close
              </button>
            </div>
            <PdfPages file={previewBlob} />
          </div>
        </div>
      )}
    </>
  );
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function Card({ title, lede, children }: { title: string; lede?: string; children: React.ReactNode }) {
  return (
    <section className="glass p-5 sm:p-7">
      <h2 className="font-serif text-[1.7rem] leading-tight">{title}</h2>
      {lede && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{lede}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="mt-3 block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-accent"> *</span>}
        {hint && <span className="ml-2 font-normal text-ink-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function RowActions({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <div className="flex gap-1">
      <button type="button" className="btn btn-quiet !px-2.5 !py-1" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Move up">
        ↑
      </button>
      <button type="button" className="btn btn-quiet !px-2.5 !py-1" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label="Move down">
        ↓
      </button>
      <button type="button" className="btn btn-quiet !px-2.5 !py-1" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}

function replace<T>(xs: T[], i: number, x: T): T[] {
  return xs.map((y, j) => (j === i ? x : y));
}

function move<T>(xs: T[], from: number, to: number): T[] {
  const out = [...xs];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

export { startScratch };
