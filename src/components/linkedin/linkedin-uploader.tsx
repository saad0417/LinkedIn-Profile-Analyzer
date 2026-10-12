"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { analyzeLinkedInFile, setLinkedIn } from "@/lib/client/linkedin-session";
import { AnalyzingPanel, Busy } from "@/components/loading";

export function LinkedInUploader() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<false | "file" | "sample">(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const id = useId();

  function choose(f?: File | null) {
    setError(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Upload the PDF from LinkedIn: open your profile, click More (or Resources), then Save to PDF.");
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      setError("That file is over 4 MB. LinkedIn exports are usually well under 1 MB.");
      return;
    }
    setFile(f);
  }

  async function run(f: File, mode: "file" | "sample") {
    setBusy(mode);
    setError(null);
    const r = await analyzeLinkedInFile(f);
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    setLinkedIn({ result: r.result, fileName: f.name, review: null });
    router.push("/linkedin/results");
  }

  async function sample() {
    setBusy("sample");
    try {
      const blob = await (await fetch("/samples/sample-linkedin.pdf")).blob();
      await run(new File([blob], "sample-linkedin.pdf", { type: "application/pdf" }), "sample");
    } catch {
      setError("The sample didn't load. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form
      className={`glass overflow-hidden ${busy ? "max-sm:min-h-[480px]" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (file) run(file, "file");
        else input.current?.click();
      }}
    >
      <div className="p-5 sm:p-7">
        <label htmlFor={id} className="font-medium">
          Your LinkedIn profile PDF
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
          onClick={() => input.current?.click()}
          className={`mt-3 flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius)] border px-5 py-6 text-center transition-all ${
            dragging ? "border-accent/50 bg-accent-soft/60" : "border-dashed border-ink/15 bg-white/45 hover:bg-white/70"
          }`}
        >
          <input
            ref={input}
            id={id}
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={(e) => choose(e.target.files?.[0])}
            onClick={(e) => e.stopPropagation()}
          />
          {file ? (
            <>
              <p className="break-all font-medium">{file.name}</p>
              <p className="mt-1 text-sm text-ink-muted">choose a different file</p>
            </>
          ) : (
            <>
              <p className="font-medium">
                Drop the PDF here, or <span className="underline decoration-accent underline-offset-4">browse</span>
              </p>
              <p className="mt-1 text-sm text-ink-muted">The file LinkedIn gives you from &ldquo;Save to PDF&rdquo;</p>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-[var(--glass-line)] bg-white/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="submit" className="btn btn-primary" disabled={!!busy}>
            {busy === "file" ? <Busy>Analyzing…</Busy> : "Analyze my profile"}
          </button>
          <button type="button" onClick={sample} disabled={!!busy} className="text-left text-sm text-ink-muted underline decoration-rule-strong underline-offset-4 hover:text-ink">
            {busy === "sample" ? "Loading the sample…" : "Try a sample profile"}
          </button>
        </div>
        <p className="text-xs text-ink-muted">Read in memory, never stored</p>
      </div>
      {error && (
        <p role="alert" className="border-t border-bad/20 bg-bad-soft/70 px-5 py-3 text-sm text-bad sm:px-7">
          {error}
        </p>
      )}
      {busy && (
        <div className="absolute inset-0 z-10 flex cursor-progress items-center justify-center overflow-y-auto bg-[rgba(255,254,251,0.88)] p-6 backdrop-blur-md sm:p-8">
          <AnalyzingPanel
            title={busy === "sample" ? "Analyzing the sample profile" : "Analyzing your profile"}
            steps={[
              "Reading your LinkedIn PDF",
              "Separating the sidebar from your experience",
              "Checking headline, About and roles",
              "Scoring all seven sections",
            ]}
            stepMs={650}
          />
        </div>
      )}
    </form>
  );
}
