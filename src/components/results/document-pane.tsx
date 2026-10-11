"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalysisResult } from "@/lib/types";

/* Minimal surface of pdf.js that we use; it's loaded from /vendor at runtime. */
interface PdfPage {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas: HTMLCanvasElement }): {
    promise: Promise<void>;
  };
}
interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}
interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(o: { data: Uint8Array }): { promise: Promise<PdfDoc> };
}

let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs() {
  const src = "/vendor/pdfjs/pdf.min.mjs";
  pdfjsPromise ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ src).then((m: PdfJs) => {
    m.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
    return m;
  });
  return pdfjsPromise;
}

export function DocumentPane({ result, file }: { result: AnalysisResult; file: File | null }) {
  if (result.document.kind === "docx") {
    return result.sourceHtml ? (
      <div className="rounded-[var(--radius-sm)] bg-white px-6 py-7 shadow-[0_1px_2px_rgba(60,40,20,0.08),0_12px_30px_-12px_rgba(60,40,20,0.25)] sm:px-10">
        <div className="doc-render" dangerouslySetInnerHTML={{ __html: result.sourceHtml }} />
        <p className="mt-6 border-t border-rule/70 pt-3 text-xs text-ink-muted">
          Shown as a simplified rendering of the Word body. Headers, footers and text boxes are not shown here,
          which is also roughly what many parsers see.
        </p>
      </div>
    ) : (
      <Placeholder>We couldn&apos;t render a preview of this Word file.</Placeholder>
    );
  }
  if (!file) {
    return (
      <Placeholder>
        Your original file isn&apos;t kept after a page reload, so the preview is gone. The extracted results on
        the right are unaffected. Check the file again to see both side by side.
      </Placeholder>
    );
  }
  return <PdfPages file={file} />;
}

export function PdfPages({ file }: { file: Blob }) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let doc: PdfDoc | null = null;
    const el = holder.current;
    if (!el) return;

    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const data = new Uint8Array(await file.arrayBuffer());
        doc = await pdfjs.getDocument({ data }).promise;
        el.replaceChildren();
        const width = el.clientWidth || 600;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
          if (cancelled) return;
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.className = "block rounded-[10px] bg-white shadow-[0_1px_2px_rgba(60,40,20,0.08),0_12px_30px_-12px_rgba(60,40,20,0.25)]";
          canvas.setAttribute("aria-label", `Page ${n} of your resume`);
          canvas.setAttribute("role", "img");
          el.appendChild(canvas);
          const ctx = canvas.getContext("2d");
          if (ctx) await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        }
        if (!cancelled) setState("done");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      doc?.destroy().catch(() => {});
    };
  }, [file]);

  return (
    <div>
      {state === "loading" && <Placeholder>Rendering your PDF…</Placeholder>}
      {state === "error" && <Placeholder>We couldn&apos;t draw a preview of this PDF in your browser.</Placeholder>}
      <div ref={holder} className="space-y-4" />
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-thin flex min-h-[240px] items-center justify-center p-8 text-center text-sm text-ink-muted">
      <p className="max-w-sm">{children}</p>
    </div>
  );
}
