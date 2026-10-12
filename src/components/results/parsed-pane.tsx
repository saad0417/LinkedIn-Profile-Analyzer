"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/types";

/**
 * "What the parser saw": the extracted record, styled as machine output, with
 * every empty field called out. This view is the product's main argument.
 */
export function ParsedPane({ result }: { result: AnalysisResult }) {
  const [view, setView] = useState<"fields" | "raw">("fields");
  const p = result.profile;

  return (
    <div className="glass-strong overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--glass-line)] px-4 py-3 sm:px-5">
        <span className="font-mono text-[0.92rem] uppercase tracking-[0.08em] text-ink-muted">Parser output</span>
        <div role="tablist" aria-label="Parser output view" className="segmented">
          {(["fields", "raw"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
            >
              {v === "fields" ? "Fields" : "Raw text"}
            </button>
          ))}
        </div>
      </div>

      {view === "raw" ? (
        <div className="max-h-[900px] overflow-auto p-4 sm:p-5">
          <p className="mb-3 text-xs text-ink-muted">
            The plain text extracted, in the order a parser reads it. Where lines from different columns or
            boxes run together, that is what a recruiter&apos;s system stored.
          </p>
          <pre className="whitespace-pre-wrap break-words font-mono text-[0.92rem] leading-relaxed text-ink">
            {result.rawText.trim() || "(no text could be extracted)"}
          </pre>
        </div>
      ) : (
        <div className="divide-y divide-[var(--glass-line)]">
          <Group title="Contact">
            <Field label="Name" value={p.name} />
            <Field label="Email" value={p.email} />
            <Field label="Phone" value={p.phone} />
            <Field label="LinkedIn" value={p.linkedin} optional />
            <Field label="Location" value={p.location} optional />
            {p.links.length > 0 && <Field label="Links" value={p.links.join("\n")} />}
          </Group>

          {p.summary !== null && (
            <Group title="Summary">
              <p className="font-mono text-[0.92rem] leading-relaxed">{p.summary}</p>
            </Group>
          )}

          <Group title={`Experience · ${p.experience.length} ${p.experience.length === 1 ? "role" : "roles"}`}>
            {p.experience.length === 0 ? (
              <Missing>No roles could be separated out.</Missing>
            ) : (
              <ol className="space-y-4">
                {p.experience.map((r, i) => (
                  <li key={i} className="font-mono text-[0.92rem] leading-relaxed">
                    <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-0.5">
                      <Key>title</Key>
                      <Val v={r.title} />
                      <Key>company</Key>
                      <Val v={r.company} />
                      <Key>dates</Key>
                      <Val v={r.dates} />
                      <Key>bullets</Key>
                      <span className={r.bullets.length ? "" : "text-bad"}>{r.bullets.length}</span>
                    </div>
                    {r.bullets.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 border-l-2 border-ink/10 pl-3 text-ink-muted">
                        {r.bullets.slice(0, 3).map((b, j) => (
                          <li key={j} className="line-clamp-2">
                            {b}
                          </li>
                        ))}
                        {r.bullets.length > 3 && <li className="text-ink-faint">+ {r.bullets.length - 3} more</li>}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Group>

          <Group title="Education">
            {p.education.length === 0 ? (
              <Missing>No education entries found.</Missing>
            ) : (
              <ul className="space-y-3">
                {p.education.map((e, i) => (
                  <li key={i} className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-0.5 font-mono text-[0.92rem]">
                    <Key>school</Key>
                    <Val v={e.institution} />
                    <Key>degree</Key>
                    <Val v={e.degree} />
                    <Key>dates</Key>
                    <Val v={e.dates} />
                  </li>
                ))}
              </ul>
            )}
          </Group>

          <Group title={`Skills · ${p.skills.length}`}>
            {p.skills.length === 0 ? (
              <Missing>No skills section was recognised.</Missing>
            ) : (
              <p className="font-mono text-[0.92rem] leading-relaxed">{p.skills.join(" · ")}</p>
            )}
          </Group>

          {p.certifications.length > 0 && (
            <Group title="Certifications">
              <p className="font-mono text-[0.92rem] leading-relaxed">{p.certifications.join(" · ")}</p>
            </Group>
          )}

          <Group title="Section headings found">
            {p.sections.length === 0 ? (
              <Missing>No section headings were recognised.</Missing>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {p.sections.map((s, i) => (
                  <li
                    key={i}
                    className={`chip cursor-help font-mono !text-[0.9rem] ${s.kind ? "text-ink" : "!border-warn/40 !bg-warn-soft/80 text-warn"}`}
                    title={s.kind ? `Recognised as ${s.kind}` : "Not a standard heading"}
                  >
                    {s.heading}
                    {!s.kind && " ?"}
                  </li>
                ))}
              </ul>
            )}
          </Group>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-4 py-4 sm:px-5">
      <h3 className="mb-2.5 text-[0.9rem] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value, optional }: { label: string; value: string | null; optional?: boolean }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 py-0.5 font-mono text-[0.92rem]">
      <Key>{label.toLowerCase()}</Key>
      {value ? (
        <span className="whitespace-pre-line break-all font-semibold">{value}</span>
      ) : (
        <span className={optional ? "text-ink-muted" : "font-semibold text-bad"}>{optional ? "not found" : "NOT FOUND"}</span>
      )}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <span className="text-ink-muted">{children}</span>;
}

function Val({ v }: { v: string | null }) {
  return v ? <span className="break-words font-semibold">{v}</span> : <span className="font-semibold text-bad">empty</span>;
}

function Missing({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[0.92rem] text-bad">{children}</p>;
}
