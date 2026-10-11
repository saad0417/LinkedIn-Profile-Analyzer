"use client";

import { useState } from "react";
import { exportResume, saveFile } from "@/lib/client/api";
import { profileToResumeContent } from "@/lib/export/content";
import { templates } from "@/lib/templates-meta";
import type { AnalysisResult, ResumeContent, TemplateId } from "@/lib/types";

function applyAccepted(content: ResumeContent, accepted: Record<string, string>): ResumeContent {
  const swap = (s: string) => accepted[s] ?? accepted[s.trim()] ?? s;
  return {
    ...content,
    summary: content.summary ? swap(content.summary) : content.summary,
    experience: content.experience.map((r) => ({ ...r, bullets: r.bullets.map(swap) })),
  };
}

export function ExportPanel({ result, accepted }: { result: AnalysisResult; accepted: Record<string, string> }) {
  const [template, setTemplate] = useState<TemplateId>("standard");
  const [format, setFormat] = useState<"docx" | "pdf">("docx");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acceptedCount = Object.keys(accepted).length;
  const placeholders = Object.values(accepted).some((t) => /\[metric\]/i.test(t));

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const content = applyAccepted(profileToResumeContent(result.profile), accepted);
      saveFile(await exportResume(content, template, format));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The download failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <fieldset>
        <legend className="sr-only">Template</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {templates.map((t) => (
            <label
              key={t.id}
              className={`glass group cursor-pointer p-3 transition-all ${
                template === t.id ? "ring-2 ring-ink/70 ring-offset-2 ring-offset-transparent" : "hover:-translate-y-0.5"
              }`}
            >
              <input
                type="radio"
                name="template"
                value={t.id}
                checked={template === t.id}
                onChange={() => setTemplate(t.id)}
                className="sr-only"
              />
              <div className="aspect-[8.5/11] overflow-hidden rounded-[var(--radius)] bg-white shadow-[0_1px_2px_rgba(60,40,20,0.08)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/templates/${t.id}.png`}
                  alt={`${t.name} template preview`}
                  loading="lazy"
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <div className="mt-3 flex items-start gap-2 px-1 pb-1">
                <span
                  aria-hidden="true"
                  className={`mt-1 h-3 w-3 shrink-0 rounded-full border ${
                    template === t.id ? "border-ink bg-ink shadow-[inset_0_0_0_2px_var(--color-white)]" : "border-rule-strong"
                  }`}
                />
                <span>
                  <span className="block font-medium">{t.name}</span>
                  <span className="block text-sm text-ink-muted">{t.blurb}</span>
                </span>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="glass mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Format</span>
          <div role="radiogroup" aria-label="File format" className="segmented">
            {(["docx", "pdf"] as const).map((f) => (
              <button
                key={f}
                role="radio"
                aria-checked={format === f}
                onClick={() => setFormat(f)}
              >
                {f === "docx" ? "Word (.docx)" : "PDF"}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={download} disabled={busy} className="btn btn-primary">
          {busy ? "Building your file…" : "Download parse-safe version"}
        </button>
      </div>

      <div className="mt-4 space-y-1.5 text-sm text-ink-muted">
        <p>
          Rebuilt from what the parser extracted above. If a field came back empty there, it will be empty here
          too, so read it through before you send it. Word is the better choice if you want to edit.
        </p>
        {acceptedCount > 0 && (
          <p className="text-ink">
            Includes {acceptedCount} AI {acceptedCount === 1 ? "rewrite" : "rewrites"} you chose.
            {placeholders && (
              <>
                {" "}
                Search the file for <span className="font-mono text-accent">[metric]</span> and fill in real numbers.
              </>
            )}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
