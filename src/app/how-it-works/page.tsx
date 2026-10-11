import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "How Our ATS Resume Scoring Works",
  description:
    "The exact method behind Parse Integrity, Content and Job Match scores: every check, what it looks for, how much it weighs, and what we deliberately don't claim.",
  alternates: { canonical: "/how-it-works" },
  openGraph: { url: "/how-it-works", title: `How Our ATS Resume Scoring Works | ${site.name}` },
};

type Row = { check: string; looks: string; impact: "High" | "Medium" | "Low" };

const parse: Row[] = [
  { check: "Extractable text", looks: "Whether any text can be pulled from the file. Image-only resumes fail and cap the score at 5.", impact: "High" },
  { check: "Name, email, phone", looks: "Each located in the document body where every parser reads.", impact: "High" },
  { check: "Single-column layout", looks: "Text positions on each PDF page, looking for two separate columns with an empty gutter between them. Right-aligned dates don't count.", impact: "High" },
  { check: "Layout tables", looks: "Word tables used to position titles, dates and companies.", impact: "High" },
  { check: "Header and footer content", looks: "Contact details placed in Word headers or footers, which many parsers skip.", impact: "High" },
  { check: "Text boxes and shapes", looks: "Content inside floating boxes, often dropped during extraction.", impact: "Medium" },
  { check: "Section headings", looks: "Headings matched against the dictionary parsers use: Experience, Education, Skills and close variants.", impact: "Medium" },
  { check: "Date ranges and format", looks: "At least one date range found, written with months, in one consistent style.", impact: "Medium" },
  { check: "Graphics", looks: "Images and drawn shapes in the content area, such as skill bars and icon rows.", impact: "Low" },
  { check: "Fonts", looks: "Decorative web fonts that may not exist on the processing server.", impact: "Low" },
];

const content: Row[] = [
  { check: "Quantified bullets", looks: "The share of experience bullets that contain a number.", impact: "Medium" },
  { check: "Weak openers", looks: "Bullets starting 'Responsible for', 'Helped with', 'Worked on', 'Assisted in' and similar.", impact: "Medium" },
  { check: "Action verbs", looks: "The share of bullets that open with a strong action verb; 70% or more passes.", impact: "Medium" },
  { check: "Skills section", looks: "A Skills heading with roughly 6 to 40 items recruiters can search for.", impact: "Medium" },
  { check: "Padding", looks: "Bullets under five words and the same opening verb repeated many times.", impact: "Low" },
  { check: "Bullet length", looks: "Bullets over 30 words, and roles with more than eight bullets.", impact: "Low" },
  { check: "Summary", looks: "A short summary at the top: present, and between about 15 and 120 words.", impact: "Low" },
  { check: "Length", looks: "One or two pages is fine at any level. Three pages warns, four or more fails.", impact: "Low" },
  { check: "Location", looks: "A city and region present, and no full street address.", impact: "Low" },
  { check: "Employment gaps", looks: "Gaps over six months between consecutive roles. Only ever a warning: nothing shows ATS penalise gaps.", impact: "Low" },
  { check: "LinkedIn URL", looks: "A linkedin.com/in/ address anywhere in the document.", impact: "Low" },
  { check: "First-person pronouns", looks: "'I', 'me', 'my' in bullets and the summary.", impact: "Low" },
  { check: "Resume spelling", looks: "'Résumé' with accents, which some systems store unreliably.", impact: "Low" },
];

const match: Row[] = [
  { check: "Job title", looks: "The posting's title, or a close variant, anywhere in your resume.", impact: "High" },
  { check: "Hard skills", looks: "Tools, technologies, certifications and methods from a curated dictionary, found in the posting and counted in both documents.", impact: "High" },
  { check: "Other keywords", looks: "Multi-word phrases the posting repeats.", impact: "Medium" },
];

export default function HowItWorks() {
  return (
    <div className="container-page pt-12 sm:pt-20">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: "How our ATS resume scoring works",
          description: metadata.description,
          url: `${site.url}/how-it-works`,
          author: { "@type": "Organization", name: site.name },
        }}
      />
      <div className="max-w-3xl">
        <p className="eyebrow">Method</p>
        <h1 className="mt-3 font-display text-[2.3rem] leading-[1.12] sm:text-[3.4rem]">How scoring works.</h1>
        <p className="mt-5 text-[1.05rem] text-ink-muted">
          Every number on your results page is a sum of named checks. Each check passes (full points), warns (half)
          or fails (none). The rules are fixed and contain no AI, so the same file always gets the same score.
          Here is every check and what it looks at.
        </p>
      </div>

      <div className="mt-12 space-y-8">
        <ScoreTable
          title="Parse Integrity"
          lede="Does your content survive being read by a parser? Works without a job description."
          rows={parse}
        />
        <ScoreTable
          title="Content"
          lede="Conventions recruiters expect once they're reading. Length on its own is never penalised: two pages perform as well as one."
          rows={content}
        />
        <ScoreTable
          title="Job Match"
          lede="Only calculated when you paste a job description. A match score without a job to match is not a measurement."
          rows={match}
        />
      </div>

      <section id="ats-score" className="glass-strong mt-16 scroll-mt-24 p-7 sm:p-12" aria-labelledby="ats-h">
        <p className="eyebrow">The headline number</p>
        <h2 id="ats-h" className="mt-3 font-serif text-[2.1rem] leading-[1.08] sm:text-[2.5rem]">
          How the ATS score out of 100 is built.
        </h2>
        <p className="mt-4 max-w-3xl text-ink-muted">
          The ATS score is a weighted average of the three scores above, so it always breaks down into checks you can
          open. Weights follow our research into how applicant tracking systems parse and search resumes: whether your
          content survives extraction matters most, then how it reads.
        </p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="glass-well p-5">
            <p className="font-medium">Without a job description</p>
            <p className="mt-2 font-mono text-sm text-ink-muted">55% Parse Integrity + 45% Content</p>
          </div>
          <div className="glass-well p-5">
            <p className="font-medium">With a job description</p>
            <p className="mt-2 font-mono text-sm text-ink-muted">36% Parse Integrity + 29% Content + 35% Job Match</p>
          </div>
        </div>
        <p className="mt-5 max-w-3xl text-sm text-ink-muted">
          Two caps apply because some failures make everything else irrelevant: if no text can be read from the file,
          the score can&apos;t exceed 30; if neither an email nor a phone number can be found, it can&apos;t exceed 60.
        </p>
      </section>

      <section id="linkedin" className="glass mt-8 scroll-mt-24 p-7 sm:p-12" aria-labelledby="li-h">
        <p className="eyebrow">LinkedIn profiles</p>
        <h2 id="li-h" className="mt-3 font-serif text-[2.1rem] leading-[1.08] sm:text-[2.5rem]">
          How the LinkedIn score works.
        </h2>
        <p className="mt-4 max-w-3xl text-ink-muted">
          The LinkedIn analyzer reads the PDF that LinkedIn&apos;s &ldquo;Save to PDF&rdquo; produces and scores seven
          sections with fixed rules: Experience 30%, About 20%, Headline 15%, Skills 12%, Contact 10%, Education 8%,
          Credentials 5%. Your photo, banner, recommendations and activity aren&apos;t in that PDF, so they aren&apos;t
          scored. The optional AI review writes feedback and drafts but never changes the number.
        </p>
        <Link href="/linkedin" className="btn btn-secondary mt-6">
          Analyze my LinkedIn profile
        </Link>
      </section>

      <section id="limits" className="glass-strong mt-8 scroll-mt-24 p-7 sm:p-12">
        <p className="eyebrow">Limits</p>
        <h2 className="mt-3 font-serif text-[2.1rem] leading-[1.08] sm:text-[2.5rem]">What we don&apos;t claim.</h2>
        <ul className="mt-6 grid gap-6 text-[0.95rem] text-ink-muted md:grid-cols-2">
          <li>
            <strong className="block text-ink">We don&apos;t simulate a specific vendor.</strong>
            Workday, Greenhouse, iCIMS and others each use their own parser. Ours applies the failure modes they
            share. A clean result here is strong evidence, not a guarantee.
          </li>
          <li>
            <strong className="block text-ink">We don&apos;t predict interviews.</strong>
            No score can. People decide who gets interviewed; these checks make sure they can find and read you.
          </li>
          <li>
            <strong className="block text-ink">AI writes, it never scores.</strong>
            Rewrites and explanations are generated on request. Scores never pass through a language model, so
            they can&apos;t drift between runs.
          </li>
          <li>
            <strong className="block text-ink">Keyword matching is literal.</strong>
            We match words and close variants, not meaning. If you have a skill under another name, consider
            adding the posting&apos;s wording too.
          </li>
        </ul>
      </section>

      <div className="mt-12">
        <Link href="/#check" className="btn btn-primary">
          Check my resume
        </Link>
      </div>
    </div>
  );
}

function ScoreTable({ title, lede, rows }: { title: string; lede: string; rows: Row[] }) {
  const tone = { High: "text-bad", Medium: "text-warn", Low: "text-ink-muted" } as const;
  return (
    <section className="glass p-6 sm:p-8" aria-labelledby={`${title}-h`}>
      <h2 id={`${title}-h`} className="font-serif text-[2rem] leading-tight">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-ink-muted">{lede}</p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[0.92rem]">
          <thead>
            <tr className="border-b border-ink/30 text-left">
              <th className="w-56 py-2.5 pr-4 font-semibold">Check</th>
              <th className="py-2.5 pr-4 font-semibold">What it looks at</th>
              <th className="w-24 py-2.5 font-semibold">Impact</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.check} className="border-b border-[var(--glass-line)] align-top last:border-0">
                <td className="py-3 pr-4 font-medium">{r.check}</td>
                <td className="py-3 pr-4 text-ink-muted">{r.looks}</td>
                <td className={`py-3 ${tone[r.impact]}`}>{r.impact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
