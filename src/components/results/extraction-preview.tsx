"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import { DocumentPane } from "./document-pane";
import { ParsedPane } from "./parsed-pane";

export function ExtractionPreview({ result, file }: { result: AnalysisResult; file: File | null }) {
  const [side, setSide] = useState<"doc" | "parsed">("parsed");
  const multiColumn = result.document.columns > 1;

  return (
    <div>
      {/* Narrow screens: one pane at a time. */}
      <div role="tablist" aria-label="Preview" className="segmented mb-4 grid w-full grid-cols-2 lg:hidden">
        {(
          [
            ["doc", "Your document"],
            ["parsed", "What the parser saw"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={side === k}
            onClick={() => setSide(k)}
            className="!py-2"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className={side === "doc" ? "" : "hidden lg:block"}>
          <PaneLabel>Your document</PaneLabel>
          {multiColumn && (
            <p className="glass-thin mb-3 !border-bad/25 !bg-bad-soft/70 px-4 py-2.5 text-sm text-bad">
              {result.document.columns} columns detected. Parsers read straight across the page, so lines from
              each column get stitched together.
            </p>
          )}
          <div className="glass-thin max-h-[1000px] overflow-auto !rounded-[var(--radius-lg)] p-3 sm:p-5">
            <DocumentPane result={result} file={file} />
          </div>
        </div>
        <div className={side === "parsed" ? "" : "hidden lg:block"}>
          <PaneLabel>What the parser saw</PaneLabel>
          <ParsedPane result={result} />
        </div>
      </div>
    </div>
  );
}

function PaneLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 hidden text-sm font-semibold lg:block">{children}</h3>;
}
