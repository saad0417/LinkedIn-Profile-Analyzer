"use client";

import { useEffect, useState } from "react";

/** Small inline spinner for buttons. Inherits the text colour. */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Button label with a spinner, used while a request is in flight. */
export function Busy({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Spinner />
      {children}
    </span>
  );
}

/**
 * Advances through steps on a timer while a request runs. The last step stays
 * "in progress" until the caller unmounts this (when the request finishes), so
 * it never claims to be done before it is.
 */
function useStepper(count: number, stepMs: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= count - 1) return;
    const t = setTimeout(() => setI((n) => Math.min(n + 1, count - 1)), stepMs);
    return () => clearTimeout(t);
  }, [i, count, stepMs]);
  return i;
}

export function StepList({ steps, stepMs = 900 }: { steps: string[]; stepMs?: number }) {
  const active = useStepper(steps.length, stepMs);
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => {
        const state = i < active ? "done" : i === active ? "active" : "todo";
        return (
          <li
            key={s}
            className={`flex items-center gap-3 text-[0.95rem] transition-colors duration-300 ${
              state === "todo" ? "text-ink-faint" : "text-ink"
            }`}
          >
            <span className="relative flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
              {state === "done" ? (
                <span className="step-pop flex h-5 w-5 items-center justify-center rounded-full bg-good text-white">
                  <svg width="11" height="11" viewBox="0 0 12 12">
                    <path d="M2.5 6.5 5 9l4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : state === "active" ? (
                <Spinner className="h-5 w-5 text-accent" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-ink/15" />
              )}
            </span>
            <span className={state === "active" ? "font-medium" : ""}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** A page of a resume with a light beam sweeping down it, as if being read. */
export function ScanningDoc() {
  return (
    <div className="scan-doc relative h-[148px] w-[114px] shrink-0 overflow-hidden rounded-[10px] bg-white shadow-[0_1px_2px_rgba(60,40,20,0.1),0_14px_30px_-14px_rgba(60,40,20,0.35)]" aria-hidden="true">
      <div className="space-y-[7px] p-3">
        <div className="h-[7px] w-[60%] rounded-full bg-ink/70" />
        <div className="h-[4px] w-[80%] rounded-full bg-ink/15" />
        <div className="mt-3 h-[5px] w-[40%] rounded-full bg-accent/60" />
        {[92, 78, 85, 64].map((w, i) => (
          <div key={i} className="h-[4px] rounded-full bg-ink/15" style={{ width: `${w}%` }} />
        ))}
        <div className="mt-3 h-[5px] w-[35%] rounded-full bg-accent/60" />
        {[88, 70, 80].map((w, i) => (
          <div key={i} className="h-[4px] rounded-full bg-ink/15" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="scan-beam pointer-events-none absolute inset-x-0 h-10" />
    </div>
  );
}

/**
 * Full analysis state: scanning document + step list. Rendered as an overlay
 * inside the upload card while the file is being analysed.
 */
export function AnalyzingPanel({ title, steps, stepMs }: { title: string; steps: string[]; stepMs?: number }) {
  return (
    <div role="status" aria-live="polite" className="fade-in flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
      <ScanningDoc />
      <div className="w-full max-w-sm">
        <p className="font-display text-[1.6rem] leading-tight">{title}</p>
        <p className="mt-1 text-sm text-ink-muted">This usually takes a few seconds.</p>
        <div className="mt-5">
          <StepList steps={steps} stepMs={stepMs} />
        </div>
      </div>
    </div>
  );
}

/** Liquid-glass orb with a shimmering label: "AI is working". */
export function AiThinking({ label, detail }: { label: string; detail?: string }) {
  return (
    <div role="status" aria-live="polite" className="fade-in flex items-center gap-3.5">
      <span className="ai-orb relative h-9 w-9 shrink-0 rounded-full" aria-hidden="true" />
      <span className="min-w-0">
        <span className="shimmer-text block text-[0.98rem] font-medium">{label}</span>
        {detail && <span className="block text-sm text-ink-muted">{detail}</span>}
      </span>
    </div>
  );
}

/** Shimmering placeholder lines where generated text will appear. */
export function SkeletonLines({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  const widths = [96, 88, 72, 92, 64, 84];
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton h-3 rounded-full" style={{ width: `${widths[i % widths.length]}%` }} />
      ))}
    </div>
  );
}

/** AI working state with skeleton text underneath: drop-in for any "waiting for AI" area. */
export function AiWorking({ label, detail, lines = 3 }: { label: string; detail?: string; lines?: number }) {
  return (
    <div className="glass-well p-4 sm:p-5">
      <AiThinking label={label} detail={detail} />
      <SkeletonLines lines={lines} className="mt-4" />
    </div>
  );
}
