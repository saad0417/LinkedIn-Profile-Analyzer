import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, orgRef } from "@/components/json-ld";
import { Uploader } from "@/components/uploader";
import { faq } from "@/lib/faq";
import { aiEnabled } from "@/lib/ai-enabled";
import { guides, site } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/",
  title: `ATS Resume Checker: See What the Parser Sees | ${site.name}`,
  absoluteTitle: true,
  socialTitle: "Free ATS resume checker: see what the parser sees",
  description: site.description,
  keywords: ["ATS resume checker", "free ATS resume checker", "ATS resume scanner", "resume parser test", "resume keyword match"],
});

const steps: { n: string; title: string; body: string; bodyNoAi?: string }[] = [
  {
    n: "01",
    title: "Upload your resume",
    body: "PDF or Word. It is read in memory on our server and discarded the moment your results come back.",
  },
  {
    n: "02",
    title: "See what the parser extracted",
    body: "Your document beside the record an ATS would store: name, email, phone, each role and its dates, education, skills. Empty fields are marked.",
  },
  {
    n: "03",
    title: "Fix what is broken, in order",
    body: "Every issue quotes your own text and gives a specific fix. Weak bullets get an optional AI rewrite that never invents numbers.",
    bodyNoAi: "Every issue quotes your own text and gives a specific fix, ordered by how much it costs you.",
  },
  {
    n: "04",
    title: "Match it to a job, then download",
    body: "Paste a job description for a keyword and title gap. Download a clean, single-column version as Word or PDF.",
  },
];

const toolsAi: { href: string; eyebrow: string; title: string; body: string; bodyNoAi?: string; cta: string }[] = [
  {
    href: "/#check",
    eyebrow: "Resume checker",
    title: "Score your resume",
    body: "See what an ATS extracts, get a score out of 100 with every point explained, and compare against a job description.",
    cta: "Check my resume",
  },
  {
    href: "/builder",
    eyebrow: "Resume builder",
    title: "Build an ATS-friendly resume",
    body: "Tell us the role you want and your experience in your own words. AI writes clear bullets from your facts; you pick a template.",
    bodyNoAi: "Enter the role you want, your experience and skills, pick a template, and download a clean ATS-ready Word or PDF file.",
    cta: "Open the builder",
  },
  {
    href: "/linkedin",
    eyebrow: "LinkedIn analyzer",
    title: "Score your LinkedIn profile",
    body: "Upload your profile PDF for a score, a fix list for your headline, About and experience, and AI-drafted rewrites.",
    bodyNoAi: "Upload your profile PDF for a score out of 100 and a specific fix list for your headline, About and experience.",
    cta: "Analyze my profile",
  },
];

const checks: { group: string; score: string; items: [string, string][] }[] = [
  {
    group: "Parse Integrity",
    score: "Can a parser read it?",
    items: [
      ["Extractable text", "Scanned or image-only resumes have nothing to read at all."],
      ["Contact details found", "Name, email and phone located in the body, not lost in a header or footer."],
      ["Columns and tables", "Multi-column layouts and layout tables scramble reading order."],
      ["Text boxes and graphics", "Skill bars, icons and text boxes are often skipped entirely."],
      ["Standard section headings", "'Experience' is recognised. 'My Journey' is not."],
      ["Dates and fonts", "Consistent month and year formats, fonts installed on servers."],
    ],
  },
  {
    group: "Content",
    score: "Will a recruiter rate it?",
    items: [
      ["Quantified bullets", "Bullets with a number in them, flagged when there are none."],
      ["Weak openers", "'Responsible for', 'Helped with', 'Worked on' and similar."],
      ["Padding", "Very short bullets and the same verb used again and again."],
      ["Employment gaps", "Gaps longer than six months with nothing to explain them."],
      ["LinkedIn and pronouns", "A profile link present, first-person pronouns absent."],
    ],
  },
  {
    group: "Job Match",
    score: "Does it fit this posting?",
    items: [
      ["Job title", "Whether the posting's title, or a close variant, appears on your resume."],
      ["Hard skills", "Tools, technologies and certifications the posting names, and which you lack."],
      ["Repeated keywords", "Phrases the posting leans on, counted in both documents."],
    ],
  },
];

export default function Home() {
  const ai = aiEnabled();
  const tools = ai ? toolsAi : toolsAi.map((t) => ({ ...t, body: t.bodyNoAi ?? t.body }));
  const faqShown = ai
    ? faq
    : faq.filter((f) => !f.q.includes("AI")).map((f) => ({ ...f, a: f.a.replace(/\s*The optional AI rewrites[^.]*\./, "") }));
  const stepsShown = ai ? steps : steps.map((s) => ({ ...s, body: s.bodyNoAi ?? s.body }));
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: `${site.name} ATS Resume Checker`,
            url: `${site.url}/`,
            publisher: orgRef(),
            description: site.description,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            browserRequirements: "Requires a modern web browser",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: [
              "Resume parse preview",
              "ATS formatting checks",
              "Job description keyword match",
              "ATS-friendly resume templates",
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqShown.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]}
      />

      {/* ---------- Hero ---------- */}
      <section className="container-page pt-12 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
          <div>
            <h1 className="font-display text-[2.4rem] leading-[1.12] tracking-tight sm:text-[3.4rem] lg:text-[3.9rem]">
              See your resume the way the <span className="text-accent">ATS</span> sees it.
            </h1>
            <p className="mt-6 max-w-xl text-[1.08rem] leading-relaxed text-ink-muted">
              Most applicant tracking systems don&apos;t reject resumes. They store them, and recruiters search
              that store. If your phone number lived in a header or your dates sat in a table, those fields are
              empty and you never come up. Upload your resume to see exactly what was saved, get an ATS score out of
              100, and fix it in minutes.
            </p>
          </div>
          <ParserSpecimen />
        </div>

        <div id="check" className="mt-10 scroll-mt-24 sm:mt-14">
          <Uploader />
          <p className="mt-3 px-1 text-xs text-ink-muted">
            By checking a file you agree it is processed in memory only. See our{" "}
            <Link href="/privacy" className="link">
              privacy note
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="container-page pt-24 sm:pt-32" aria-labelledby="how-h">
        <SectionHead
          id="how-h"
          eyebrow="How it works"
          title="Four steps, about a minute."
          lede="Nothing to install and no account. You see the evidence before you see a number."
        />
        <ol className="glass mt-10 grid overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
          {stepsShown.map((s, i) => (
            <li
              key={s.n}
              className={`p-6 sm:p-7 ${i > 0 ? "border-t border-[var(--glass-line)] sm:border-t-0" : ""} ${
                i % 2 === 1 ? "sm:border-l sm:border-[var(--glass-line)]" : ""
              } ${i >= 2 ? "sm:border-t sm:border-[var(--glass-line)] lg:border-t-0" : ""} ${
                i === 2 ? "lg:border-l lg:border-[var(--glass-line)]" : ""
              }`}
            >
              <span className="font-display text-[2.2rem] leading-none text-accent">{s.n}</span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Tools ---------- */}
      <section className="container-page pt-24 sm:pt-32" aria-labelledby="tools-h">
        <SectionHead
          id="tools-h"
          eyebrow="Three free tools"
          title="Check it, fix it, then do the same for LinkedIn."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {tools.map((t) => (
            <Link key={t.href} href={t.href} className="glass group flex flex-col p-6 transition-transform hover:-translate-y-0.5 sm:p-7">
              <p className="eyebrow">{t.eyebrow}</p>
              <h3 className="mt-2 font-serif text-[1.75rem] leading-tight group-hover:text-accent">{t.title}</h3>
              <p className="mt-2 flex-1 text-[0.95rem] text-ink-muted">{t.body}</p>
              <span className="mt-5 text-sm font-medium">{t.cta} →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- The silent failure ---------- */}
      <section className="container-page pt-24 sm:pt-32" aria-labelledby="silent-h">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
          <div>
            <SectionHead
              id="silent-h"
              eyebrow="The failure nobody tells you about"
              title="A two-column resume, read the way a parser reads it."
            />
            <div className="mt-5 space-y-4 text-ink-muted">
              <p>
                Parsers read across the page, line by line. A sidebar beside your experience gets stitched into
                it: skills land in job titles, dates land in skills, and the role you held in 2019 merges into
                the one from 2021.
              </p>
              <p>
                No error is shown. The recruiter searching for &ldquo;Product Analyst&rdquo; simply never sees
                you. This is why we show you the extracted record first, and the score second.
              </p>
            </div>
          </div>
          <ColumnDemo />
        </div>
      </section>

      {/* ---------- What we check ---------- */}
      <section className="container-page pt-24 sm:pt-32" aria-labelledby="checks-h">
        <SectionHead
          id="checks-h"
          eyebrow="What we check"
          title="Every score breaks down into checks you can open."
          lede="No black-box number. Each check is pass, warning or fail, quotes the text it is about, and is worth a stated number of points."
        />
        <div className="mt-10 grid items-start gap-5 lg:grid-cols-3">
          {checks.map((g) => (
            <div key={g.group} className="glass p-6 sm:p-7">
              <p className="eyebrow">{g.score}</p>
              <h3 className="mt-2 font-serif text-[1.75rem] leading-tight">{g.group}</h3>
              <ul className="mt-5 divide-y divide-[var(--glass-line)]">
                {g.items.map(([t, d]) => (
                  <li key={t} className="py-3">
                    <p className="text-[0.95rem] font-medium">{t}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">{d}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-muted">
          The full method, with weights and sources, is on{" "}
          <Link href="/how-it-works" className="link">
            how scoring works
          </Link>
          .
        </p>
      </section>

      {/* ---------- Honesty ---------- */}
      <section className="container-page pt-24 sm:pt-32" aria-labelledby="honest-h">
        <div className="glass-strong grid gap-8 p-7 sm:p-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <p className="eyebrow">Why there is no single magic number</p>
            <h2 id="honest-h" className="mt-3 font-display text-[2rem] leading-[1.08] sm:text-[2.6rem]">
              An ATS score without a job is guesswork.
            </h2>
          </div>
          <div className="space-y-4 text-ink-muted">
            <p>
              Many tools give you one &ldquo;ATS compatibility&rdquo; score out of 100. There is no standard behind
              it. Greenhouse, one of the most widely used systems, doesn&apos;t score or rank resumes at all.
            </p>
            <p>
              So we measure the two things that can actually be checked. <strong className="text-ink">Parse
              Integrity</strong>: does your content survive extraction? And, only when you give us a posting,{" "}
              <strong className="text-ink">Job Match</strong>: does your resume use its title and skills?
            </p>
            <p>
              Scores are calculated by fixed rules, never by AI, so the same file always gets the same result.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Templates ---------- */}
      <section className="container-page pt-24 sm:pt-32" aria-labelledby="tpl-h">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHead
            id="tpl-h"
            eyebrow="Template library"
            title="Good-looking, and still readable by a parser."
            lede="Classic and modern ATS-safe templates in Word and PDF, plus clearly marked creative designs for when you're emailing a person. Fill any of them in with the builder."
          />
          <Link href="/templates" className="btn btn-secondary shrink-0 self-start sm:self-auto">
            See the templates
          </Link>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="container-page pt-24 sm:pt-32" aria-labelledby="faq-h">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <SectionHead id="faq-h" eyebrow="Questions" title="Frequently asked" />
            <p className="mt-4 text-sm text-ink-muted">Longer answers live in the guides:</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {guides.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}`} className="link">
                    {g.short}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="glass divide-y divide-[var(--glass-line)] px-5 sm:px-7">
            {faqShown.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  <h3 className="text-[1rem]">{f.q}</h3>
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-ink-muted transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="container-page pt-24 sm:pt-32">
        <div className="glass-strong flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="font-display text-[1.9rem] leading-tight sm:text-[2.3rem]">Find out what got lost.</h2>
            <p className="mt-2 text-ink-muted">One upload. No account. Nothing kept.</p>
          </div>
          <Link href="#check" className="btn btn-primary self-start sm:self-auto">
            Check my resume
          </Link>
        </div>
      </section>
    </>
  );
}

function SectionHead({ id, eyebrow, title, lede }: { id: string; eyebrow: string; title: string; lede?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-serif text-[2.1rem] leading-[1.08] sm:text-[2.55rem]">
        {title}
      </h2>
      {lede && <p className="mt-3 text-ink-muted">{lede}</p>}
    </div>
  );
}

/** A static rendering of the results "parser output" panel: shows the product without a screenshot. */
function ParserSpecimen() {
  const rows: [string, string, boolean][] = [
    ["name", "Amara Okafor", true],
    ["email", "amara.okafor@mail.com", true],
    ["phone", "NOT FOUND", false],
    ["title", "Senior Product Analyst  SQL, Python", false],
    ["dates", "2019 to 2021  Tableau", false],
  ];
  return (
    <figure className="glass-strong relative hidden p-5 sm:block" aria-label="Example of parser output">
      <div className="flex items-center justify-between border-b border-[var(--glass-line)] pb-3">
        <span className="font-mono text-[0.8rem] uppercase tracking-[0.08em] text-ink-muted">Parser output</span>
        <span className="chip !border-bad/20 !bg-bad-soft/80 !text-[0.8rem] text-bad">3 fields damaged</span>
      </div>
      <dl className="mt-3 space-y-1.5 font-mono text-[0.86rem]">
        {rows.map(([k, v, ok]) => (
          <div key={k} className="grid grid-cols-[4.5rem_1fr] gap-3">
            <dt className="text-ink-muted">{k}</dt>
            <dd className={`font-semibold ${ok ? "text-ink" : "text-bad"}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <figcaption className="mt-4 border-t border-[var(--glass-line)] pt-3 text-xs leading-relaxed text-ink-muted">
        Phone in the page header, never read. A sidebar of skills stitched into the job title and dates.
      </figcaption>
    </figure>
  );
}

function ColumnDemo() {
  const left = ["SKILLS", "SQL, Python", "Tableau", "Looker"];
  const right = ["EXPERIENCE", "Senior Product Analyst", "Brightline, 2021 to now", "Product Analyst"];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <figure className="glass p-5">
        <figcaption className="eyebrow mb-3">Your document</figcaption>
        <div className="grid grid-cols-[0.8fr_1.4fr] gap-3 rounded-[var(--radius)] bg-white p-4 text-[0.82rem] leading-[1.9] shadow-[0_1px_2px_rgba(60,40,20,0.08)]">
          <div className="border-r border-rule pr-3 text-ink-muted">
            {left.map((l, i) => (
              <p key={l} className={i === 0 ? "font-semibold text-ink" : ""}>
                {l}
              </p>
            ))}
          </div>
          <div>
            {right.map((r, i) => (
              <p key={r} className={i === 0 ? "font-semibold" : i === 1 || i === 3 ? "font-medium" : "text-ink-muted"}>
                {r}
              </p>
            ))}
          </div>
        </div>
      </figure>
      <figure className="glass p-5">
        <figcaption className="eyebrow mb-3">What the ATS stored</figcaption>
        <div className="glass-well p-4 font-mono text-[0.8rem] leading-[1.9]">
          {left.map((l, i) => (
            <p key={l}>
              <span className="text-bad">{l}</span> {right[i]}
            </p>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-muted">Each line joined straight across the gutter.</p>
      </figure>
    </div>
  );
}
