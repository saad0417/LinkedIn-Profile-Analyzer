"use client";

import { useState } from "react";
import { TEMPLATES, type TemplateCategory } from "@/lib/export/registry";
import type { TemplateId } from "@/lib/types";

const FILTERS: { id: "all" | TemplateCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ats-classic", label: "ATS classic" },
  { id: "ats-modern", label: "ATS modern" },
  { id: "creative", label: "Creative" },
];

export function TemplatePicker({
  value,
  onChange,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  columns?: string;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const shown = TEMPLATES.filter((t) => filter === "all" || t.category === filter);

  return (
    <div>
      <div role="tablist" aria-label="Template type" className="segmented mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <fieldset>
        <legend className="sr-only">Template</legend>
        <div className={`grid gap-4 ${columns}`}>
          {shown.map((t) => (
            <label
              key={t.id}
              className={`glass group flex cursor-pointer flex-col p-3 transition-all ${
                value === t.id ? "ring-2 ring-ink/70 ring-offset-2 ring-offset-transparent" : "hover:-translate-y-0.5"
              }`}
            >
              <input
                type="radio"
                name="template"
                value={t.id}
                checked={value === t.id}
                onChange={() => onChange(t.id)}
                className="sr-only"
              />
              <div className="relative aspect-[8.5/11] overflow-hidden rounded-[var(--radius)] bg-white shadow-[0_1px_2px_rgba(60,40,20,0.08)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.preview} alt={`${t.name} template preview`} loading="lazy" className="h-full w-full object-cover object-top" />
                <span
                  className={`chip absolute left-2 top-2 !text-[0.75rem] font-medium ${
                    t.atsSafe ? "!border-good/20 !bg-good-soft/90 text-good" : "!border-warn/25 !bg-warn-soft/95 text-warn"
                  }`}
                >
                  {t.atsSafe ? "ATS-safe" : "Not for ATS uploads"}
                </span>
              </div>
              <div className="flex flex-1 items-start gap-2 px-1 pb-1 pt-3">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-3 w-3 shrink-0 rounded-full border ${
                    value === t.id ? "border-ink bg-ink shadow-[inset_0_0_0_2px_var(--color-white)]" : "border-rule-strong"
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
    </div>
  );
}
