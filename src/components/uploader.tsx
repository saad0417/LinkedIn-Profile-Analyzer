"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { analyzeFile, setSession } from "@/lib/client/session";
import { AnalyzingPanel, Busy } from "@/components/loading";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Uploader({ autoFocusJd = false }: { autoFocusJd?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<false | "file" | "sample">(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { file: useId(), jd: useId(), hint: useId(), err: useId() };

  function choose(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    const name = f.name.toLowerCase();
    if (name.endsWith(".doc")) {
      setError("Older .doc files can't be read reliably. Open it in Word and save as .docx, or export a PDF.");
      return;
    }
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setError("Choose a PDF or Word (.docx) file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`That file is ${formatSize(f.size)}. The limit is 5 MB.`);
      return;
    }
    setFile(f);
  }

  async function run(target: File, mode: "file" | "sample") {
    setBusy(mode);
    setError(null);
    const jdText = jd.trim() || null;
    const res = await analyzeFile(target, jdText);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    setSession({ result: res.result, fileName: target.name, file: target, jd: jdText, accepted: {} });
    router.push("/results");
  }

  async function trySample() {
    setBusy("sample");
    setError(null);
    try {
      const res = await fetch("/samples/sample-resume.pdf");
      const blob = await res.blob();
      await run(new File([blob], "sample-resume.pdf", { type: "application/pdf" }), "sample");
    } catch {
      setError("The sample didn't load. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (file) run(file, "file");
        else inputRef.current?.click();
      }}
      className={`glass overflow-hidden ${busy ? "max-sm:min-h-[480px]" : ""}`}
      aria-describedby={error ? ids.err : undefined}
    >
      <div className="grid md:grid-cols-2">
        {/* Step 1: the resume */}
        <div className="border-b border-[var(--glass-line)] p-5 sm:p-7 md:border-b-0 md:border-r">
          <label htmlFor={ids.file} className="flex items-baseline gap-2 text-[0.95rem] font-medium">
            <span className="font-mono text-xs text-accent">01</span> Your resume
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              choose(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className={`mt-3 flex min-h-[176px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius)] border px-5 py-6 text-center transition-all ${
              dragging
                ? "scale-[1.01] border-accent/50 bg-accent-soft/60"
                : "border-dashed border-ink/15 bg-white/45 shadow-[inset_0_1px_2px_rgba(60,40,20,0.06)] hover:bg-white/70"
            }`}
          >
            <input
              ref={inputRef}
              id={ids.file}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-describedby={ids.hint}
              onChange={(e) => choose(e.target.files?.[0])}
              onClick={(e) => e.stopPropagation()}
            />
            <DocIcon />
            {file ? (
              <div>
                <p className="break-all font-medium">{file.name}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {formatSize(file.size)} ·{" "}
                  <span className="underline decoration-rule-strong underline-offset-2">choose a different file</span>
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">
                  Drop your resume here, or <span className="underline decoration-accent underline-offset-4">browse</span>
                </p>
                <p id={ids.hint} className="mt-1 text-sm text-ink-muted">
                  PDF or Word (.docx), up to 5 MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: optional JD */}
        <div className="p-5 sm:p-7">
          <label htmlFor={ids.jd} className="flex items-baseline gap-2 text-[0.95rem] font-medium">
            <span className="font-mono text-xs text-accent">02</span> Job description
            <span className="text-sm font-normal text-ink-muted">optional</span>
          </label>
          <textarea
            id={ids.jd}
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            autoFocus={autoFocusJd}
            rows={6}
            maxLength={20000}
            placeholder="Paste the full job posting to see which of its keywords and title your resume is missing."
            className="field mt-3 min-h-[176px] resize-y text-sm leading-relaxed"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-[var(--glass-line)] bg-white/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="submit" className="btn btn-primary" disabled={!!busy}>
            {busy === "file" ? <Busy>Checking…</Busy> : "Check my resume"}
          </button>
          <button type="button" onClick={trySample} disabled={!!busy} className="text-left text-sm text-ink-muted underline decoration-rule-strong underline-offset-4 hover:text-ink disabled:opacity-50">
            {busy === "sample" ? "Loading the sample…" : "No resume to hand? Try a sample"}
          </button>
        </div>
        <p className="flex items-center gap-2 text-xs text-ink-muted">
          <LockIcon /> Read in memory, never stored
        </p>
      </div>

      {error && (
        <p id={ids.err} role="alert" className="border-t border-bad/20 bg-bad-soft/70 px-5 py-3 text-sm text-bad sm:px-7">
          {error}
        </p>
      )}

      {busy && (
        <div className="absolute inset-0 z-10 flex cursor-progress items-center justify-center overflow-y-auto bg-[rgba(255,254,251,0.88)] p-6 backdrop-blur-md sm:p-10">
          <AnalyzingPanel
            title={busy === "sample" ? "Checking the sample resume" : "Checking your resume"}
            steps={[
              "Reading your file",
              "Extracting the text a parser would see",
              "Checking layout, headings and contact details",
              ...(jd.trim() ? ["Matching the job description"] : []),
              "Scoring every check",
            ]}
            stepMs={650}
          />
        </div>
      )}
    </form>
  );
}

function DocIcon() {
  return (
    <span className="glass-thin inline-flex h-12 w-12 items-center justify-center !rounded-2xl text-accent">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M14 3v5h5M9 13h6M9 16.5h6" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </span>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="7" width="11" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
