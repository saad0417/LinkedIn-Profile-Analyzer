"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getDraft, patchDraft } from "@/lib/client/draft";
import { TEMPLATES, type TemplateCategory } from "@/lib/export/registry";
import type { TemplateId } from "@/lib/types";
import { startScratch } from "@/components/builder/builder-view";

const FILTERS: { id: "all" | TemplateCategory; label: string }[] = [
  { id: "all", label: "All templates" },
  { id: "ats-classic", label: "ATS classic" },
  { id: "ats-modern", label: "ATS modern" },
  { id: "creative", label: "Creative" },
];

export function TemplateLibrary() {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const shown = TEMPLATES.filter((t) => filter === "all" || t.category === filter);

  function use(id: TemplateId) {
    if (getDraft()) patchDraft({ template: id });
    else startScratch(id);
    router.push("/builder");
  }

  return (
    <div>
      <div role="tablist" aria-label="Filter templates" className="segmented flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t, i) => (
          <article key={t.id} className="glass flex flex-col p-4">
            <div className="relative aspect-[8.5/11] overflow-hidden rounded-[var(--radius)] bg-white shadow-[0_1px_2px_rgba(60,40,20,0.08)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.preview}
                alt={`Preview of the ${t.name} resume template`}
                // The first row is the largest thing on screen (LCP): load it immediately.
                loading={i < 3 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                width={800}
                height={1036}
                className="h-full w-full object-cover object-top"
              />
            </div>
            <div className="flex flex-1 flex-col px-2 pb-2 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <h2 className="font-serif text-[1.6rem] leading-tight">{t.name}</h2>
                <span
                  className={`chip shrink-0 !text-[0.78rem] font-medium ${
                    t.atsSafe ? "!border-good/20 !bg-good-soft/90 text-good" : "!border-warn/25 !bg-warn-soft/95 text-warn"
                  }`}
                >
                  {t.atsSafe ? "ATS-safe" : "Not for ATS uploads"}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">{t.description}</p>
              <p className="mt-3 text-sm">
                <span className="font-medium">Best for:</span> <span className="text-ink-muted">{t.bestFor}</span>
              </p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-3 pt-5">
                <button type="button" onClick={() => use(t.id)} className="btn btn-primary !px-4 !py-2 !text-sm">
                  Use this template
                </button>
                <span className="flex items-center gap-1 text-sm text-ink-muted">
                  Sample:
                  <a href={`/api/export?template=${t.id}&format=docx`} className="rounded-full px-2 py-1 font-medium text-ink hover:bg-white/70" download>
                    Word
                  </a>
                  <a href={`/api/export?template=${t.id}&format=pdf`} className="rounded-full px-2 py-1 font-medium text-ink hover:bg-white/70" download>
                    PDF
                  </a>
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
