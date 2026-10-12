import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { LinkedInUploader } from "@/components/linkedin/linkedin-uploader";
import { aiEnabled } from "@/lib/ai-enabled";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Free LinkedIn Profile Analyzer: score and improve your profile",
  description:
    "Upload your LinkedIn profile PDF and get a score out of 100 with specific fixes for your headline, About section, experience, skills and contact details, plus an optional AI review. Nothing is stored.",
  alternates: { canonical: "/linkedin" },
  openGraph: { url: "/linkedin", title: `Free LinkedIn Profile Analyzer | ${site.name}` },
};

const exportSteps = [
  ["Open your profile", "On linkedin.com, click your photo at the top and choose View Profile."],
  ["Find Save to PDF", "Under your name and headline, click Resources (or More on some layouts)."],
  ["Download it", "Choose Save to PDF. LinkedIn downloads a file named Profile.pdf."],
  ["Upload it here", "Drop that file into the box. It's read in memory and never stored."],
];

const scored: [string, number, string][] = [
  ["Experience", 30, "A current role, descriptions under each role, numbers and outcomes, at least three roles where you have them."],
  ["About", 20, "Whether it exists, its length (1,000+ characters is ideal), a strong opening and evidence of results."],
  ["Headline", 15, "70 to 220 characters, a searchable job title early on, and more than just a title at a company."],
  ["Skills", 12, "Top skills visible on the profile and consistent with the roles you describe."],
  ["Contact", 10, "A custom profile URL rather than one ending in random characters, plus an email or website."],
  ["Education", 8, "Schools, degrees and dates present and readable."],
  ["Credentials", 5, "Certifications, languages, honours and publications that add searchable terms."],
];

const faq = [
  {
    q: "How do I download my LinkedIn profile as a PDF?",
    a: "Open your profile on a computer, click Resources (or More) under your name, then Save to PDF. LinkedIn downloads a PDF of your public profile sections, usually named Profile.pdf.",
  },
  {
    q: "How is my LinkedIn profile scored?",
    a: "By fixed rules applied to what's in the PDF: headline, About, experience, skills, education, credentials and contact details, each with a stated share of the score. The same PDF always gets the same score. An optional AI review adds written feedback but never changes the number.",
  },
  {
    q: "Why isn't my photo or banner scored?",
    a: "LinkedIn's PDF export doesn't include your photo, banner, recommendations, endorsements or activity, so we can't see them. We only score what we can actually read, and we say so.",
  },
  {
    q: "Is my profile stored?",
    a: "No. The PDF is analysed in memory and discarded when your results are returned. Results stay in your browser tab and are cleared when you close it.",
  },
];

export default function LinkedInPage() {
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: `${site.name} LinkedIn Profile Analyzer`,
            url: `${site.url}/linkedin`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            description: metadata.description,
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
          {
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "How to download your LinkedIn profile as a PDF",
            step: exportSteps.map(([name, text], i) => ({ "@type": "HowToStep", position: i + 1, name, text })),
          },
        ]}
      />

      <section className="container-page pt-12 sm:pt-20">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-14">
          <div>
            <p className="chip text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden="true" />
              Free. No LinkedIn login needed.
            </p>
            <h1 className="mt-6 font-display text-[2.4rem] leading-[1.12] sm:text-[3.3rem]">
              Score your LinkedIn profile, then fix it.
            </h1>
            <p className="mt-5 max-w-xl text-[1.06rem] leading-relaxed text-ink-muted">
              Recruiters search LinkedIn by job title, skills and location. Upload the PDF of your profile to get a
              score out of 100 and a list of exactly what to fix
              {aiEnabled() ? ", plus an optional AI review with new headline and About drafts written from your own experience." : "."}
            </p>
          </div>
          <div id="check" className="scroll-mt-24">
            <LinkedInUploader />
          </div>
        </div>
      </section>

      <section className="container-page pt-20 sm:pt-28" aria-labelledby="export-h">
        <p className="eyebrow">Before you start</p>
        <h2 id="export-h" className="mt-3 max-w-2xl font-serif text-[2.1rem] leading-[1.08] sm:text-[2.5rem]">
          Get your profile PDF in four clicks.
        </h2>
        <ol className="glass mt-8 grid overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
          {exportSteps.map(([t, d], i) => (
            <li
              key={t}
              className={`border-[var(--glass-line)] p-6 ${i > 0 ? "border-t sm:border-t-0" : ""} ${i % 2 ? "sm:border-l" : ""} ${
                i >= 2 ? "sm:border-t lg:border-t-0" : ""
              } ${i === 2 ? "lg:border-l" : ""}`}
            >
              <span className="font-display text-[2rem] leading-none text-accent">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-ink-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-page pt-20 sm:pt-28" aria-labelledby="scored-h">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <p className="eyebrow">What we score</p>
            <h2 id="scored-h" className="mt-3 font-serif text-[2.1rem] leading-[1.08] sm:text-[2.5rem]">
              Seven sections, each with clear rules.
            </h2>
            <p className="mt-4 text-ink-muted">
              Every point is explained on your results page with the text it refers to and what to change. Want a
              resume to match?{" "}
              <Link href="/builder" className="link">
                Build one here
              </Link>
              .
            </p>
          </div>
          <dl className="glass divide-y divide-[var(--glass-line)] px-6 sm:px-8">
            {scored.map(([t, w, d]) => (
              <div key={t} className="py-4">
                <dt className="flex items-baseline justify-between gap-4 font-medium">
                  {t}
                  <span className="font-mono text-xs font-normal text-ink-muted">{w}% of score</span>
                </dt>
                <dd className="mt-0.5 text-sm text-ink-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="container-page pt-20 sm:pt-28" aria-labelledby="li-faq-h">
        <h2 id="li-faq-h" className="font-serif text-[2.1rem] leading-[1.08] sm:text-[2.5rem]">
          Questions
        </h2>
        <div className="glass mt-8 divide-y divide-[var(--glass-line)] px-5 sm:px-7">
          {faq.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                <h3 className="text-[1rem]">{f.q}</h3>
                <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-ink-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
