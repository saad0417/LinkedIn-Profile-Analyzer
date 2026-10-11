import Link from "next/link";
import { ATS_WEIGHTS, atsBand, atsScore } from "@/lib/ats-score";
import type { Check, Scores } from "@/lib/types";

const toneStroke = { pass: "var(--color-good)", warn: "var(--color-warn)", fail: "var(--color-bad)" } as const;
const toneText = { pass: "text-good", warn: "text-warn", fail: "text-bad" } as const;

export function ScoreRing({
  score,
  tone,
  size = 168,
  label = "out of 100",
}: {
  score: number;
  tone: keyof typeof toneStroke;
  size?: number;
  label?: string;
}) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(28,27,25,0.07)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={toneStroke[tone]}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(c * Math.max(0, Math.min(100, score))) / 100} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display leading-none tabular-nums" style={{ fontSize: size * 0.3 }}>
          {score}
        </span>
        <span className="mt-1 text-xs text-ink-muted">{label}</span>
      </div>
    </div>
  );
}

export function AtsHero({ scores, checks }: { scores: Scores; checks: Check[] }) {
  const score = atsScore(scores, checks);
  const band = atsBand(score);
  const w = scores.jobMatch === null ? ATS_WEIGHTS.noJd : ATS_WEIGHTS.withJd;
  const parts: [string, number, number][] = [
    ["Parse Integrity", scores.parseIntegrity, w.parseIntegrity],
    ["Content", scores.content, w.content],
  ];
  if (scores.jobMatch !== null) parts.push(["Job Match", scores.jobMatch, w.jobMatch]);

  return (
    <section className="glass-strong grid gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center md:gap-10" aria-label="ATS score">
      <div className="flex items-center gap-6">
        <ScoreRing score={score} tone={band.tone} />
        <div className="md:hidden">
          <p className="eyebrow">ATS score</p>
          <p className={`mt-1 font-display text-2xl leading-tight ${toneText[band.tone]}`}>{band.label}</p>
        </div>
      </div>
      <div>
        <p className="eyebrow hidden md:block">ATS score</p>
        <p className={`mt-1 hidden font-display text-[2rem] leading-tight md:block ${toneText[band.tone]}`}>
          {band.label}
        </p>
        <p className="mt-2 max-w-xl text-ink-muted">{band.note}</p>

        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-ink-muted">
          {parts.map(([label, value, weight], i) => (
            <span key={label} className="inline-flex items-center gap-2">
              {i > 0 && <span aria-hidden="true">+</span>}
              <span className="chip !py-0.5">
                {Math.round(weight * 100)}% × {label} {value}
              </span>
            </span>
          ))}
          <Link href="/how-it-works#ats-score" className="ml-1 underline decoration-rule-strong underline-offset-2 hover:text-ink">
            how this is calculated
          </Link>
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/improve" className="btn btn-primary">
            Improve my resume
          </Link>
          <a href="#issues" className="btn btn-secondary">
            See what to fix
          </a>
        </div>
      </div>
    </section>
  );
}
