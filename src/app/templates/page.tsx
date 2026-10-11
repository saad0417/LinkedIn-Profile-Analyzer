import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { site } from "@/lib/site";
import { TemplateLibrary } from "@/components/templates/template-library";

export const metadata: Metadata = {
  title: "Free ATS-Friendly Resume Templates (Word & PDF)",
  keywords: ["ATS resume template", "ATS friendly resume template", "free resume template Word", "resume template PDF"],
  description:
    "Free resume templates in Word and PDF: ATS-safe classic and modern designs that parse cleanly, plus creative layouts for emailing a person. Fill one in with the AI resume builder.",
  alternates: { canonical: "/templates" },
  openGraph: { url: "/templates", title: `Free ATS-Friendly Resume Templates | ${site.name}` },
};

const rules: [string, string][] = [
  ["Single column", "Parsers read left to right across the page. One column keeps your reading order intact."],
  ["No tables or text boxes", "Cell and box contents are commonly dropped or shuffled during extraction."],
  ["Contact details in the body", "Many parsers ignore Word headers and footers, so your email would vanish."],
  ["Standard section headings", "Summary, Experience, Education, Skills, Certifications: the words parsers expect."],
  ["System fonts", "Calibri and Arial exist on every server. Decorative web fonts often do not."],
  ["Consistent dates", "One month-and-year format throughout, so time in each role can be calculated."],
];

export default function TemplatesPage() {
  return (
    <div className="container-page pt-12 sm:pt-20">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "ATS-friendly resume templates",
          url: `${site.url}/templates`,
          description: metadata.description,
        }}
      />
      <div className="max-w-3xl">
        <p className="eyebrow">Templates</p>
        <h1 className="mt-3 font-display text-[2.3rem] leading-[1.12] sm:text-[3.4rem]">
          Resume templates that get past the parser.
        </h1>
        <p className="mt-5 text-[1.05rem] text-ink-muted">
          Every ATS-safe design here is single-column with real text, so it parses cleanly, whether it&apos;s a
          classic layout or a modern one with colour. Creative designs are clearly marked: use those when you&apos;re
          emailing a person, not uploading to a job portal. Pick one and fill it in with the builder.
        </p>
      </div>

      <div className="mt-10">
        <TemplateLibrary />
      </div>

      <section className="mt-20 sm:mt-28" aria-labelledby="rules-h">
        <div className="max-w-2xl">
          <p className="eyebrow">What makes them parse-safe</p>
          <h2 id="rules-h" className="mt-3 font-serif text-[2.1rem] leading-[1.08] sm:text-[2.6rem]">
            Six rules every ATS-safe template follows.
          </h2>
        </div>
        <dl className="glass mt-8 grid overflow-hidden sm:grid-cols-2">
          {rules.map(([t, d], i) => (
            <div
              key={t}
              className={`border-[var(--glass-line)] p-6 ${i > 0 ? "border-t" : ""} ${i === 1 ? "sm:border-t-0" : ""} ${
                i % 2 === 1 ? "sm:border-l" : ""
              }`}
            >
              <dt className="font-semibold">{t}</dt>
              <dd className="mt-1 text-sm text-ink-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="glass-strong mt-16 flex flex-col gap-5 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div>
          <h2 className="font-display text-[1.8rem] leading-tight">Rather not retype everything?</h2>
          <p className="mt-2 max-w-xl text-ink-muted">
            Check your current resume. The results page rebuilds it in any of these templates from what was
            extracted, including any AI rewrites you accept.
          </p>
        </div>
        <Link href="/#check" className="btn btn-primary self-start sm:self-auto">
          Check my resume
        </Link>
      </section>
    </div>
  );
}
