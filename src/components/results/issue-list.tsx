"use client";

import { useState } from "react";
import { acceptRewrite } from "@/lib/client/session";
import { useAi } from "@/components/ai-context";
import { AiWorking, SkeletonLines, AiThinking } from "@/components/loading";
import { callLlm } from "@/lib/client/api";
import type { Check, RewriteTarget } from "@/lib/types";
import { Caret } from "./score-summary";
import { anchorFor, categoryText, severityText, sortChecks, statusColor, StatusMark, statusText } from "./ui";
import type { CheckStatus } from "@/lib/types";

const statusBar: Record<CheckStatus, string> = { pass: "bg-good", warn: "bg-warn", fail: "bg-bad" };
const statusChip: Record<CheckStatus, string> = {
  pass: "!bg-good-soft/80 !border-good/20",
  warn: "!bg-warn-soft/80 !border-warn/25",
  fail: "!bg-bad-soft/80 !border-bad/20",
};

export function IssueList({
  checks,
  accepted,
  roleHint,
}: {
  checks: Check[];
  accepted: Record<string, string>;
  roleHint: string | null;
}) {
  const sorted = sortChecks(checks);
  const open = sorted.filter((c) => c.status !== "pass");
  const passed = sorted.filter((c) => c.status === "pass");
  const [showPassed, setShowPassed] = useState(false);

  return (
    <div>
      {open.length === 0 ? (
        <p className="glass px-6 py-5 text-good">
          Nothing to fix. Every check passed.
        </p>
      ) : (
        <ol className="space-y-4">
          {open.map((c) => (
            <li key={c.id}>
              <IssueCard check={c} accepted={accepted} roleHint={roleHint} />
            </li>
          ))}
        </ol>
      )}

      {passed.length > 0 && (
        <div className="glass-thin mt-8 px-5 py-4">
          <button
            type="button"
            onClick={() => setShowPassed((s) => !s)}
            aria-expanded={showPassed}
            className="inline-flex items-center gap-2 text-sm font-medium hover:text-accent"
          >
            <Caret open={showPassed} />
            {passed.length} {passed.length === 1 ? "check" : "checks"} passed
          </button>
          {showPassed && (
            <ul className="mt-3 divide-y divide-[var(--glass-line)]">
              {passed.map((c) => (
                <li key={c.id} id={anchorFor(c.id)} className="flex scroll-mt-24 gap-3 py-3 text-sm">
                  <StatusMark status="pass" className="mt-1" />
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-ink-muted">{c.summary}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function IssueCard({
  check: c,
  accepted,
  roleHint,
}: {
  check: Check;
  accepted: Record<string, string>;
  roleHint: string | null;
}) {
  const [explain, setExplain] = useState<{ state: "idle" | "loading" | "done" | "error"; text?: string }>({
    state: "idle",
  });
  const ai = useAi();
  const targets = ai ? (c.rewriteTargets ?? []) : [];

  async function doExplain() {
    setExplain({ state: "loading" });
    const r = await callLlm({
      task: "explain",
      checkId: c.id,
      title: c.title,
      summary: c.summary,
      evidence: c.evidence?.slice(0, 3).map((e) => e.text),
    });
    setExplain(r.ok ? { state: "done", text: r.text } : { state: "error", text: r.error });
  }

  return (
    <article
      id={anchorFor(c.id)}
      className="glass scroll-mt-28 overflow-hidden"
    >
      <span aria-hidden="true" className={`absolute inset-y-5 left-0 w-[3px] rounded-r-full ${statusBar[c.status]}`} />
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className={`chip font-semibold uppercase tracking-wide !text-[0.8rem] ${statusColor[c.status]} ${statusChip[c.status]}`}>
            <StatusMark status={c.status} />
            {statusText[c.status]}
          </span>
          <span className="text-ink-faint">·</span>
          <span className="text-ink-muted">{severityText[c.severity]}</span>
          <span className="text-ink-faint">·</span>
          <span className="text-ink-muted">{categoryText[c.category]}</span>
        </div>

        <h3 className="mt-2 text-lg font-semibold leading-snug">{c.title}</h3>
        <p className="mt-2 text-[1.02rem] leading-relaxed text-ink">{c.summary}</p>

        {c.evidence && c.evidence.length > 0 && targets.length === 0 && (
          <ul className="mt-4 space-y-2">
            {c.evidence.slice(0, 5).map((e, i) => (
              <li key={i} className="glass-well px-3.5 py-2.5">
                <q className="font-mono text-[0.92rem] leading-relaxed text-ink before:content-none after:content-none">
                  {e.text}
                </q>
                {e.where && <span className="mt-0.5 block text-xs text-ink-muted">{e.where}</span>}
              </li>
            ))}
            {c.evidence.length > 5 && (
              <li className="text-xs text-ink-muted">and {c.evidence.length - 5} more like these</li>
            )}
          </ul>
        )}

        {c.why && <p className="mt-4 text-sm text-ink-muted">{c.why}</p>}

        {c.fix && (
          <div className="mt-4 flex gap-3 text-[0.95rem]">
            <span className="shrink-0 font-semibold text-accent">How to fix</span>
            <p>{c.fix}</p>
          </div>
        )}

        {targets.length > 0 && (
          <ul className="mt-5 space-y-3">
            {targets.slice(0, 6).map((t, i) => (
              <li key={i}>
                <RewriteRow target={t} accepted={accepted[t.text]} roleHint={roleHint} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {ai && (explain.state === "idle" || explain.state === "error") ? (
            <button type="button" onClick={doExplain} className="btn btn-quiet">
              Explain this in plain English
            </button>
          ) : null}
        </div>
        {explain.state === "loading" && (
          <div className="mt-3">
            <AiWorking label="Writing a plain-English explanation…" lines={3} />
          </div>
        )}
        {explain.state === "done" && (
          <div className="glass-well fade-in mt-3 px-4 py-3 text-sm leading-relaxed text-ink">
            <p className="whitespace-pre-line">{explain.text}</p>
            <p className="mt-2 text-xs text-ink-faint">Written by AI from this finding. The score above is not.</p>
          </div>
        )}
        {explain.state === "error" && <p className="mt-2 text-sm text-warn">{explain.text}</p>}
      </div>
    </article>
  );
}

function RewriteRow({
  target,
  accepted,
  roleHint,
}: {
  target: RewriteTarget;
  accepted: string | undefined;
  roleHint: string | null;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [text, setText] = useState("");
  const [role, setRole] = useState(roleHint ?? "");
  const [copied, setCopied] = useState(false);

  async function go() {
    if (target.kind === "summary" && !role.trim()) return;
    setState("loading");
    const r = await callLlm(
      target.kind === "bullet"
        ? { task: "rewrite-bullet", bullet: target.text, role: roleHint }
        : { task: "rewrite-summary", summary: target.text, targetRole: role.trim() },
    );
    if (r.ok) {
      setText(r.text);
      setState("done");
    } else {
      setText(r.error);
      setState("error");
    }
  }

  return (
    <div className="glass-well overflow-hidden">
      <p className="px-3.5 py-2.5 font-mono text-[0.92rem] leading-relaxed text-ink-muted">
        <span className="sr-only">Original: </span>
        {target.text}
      </p>

      {state === "loading" ? (
        <div className="border-t border-[var(--glass-line)] bg-white/50 px-3.5 py-3.5">
          <AiThinking label={target.kind === "bullet" ? "Writing a stronger bullet…" : "Rewriting your summary…"} />
          <SkeletonLines lines={target.kind === "bullet" ? 2 : 3} className="mt-3.5" />
        </div>
      ) : state === "done" ? (
        <div className="fade-in border-t border-[var(--glass-line)] bg-white/60 px-3.5 py-3">
          <p className="text-[0.92rem] leading-relaxed">
            <Highlighted text={text} />
          </p>
          <p className="mt-1.5 text-xs text-ink-muted">
            Replace each <span className="font-mono text-accent">[metric]</span> with a real number you can stand
            behind. Nothing here was invented, so nothing was filled in for you.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                navigator.clipboard?.writeText(text).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              disabled={accepted === text}
              onClick={() => acceptRewrite(target.text, text)}
            >
              {accepted === text ? "Will be used in your download" : "Use in my download"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={go}>
              Try another
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-t border-[var(--glass-line)] px-3.5 py-2.5 sm:flex-row sm:items-center">
          {target.kind === "summary" && (
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Target role, e.g. Product Analyst"
              maxLength={120}
              className="field !py-1.5 text-sm sm:max-w-xs"
              aria-label="Target role for the summary rewrite"
            />
          )}
          <button
            type="button"
            onClick={go}
            disabled={target.kind === "summary" && !role.trim()}
            className="btn btn-quiet self-start"
          >
            {target.kind === "bullet" ? "Suggest a stronger bullet" : "Rewrite summary for this role"}
          </button>
          {state === "error" && <span className="text-sm text-warn">{text}</span>}
        </div>
      )}
    </div>
  );
}

function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[metric\])/gi);
  return (
    <>
      {parts.map((p, i) =>
        /^\[metric\]$/i.test(p) ? (
          <mark key={i} className="rounded-md bg-accent-soft px-1 font-mono text-[0.85em] text-accent">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
