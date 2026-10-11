"use client";

import { useState } from "react";
import { updateSession } from "@/lib/client/session";
import type { AnalysisResult, AnalyzeResponse, KeywordHit } from "@/lib/types";

export function JobMatch({ result, jd }: { result: AnalysisResult; jd: string | null }) {
  const [text, setText] = useState(jd ?? "");
  const [editing, setEditing] = useState(!result.match);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const match = result.match;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, jd: text }),
      });
      const data = (await res.json()) as AnalyzeResponse;
      if (!data.ok) setError(data.error);
      else {
        updateSession({ result: data.result, jd: text.trim() });
        setEditing(false);
      }
    } catch {
      setError("We couldn't reach the server. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form onSubmit={submit} className="glass p-5 sm:p-7">
      <label htmlFor="jd-input" className="font-medium">
        {match ? "Compare against a different job" : "Paste the job description"}
      </label>
      <p className="mt-1 text-sm text-ink-muted">
        The whole posting works best: title, responsibilities and requirements. Your file isn&apos;t uploaded again.
      </p>
      <textarea
        id="jd-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        maxLength={20000}
        className="field mt-3 text-sm leading-relaxed"
        placeholder="Senior Data Analyst&#10;&#10;About the role…"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
          {busy ? "Comparing…" : "Compare"}
        </button>
        {match && (
          <button type="button" className="text-sm text-ink-muted underline underline-offset-4" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-bad">
          {error}
        </p>
      )}
    </form>
  );

  if (!match || editing) return form;

  const hard = match.keywords.filter((k) => k.kind === "hard");
  const soft = match.keywords.filter((k) => k.kind === "soft");
  const missingHard = hard.filter((k) => k.inResume === 0);

  return (
    <div className="space-y-6">
      <div className="glass grid overflow-hidden sm:grid-cols-3">
        <Stat label="Job title" value={match.jobTitle ?? "Not detected"}>
          {match.jobTitle && (
            <span className={match.titleFound ? "text-good" : "text-bad"}>
              {match.titleFound ? "Appears in your resume" : "Not in your resume"}
            </span>
          )}
        </Stat>
        <Stat label="Hard skills matched" value={`${hard.length - missingHard.length} of ${hard.length}`}>
          <span className="text-ink-muted">Tools, technologies, certifications</span>
        </Stat>
        <Stat
          label="Other keywords matched"
          value={`${soft.filter((k) => k.inResume > 0).length} of ${soft.length}`}
        >
          <span className="text-ink-muted">Phrases the posting repeats</span>
        </Stat>
      </div>

      {missingHard.length > 0 && (
        <div>
          <h3 className="font-semibold">Missing hard skills</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Recruiters search an ATS by these words. Add the ones you genuinely have, in the words the posting
            uses, ideally inside an experience bullet that shows you using them.
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {missingHard.map((k) => (
              <li key={k.term} className="chip !border-bad/20 !bg-bad-soft/80 text-bad">
                {k.term}
              </li>
            ))}
          </ul>
        </div>
      )}

      <KeywordTable title="Hard skills" rows={hard} />
      <KeywordTable title="Other keywords" rows={soft} />

      <button type="button" onClick={() => setEditing(true)} className="btn btn-secondary">
        Compare against a different job
      </button>
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--glass-line)] p-5 last:border-0 sm:border-b-0 sm:border-r sm:p-6">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-serif text-xl leading-tight">{value}</p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}

function KeywordTable({ title, rows }: { title: string; rows: KeywordHit[] }) {
  const [all, setAll] = useState(false);
  if (rows.length === 0) return null;
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <div className="glass p-5 sm:p-6">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink/30 text-left">
              <th className="py-2 pr-3 font-medium">Keyword</th>
              <th className="w-28 py-2 pr-3 text-right font-medium">In posting</th>
              <th className="w-28 py-2 text-right font-medium">In resume</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((k) => (
              <tr key={k.term} className="border-b border-[var(--glass-line)] last:border-0">
                <td className="py-2 pr-3">{k.term}</td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums text-ink-muted">{k.inJd}</td>
                <td className={`py-2 text-right font-mono tabular-nums ${k.inResume ? "text-good" : "text-bad"}`}>
                  {k.inResume || "missing"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 12 && (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-2 text-sm underline underline-offset-4">
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
