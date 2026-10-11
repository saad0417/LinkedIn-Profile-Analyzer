# ATS resume criteria — research notes

_Compiled 2026-10-12. Every claim links to its source. "(unverified)" or "(vendor claim)" marks anything we could not confirm against a primary source. Most "ATS advice" online comes from companies that sell resume products, so treat it as industry convention rather than measured fact._

---

## 1. How ATS actually handle resumes

### 1.1 Key finding: parsing and search matter more than auto-rejection
- Most ATS **parse** the resume into a structured, searchable profile and keep the original file attached. Recruiters then **search and filter** that parsed data. If parsing fails, the candidate is still in the system but recruiters' searches don't find them ([Jobscan on Greenhouse](https://www.jobscan.co/blog/greenhouse-ats-what-job-seekers-need-to-know/)).
- **Auto-rejection is mostly driven by knockout questions, not by resume content.** Two examples:
  - Greenhouse "Auto-Reject" rules fire on answers to custom application questions, e.g. "Are you willing to relocate?" → "No" ([Greenhouse Support](https://support.greenhouse.io/hc/en-us/articles/360029081512-Auto-Reject-for-prospect-post), [Application Rules Overview](https://support.greenhouse.io/hc/en-us/articles/203105595-Application-Rules-Overview)).
  - Oracle Taleo "disqualification questions" can "instantly exit" a candidate ([Oracle Taleo docs](https://docs.oracle.com/en/cloud/saas/taleo-enterprise/20b/otrec/candidate-prescreening.html)).
- **Survey evidence:**
  - **Enhancv, 25 US recruiters:** 23 of 25 (92%) said their ATS does not auto-reject resumes for formatting or content-match scores. The other 2 used strict thresholds in Bullhorn and BambooHR. 44% said their software has AI scoring, but more than half of those disable or ignore it ([Enhancv](https://enhancv.com/blog/does-ats-reject-resumes/), [press release](https://www.wboc.com/online_features/press_releases/the-75-ats-rejection-myth-shattered-92-of-recruiters-confirm-applicant-tracking-systems-do-not/article_f141f112-dc9e-5082-9be5-1ea7b6444456.html)). The sample is small and the vendor has a commercial interest.
  - **Jobscan "State of the Job Search":** 99.7% of 384 recruiters use filters in their ATS. Skills-keyword filtering is the most common filter, at 76.4% ([as cited by VisualCV](https://www.visualcv.com/blog/resume-statistics-2026-hiring-trends/), [Jobscan ATS explainer](https://www.jobscan.co/blog/what-is-an-applicant-tracking-system)). We reached this only through secondary sources.
  - **HBS/Accenture "Hidden Workers" (2021):** 88% of employers said qualified high-skill candidates were screened out because they didn't exactly match the criteria, and 94% said the same for middle-skill candidates. The authors recommend replacing "negative" ATS filters with "affirmative" ones ([HR Dive](https://www.hrdive.com/news/report-applicant-tracking-systems-may-exclude-whole-segments-of-candidates/606614/), [report PDF](https://nahr.shrm.org/sites/default/files/hiddenworkers09032021.pdf)). **These figures come from employers' own survey answers, not from a measured rejection rate.** Don't quote them as "88% of resumes are rejected."
  - **The "75% of resumes are auto-rejected" figure** traces back to a 2012 vendor sales pitch ([Enhancv ATS hub](https://enhancv.com/ats-hub/)). **We should not repeat it in our UI copy.**

### 1.2 Per-system notes

| System | Ranks or scores? | Notes |
|---|---|---|
| **Greenhouse** | No automatic resume scoring historically. CEO Daniel Chait: "Any kind of automated scoring system of a document like that is subject to the biases of the people who are building the algorithm." A newer AI feature, "Talent Matching / Real Talent", scores match but "never advances or rejects candidates, a recruiter does" ([Jobscan](https://www.jobscan.co/blog/greenhouse-ats-what-job-seekers-need-to-know/)). | Auto-reject is available only on knockout questions, and only on Plus/Pro tiers (the tier info conflicts across Greenhouse articles) ([Greenhouse](https://support.greenhouse.io/hc/en-us/articles/203105595-Application-Rules-Overview)). Text in tables "can come out scrambled or disappear" ([Jobscan](https://www.jobscan.co/blog/greenhouse-ats-what-job-seekers-need-to-know/)). |
| **Workday** (+ **HiredScore**) | Yes, through HiredScore "Spotlight", which grades candidates **A–D**. Meeting all basic qualifications gives A/B. Since Aug 2026 an LLM evaluates each qualification against the *parsed* resume and shows a "Fit & Gap" view ([Workday release note](https://doc.workday.com/hiredscore/en-us/workday-hiredscore/hiredscore-release-notes/2026/august/wednesday--5th-august.html), [product page](https://workday.com/en-us/products/talent-management/ai-recruiting.html)). | Grading uses the parsed profile, so parse quality feeds straight into the AI grade. Some third-party sources say Workday reads table cells out of order (unverified, [ResumeGeni](https://resumegeni.com/blog/ats-system-guide)). |
| **iCIMS** | Yes. "Role Fit" (Coalesce AI) ranks each candidate per job and groups them into tiers. iCIMS classed it as an AEDT under NYC LL144 and had it bias-audited in 2022 and 2023 ([Jobscan on iCIMS](https://www.jobscan.co/blog/icims-ats/), [Enhancv](https://enhancv.com/blog/how-does-icims-work/)). | Framed as decision support. |
| **Oracle Taleo / Oracle Recruiting** | Yes, through questionnaires. "ACE" prescreening combines disqualification questions, competencies and weighted Required/Asset answers. Candidates above the threshold get an "ACE" flag ([Oracle](https://docs.oracle.com/en/cloud/saas/taleo-enterprise/20b/otrec/candidate-prescreening.html), [Temple Univ. quick ref](https://careers.temple.edu/sites/careers/files/documents/Taleo_Scoring_Questionnaires_QuickRef.pdf)). | Ranking comes from questionnaire answers, not resume text. Career centres say Taleo and Lever may not recognise acronyms unless spelled out ([SCU](https://www.scu.edu/careercenter/toolkit/job-scan-common-ats-resume-formatting-mistakes/)). |
| **Ashby** | AI-Assisted Application Review checks applicants against criteria the employer defines (meets / does not meet / undecided), with citations. Ashby says its AI "never ranks or gives numerical ratings" and that a human decides ([Ashby blog](https://www.ashbyhq.com/blog/product/ai-assisted-application-review), [Ashby AI](https://ashbyhq.com/ai)). | Recruiters can filter by criteria to remove "no-fit" candidates ([Ashby AI](https://ashbyhq.com/ai)). |
| **Lever, SAP SuccessFactors, SmartRecruiters** | We found no primary source on resume scoring. | Treat as standard parse-and-search systems. **Uncertain.** |

### 1.3 Parser vendors
- **Textkernel acquired Sovren** (announced 30 Nov 2021) and now markets a combined parsing engine ([Textkernel](https://www.textkernel.com/learn-support/blog/textkernel-acquires-sovren-to-become-the-global-leader-in-ai-powered-recruitment-technology/)).
- **RChilli, Daxtra, Affinda, HireAbility** are the other common embedded/OEM parsers. **Which ATS uses which parser is not publicly documented.** We found no primary source mapping vendors to Workday, Lever or iCIMS, so we should not claim one in UI copy.
- **Implication for us:** we can't emulate a specific vendor. The defensible proxy is: (a) can plain text be extracted in reading order, and (b) can standard fields (contact, titles, dates, headings) be found reliably?

---

## 2. Formatting failure modes (citable)

| Failure mode | What happens | Source |
|---|---|---|
| Multi-column layout | Left- and right-column lines get read interleaved. Columns built from native Word columns are said to fare better than columns built from tables or text boxes. | [Jobscan](https://www.jobscan.co/blog/resume-mistakes), [RecruitBPM](https://recruitbpm.com/?p=20244) |
| Tables | Cell text "can come out scrambled or disappear" (Greenhouse). Date-alignment tables break work history. | [Jobscan/Greenhouse](https://www.jobscan.co/blog/greenhouse-ats-what-job-seekers-need-to-know/), [Jobscan](https://www.jobscan.co/blog/resume-mistakes) |
| Headers/footers and text boxes | "Many ATS parsers ignore these layers." Contact info placed there gets lost. Jobscan's test: Ctrl+A; text that doesn't highlight with the body is at risk. | [Jobscan](https://www.jobscan.co/blog/resume-mistakes) |
| Icons and images, skill bars | Unrecognised glyphs become random characters ("[NULL]", "Pro?le"). Bar charts are unreadable, so write "Java (Expert)" instead. | [Jobscan](https://www.jobscan.co/blog/resume-mistakes) |
| Fonts | Use widely available fonts (Arial, Calibri, Cambria, Garamond, Georgia, Helvetica, Tahoma, Verdana…). Ligatures and unusual encodings garble text. | [Jobscan](https://www.jobscan.co/blog/resume-mistakes) |
| Creative headings | "Where I've Been" or "My Superpowers" can put experience under Education or drop the summary. Use "Work Experience", "Education", "Skills". | [Jobscan](https://www.jobscan.co/blog/resume-mistakes) |
| Dates | Problem formats: "Jan '21", year-only "2021 – 2023" (some ATS default to Jan 1), "1/2021" (single-digit month). Good formats: "Jan 2021 – Mar 2023", "January 2021", "01/2021". | [Jobscan](https://www.jobscan.co/blog/resume-mistakes) |
| Acronyms | Some ATS (Taleo, Lever cited) won't match an acronym to its spelled-out form. Write both: "Search Engine Optimization (SEO)". | [SCU career center](https://www.scu.edu/careercenter/toolkit/job-scan-common-ats-resume-formatting-mistakes/) |
| File type | Jobscan's current advice is PDF "unless the job description specifically asks for a .doc". Its older tests found .docx special-character problems. Other sources say Taleo historically handled DOCX better. **Sources conflict.** Use whatever the posting asks for. Image-only PDFs always fail. | [Jobscan resume-mistakes](https://www.jobscan.co/blog/resume-mistakes), [Jobscan PDF vs Word](https://www.jobscan.co/blog/resume-pdf-vs-word/), [Shashiworks](https://www.shashiworks.com/ats-workday-greenhouse-taleo.html) (unverified) |
| Special characters and bullets | Fancy bullets and symbols (icons, arrows, emoji) can become "?" or other junk. **This is convention (unverified).** Jobscan covers it only through icons and garbled bullets. | [Jobscan](https://www.jobscan.co/blog/resume-mistakes), [airesume.guru](https://airesume.guru/blog/special-characters-that-break-ats-what-to-avoid-on-your-resume) (unverified) |
| Hyperlinks | No primary evidence that links break parsing. The convention is to show the URL as visible text, because link-only anchor text loses the URL in plain-text extraction. **Unverified.** | n/a |
| File name | Rezi audits for full name plus "resume" in the file name ([Rezi](https://intercom.help/rezihelp/en/articles/8383527-using-the-rezi-score)). This is a recruiter-hygiene check, not a parsing one. | Rezi |
| Human scan | Ladders' 2018 eye-tracking study found a 7.4 s initial scan. Simple layouts with clear headings did best; multiple columns, clutter and long sentences did worst. | [HR Dive](https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/) |

---

## 3. Competitor checkers

| Tool | What it checks | Scoring / weights (where public) |
|---|---|---|
| **Jobscan** (JD match) | Hard skills, education (only when the JD asks for an advanced degree), job title, soft skills, other keywords. Also formatting: fonts, page setup, headings, dates, layout. Word count and measurable results do **not** count toward match rate. | Target **≥ 75% match** rate; 100% isn't needed. Hard skills weigh "much more" than soft skills. Keywords that appear more often in the JD weigh more. Separate LinkedIn match target ≥ 80% ([Jobscan tutorial](https://Jobscan.co/jobscan-tutorial), [WGU faculty page](https://careers.wgu.edu/resources/jobscan-information-for-faculty/), [Jobscan](https://www.jobscan.co/blog/resume-mistakes)) |
| **Resume Worded** (Score My Resume) | 20+ checks in **Impact** (quantified results, action verbs, growth/leadership signals), **Brevity** and **Style** (formatting, word choice, ATS parse). Flags "responsible for", weak verbs, vague bullets, buzzwords, and section completeness. | Each criterion is scored /10 and weighted by importance, so the total isn't a simple average. Bands: 90+ exceptional, 85–89 strong, 80–84 solid, <80 needs work. Relevancy Score >80 means well matched to a job ([score guide](https://resumeworded.com/score-guide), [llm-info](https://resumeworded.com/llm-info)). The "soft skills" category we were asked about isn't confirmed in current docs. |
| **Rezi** (Rezi Score, 23 audits) | **Content:** bullet length, punctuation, quantified bullets, total bullets, weak bullets, buzzwords, personal pronouns, passive voice, filler words ("just", "very", "really"). **Format:** template, page length (1 page; 2 only for Director+), font size, 3–6 bullets per role. **Optimization:** AI keyword targeting (JD), experience level, industry. **Best practices:** location on every entry, email, written-month dates ("January 2023"), file name, **400–600 words**, LinkedIn URL, grouped skills. | 1–100. ≥90 excellent, <50 "not ready" ([Rezi help](https://intercom.help/rezihelp/en/articles/8383527-using-the-rezi-score)). Some thresholds are opinionated: one page, and a font size of 8.5–9.5 pt that looks like a typo in Rezi's docs. |
| **Enhancv** | **Content:** ATS parse rate, repetition, spelling/grammar, quantified impact. **Format:** file type and size, length, long bullets. **Skills.** **Sections.** **Style:** design, active voice, buzzwords and clichés. | Score built on "percentage of parsed content" plus issues found. Enhancv says a genuine "ATS score" doesn't exist ([Enhancv CV checker](https://enhancv.com/uk/cv-checker), [resume fixer](https://enhancv.com/resources/resume-fixer)) |
| **Kickresume** | 20+ checks covering formatting, design, typefaces, structure and content. | >80 = "pretty good" ([Kickresume](https://kickresume.com/en/ats-resume-checker)) (vendor claim) |
| **Zety** | Layout, content and style errors. 80%+ needs consistent formatting, JD keywords, standard section names and bullets. | No JD matching, per one reviewer ([Zety](https://zety.com/resume-check), [StylingCV review](https://stylingcv.com/blog/best-resume-checkers-2026-we-tested-10-tools-with-the-same-resume-only-3-were-accurate/)) |
| **Teal** | JD keyword match: highlights missing keywords and suggests where to add them. | No public formula (third-party reviews only) ([Dupple](https://dupple.com/learn/best-ai-resume-builders)) |
| **Novorésumé** | JD match score broken into hard requirements, skills alignment, seniority fit, industry match and career trajectory. | No public weights ([Novorésumé skill-gap tool](https://novoresume.com/tools/skill-gap-analyzer)) |
| **TopResume** (free review) | Human-written review of style and format, writing and mechanics, plus an "ATS analysis" of the keywords picked up. Turnaround up to 48 h. Lead-in to paid rewrites. | Not numeric ([TopResume](https://topresume.com/resume-review), [FAQ](https://topresume.com/faq)) |

**Patterns across competitors:**
1. Almost all of them check quantified impact, action verbs, buzzwords, pronouns, standard sections, date format, length and contact completeness.
2. JD match is weighted toward hard skills.
3. A score of 80+ is the common "good" band.

---

## 4. Content conventions and the evidence behind them

| Convention | Evidence and strength |
|---|---|
| **Quantified bullets** | Checked by every major tool (Rezi, Resume Worded, Enhancv). Jobscan explicitly excludes measurable results from match rate, so this is a recruiter-quality signal, not an ATS one. Evidence strength: convention. |
| **Start bullets with action verbs** | Harvard OCS: verbs "get lost mid-sentence" but stand out as the first word of a bullet. Its guide includes a categorised verb list ([Harvard blog](https://careerservices.fas.harvard.edu/blog/2025/08/14/45-rare-action-verbs-for-your-resume-with-examples/), [Harvard guide PDF](https://cdn-careerservices.fas.harvard.edu:443/wp-content/uploads/sites/161/2022/03/hes-resume-cover-letter-guide.pdf)). |
| **Bullet count and length** | Rezi wants 3–6 bullets per role and flags bullets that are too long or too short. Enhancv flags long bullets ([Rezi](https://intercom.help/rezihelp/en/articles/8383527-using-the-rezi-score), [Enhancv](https://enhancv.com/uk/cv-checker)). No public word threshold exists. **We propose >30 words (about 2 lines) as "long". This is our assumption.** |
| **Summary** | Standard heading, recommended by Jobscan ([resume-mistakes](https://www.jobscan.co/blog/resume-mistakes)). Ladders' eye-tracking favoured clear sections ([HR Dive](https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/)). |
| **Keyword placement** | Hard skills that match the JD weigh most (Jobscan). Write both acronym and expansion ([SCU](https://www.scu.edu/careercenter/toolkit/job-scan-common-ats-resume-formatting-mistakes/)). Showing skills in context (inside bullets) is a convention: **unverified** for ATS, but HiredScore's per-qualification LLM evaluation reads the whole parsed resume ([Workday](https://doc.workday.com/hiredscore/en-us/workday-hiredscore/hiredscore-release-notes/2026/august/wednesday--5th-august.html)). |
| **1 vs 2 pages** | ResumeGo (2018, 482 hiring professionals, simulated hiring): recruiters were **2.3×** more likely to pick two-page resumes. The effect grew with seniority: 1.4× entry, 2.6× mid, 2.9× managerial ([ResumeGo](https://www.resumego.net/research/one-or-two-page-resumes/), [CNBC](https://www.cnbc.com/2018/12/19/resumego-hiring-managers-prefer-candidates-with-two-page-resumes.html)). ResumeGo is a vendor study. Rezi still recommends one page. **Conclusion: 1–2 pages is fine; 3+ deserves a warning.** |
| **Word count** | Rezi: 400–600 words ([Rezi](https://intercom.help/rezihelp/en/articles/8383527-using-the-rezi-score)). This is opinionated, so we should use a wider band (see rubric). |
| **LinkedIn URL** | Rezi audits for it ([Rezi](https://intercom.help/rezihelp/en/articles/8383527-using-the-rezi-score)). Our existing `content.linkedin` check covers it. |
| **Pronouns** | Rezi audits for "I", "my" and "mine" ([Rezi](https://intercom.help/rezihelp/en/articles/8383527-using-the-rezi-score)). This is a convention. |
| **Contact info and location** | Contact must be in the body, not a header or footer ([Jobscan](https://www.jobscan.co/blog/resume-mistakes)). Rezi wants a location on entries. A city plus region is the norm, and a full street address is unnecessary. **That last point is convention; we found no primary source.** |
| **Photo, DOB, marital status** | US and UK advice is to omit them; mainland Europe and academia differ ([EMBL careers](https://www.embl.org/about/info/embl-fellows-career-service/blog/2019/08/what-to-include-in-your-cv/)). Claims that "the EEOC advises against photos" are **unverified**. Our fixtures include DE/AE/PK resumes, so make this check **locale-aware**: warn, don't fail. |
| **Employment gaps** | No source supports ATS penalising gaps. Some ATS can, however, misread year-only dates and invent gaps ([Jobscan](https://www.jobscan.co/blog/resume-mistakes)). Keep the weight low and the tone informational. |

---

## 5. Recommended rubric for our ATS score (0–100)

**Principles:**
- Only score what we can detect deterministically.
- Parse and format checks are the "ATS" part. Everything else is recruiter quality.
- When a JD is supplied, Job Match takes 35 points and the other groups scale by ×0.65.
- Each check gives pass = 100%, warn = 50%, fail = 0% of its weight, unless a linear scale is noted.

### 5.1 Weights

| Group | Check id | No-JD weight | With-JD weight | Detection rule (deterministic) | Pass / warn / fail | Justification and source |
|---|---|---:|---:|---|---|---|
| **Parse/Format (35 / 23)** | extraction.text | 10 | 7 | Extracted chars ≥ 400 and ≥ 85% of tokens are dictionary or alphanumeric words, with no runs of U+FFFD or private-use glyphs. Image-only PDF (no text layer) = fail. | pass ≥ 85% clean; warn 60–85%; fail < 60% or image-only | Garbled glyphs are the canonical failure ([Jobscan](https://www.jobscan.co/blog/resume-mistakes)) |
| | extraction.headings | 5 | 3 | Match lines against a heading lexicon: experience/work history, education, skills (+ summary/profile, certifications, projects). | pass: experience + education + skills found; warn: 2 of 3; fail: ≤ 1 | Creative headings misfile sections ([Jobscan](https://www.jobscan.co/blog/resume-mistakes)) |
| | layout.columns | 4 | 3 | Text-block x-positions cluster into ≥ 2 columns spanning > 50% of page height (PDF), or DOCX `w:cols` > 1. | fail when columns hold experience text; warn when a sidebar holds only skills/contact | Interleaved reading ([Jobscan](https://www.jobscan.co/blog/resume-mistakes)) |
| | layout.tables | 3 | 2 | DOCX `w:tbl` containing body text or dates; PDF ruled grid. | warn 1 table; fail if dates or experience are inside a table | Greenhouse scrambles tables ([Jobscan](https://www.jobscan.co/blog/greenhouse-ats-what-job-seekers-need-to-know/)) |
| | layout.header-footer | 3 | 2 | DOCX header/footer parts contain email, phone or name. | fail if contact info is only in the header/footer | Ignored layer ([Jobscan](https://www.jobscan.co/blog/resume-mistakes)) |
| | layout.text-boxes | 2 | 1 | DOCX `w:txbxContent` or `v:textbox` with > 20 chars. | warn / fail if it holds experience | Same as above |
| | layout.graphics | 2 | 1 | Images, vector rating bars or icon glyphs adjacent to skill or contact text. | warn when present; fail for skill bars with no text level | "Java (Expert)", not bars ([Jobscan](https://www.jobscan.co/blog/resume-mistakes)) |
| | layout.fonts | 2 | 1 | Embedded font names checked against a safe list; flag icon fonts and non-Unicode CMaps. | warn on non-standard; fail on icon fonts carrying content | [Jobscan](https://www.jobscan.co/blog/resume-mistakes) |
| | extraction.dates | 2 | 2 | ≥ 1 parseable date range per experience entry. | pass 100% of entries; warn ≥ 50%; fail < 50% | Blank work history symptom ([Jobscan](https://www.jobscan.co/blog/resume-mistakes)) |
| | extraction.date-format | 2 | 1 | All ranges use `Mon YYYY`, `Month YYYY` or `MM/YYYY` consistently. | warn: year-only, apostrophe years or mixed styles; fail: majority year-only | Jan-1 default and invalid formats ([Jobscan](https://www.jobscan.co/blog/resume-mistakes)) |
| **Sections & Contact (20 / 13)** | extraction.name | 3 | 2 | First 3 non-empty body lines contain a 2–4 token capitalised name. | pass / fail | Required field |
| | extraction.email | 4 | 3 | RFC-lite email regex in body text (not only in the header). | pass / fail | Required field ([Rezi](https://intercom.help/rezihelp/en/articles/8383527-using-the-rezi-score)) |
| | extraction.phone | 3 | 2 | E.164-ish regex, 7–15 digits. | pass / warn (missing) | Standard contact field |
| | **contact.location** (NEW) | 2 | 1 | Top 20% of page 1 contains `City, ST`, `City, Country` or "Remote". **Separate warn** if a full street address is found (`\d+\s+\w+.*\b(st|street|ave|rd|road|blvd|lane)\b`). | pass / warn missing / warn full address | Recruiters filter by location ([Rezi](https://intercom.help/rezihelp/en/articles/8383527-using-the-rezi-score)). Street address is a privacy convention (unverified). |
| | content.linkedin | 2 | 1 | `linkedin\.com/in/[\w-]+` appears as visible text. | pass / warn | [Rezi](https://intercom.help/rezihelp/en/articles/8383527-using-the-rezi-score) |
| | **sections.summary** (NEW) | 2 | 1 | Heading in {summary, professional summary, profile, about, objective}, with a body of 25–120 words. | pass; warn if missing or > 120 words | Standard section ([Jobscan](https://www.jobscan.co/blog/resume-mistakes)) |
| | **sections.skills** (NEW) | 2 | 2 | Skills heading present, items split on `,` `•` `|` `;` or newline. | pass 6–40 items; warn 1–5 or > 40; fail if absent | Main recruiter filter is skills ([Jobscan via VisualCV](https://www.visualcv.com/blog/resume-statistics-2026-hiring-trends/)) |
| | **personal.sensitive** (NEW) | 2 | 1 | Regex `\b(date of birth|d\.?o\.?b\.?|born|marital status|married|single|nationality|religion|gender|sex)\b` or `age:\s*\d{2}`. Photo = raster image in top 30% of page 1 with aspect ratio 0.7–1.4 and size 60–220 pt. | warn (locale note: DE/AE/PK conventions differ); never fail | [EMBL](https://www.embl.org/about/info/embl-fellows-career-service/blog/2019/08/what-to-include-in-your-cv/) |
| **Content/Impact (45 / 29)** | content.quantified | 11 | 7 | Bullet contains `\d`, `%`, currency, or number-words (e.g. "doubled", "tripled"). Ignore dates and phone numbers. | pass ≥ 50% of bullets; warn 25–49%; fail < 25% (linear in between) | Core check in RW, Rezi and Enhancv ([RW](https://resumeworded.com/score-guide)) |
| | **content.action-verbs** (NEW) | 8 | 5 | First token (after the bullet glyph) is in a curated list of ~250 action verbs (Harvard list + RW-style), in past or present tense. | pass ≥ 70%; warn 40–69%; fail < 40% | [Harvard OCS](https://careerservices.fas.harvard.edu/blog/2025/08/14/45-rare-action-verbs-for-your-resume-with-examples/) |
| | content.weak-openers | 5 | 3 | Phrases such as `responsible for`, `duties included`, `helped (with)?`, `worked on`, `tasked with`, `assisted (with|in)`. | pass 0–1; warn 2–3; fail ≥ 4 | [RW](https://resumeworded.com/score-guide) |
| | **content.bullet-length** (NEW) | 4 | 3 | Words per bullet. Long = > 30 words; short = < 5 words. Also count bullets per role. | pass ≤ 10% of bullets out of range and every role has 2–8 bullets; warn ≤ 30%; fail > 30% | [Rezi](https://intercom.help/rezihelp/en/articles/8383527-using-the-rezi-score), [Enhancv](https://enhancv.com/uk/cv-checker). The 30-word threshold is our assumption. |
| | content.pronouns | 3 | 2 | `\b(I|me|my|mine|we|our)\b` in bullets and summary (case-sensitive "I"). | pass 0; warn 1–3; fail ≥ 4 | [Rezi](https://intercom.help/rezihelp/en/articles/8383527-using-the-rezi-score) |
| | **content.buzzwords** (NEW) | 3 | 2 | Cliché list: results-driven, detail-oriented, team player, hard-working, self-starter, go-getter, synergy, think outside the box, dynamic, passionate, motivated, proven track record, best-of-breed. | pass 0–1; warn 2–3; fail ≥ 4 | RW, Rezi and Enhancv all flag these |
| | content.padding | 3 | 2 | Filler words (just, very, really, various, etc.) plus total word count. | words pass 350–900; warn 250–349 or 901–1,100; fail < 250 or > 1,100 | Rezi uses 400–600 words. We widen it because ResumeGo favours 2 pages. |
| | **length.pages** (NEW) | 4 | 3 | Page count from PDF/DOCX. Use years of experience from parsed dates. | pass 1–2 pages; warn 2 pages when < 2 years of experience, or 3 pages; fail ≥ 4 | [ResumeGo](https://www.resumego.net/research/one-or-two-page-resumes/) |
| | content.gaps | 3 | 2 | Gaps > 6 months between consecutive roles that the text doesn't explain. | warn only (informational); never fail | No evidence ATS penalise gaps; keep the weight low |
| | content.resume-accent | 1 | 0 | (existing check) | info only | Cosmetic |
| **Job Match (— / 35)** | match.hard-skills | — | 22 | Extract hard-skill terms from the JD (taxonomy + n-grams). Match after normalising case, plurals and acronym↔expansion. Weight each term by JD frequency. **Sub-rule:** a skill matched only in the Skills list counts 0.75; matched inside an experience bullet counts 1.0. | linear: pass ≥ 75% coverage; warn 50–74%; fail < 50% | Jobscan's ≥ 75% target; hard skills weigh most ([Jobscan](https://Jobscan.co/jobscan-tutorial)) |
| | match.title | — | 9 | Normalised JD title (strip seniority, level numerals) vs resume headline, summary and most recent title. | pass exact or synonym; warn ≥ 50% token overlap; fail otherwise | Jobscan ranks job title 3rd ([Jobscan](https://Jobscan.co/jobscan-tutorial)) |
| | match.soft-skills | — | 4 | Soft-skill lexicon matched against the JD. | linear; pass ≥ 60% | Jobscan says soft skills weigh lightly |

**Sums:**
- No-JD: Parse 35 + Sections 20 + Content 45 = **100**.
- With-JD: 23 + 13 + 29 + 35 = **100**.

**Hard caps** (apply after weighting):
- extraction.text = fail (image-only or garbled) → cap the total at **30**. Nothing else matters if the ATS can't read the file.
- No email **and** no phone → cap at **60**.

**Score bands for UI**, aligned with competitors (RW/Kickresume/Zety use 80+ as "good"):

| Score | Band |
|---|---|
| ≥ 85 | Strong |
| 70–84 | Good |
| 50–69 | Needs work |
| < 50 | At risk |

### 5.2 Gap list vs current checks

**Already covered:** extraction.* ×7, layout.* ×6, content.quantified/weak-openers/padding/linkedin/gaps/pronouns/resume-accent, match.title/hard-skills/soft-skills.

**Recommended additions (8, in priority order):**
1. `content.action-verbs`: first-token verb list, ≥ 70% of bullets.
2. `sections.skills`: present, with 6–40 items.
3. `length.pages`: 1–2 pass; 3 warn; ≥ 4 fail; 2 pages warns for < 2 years of experience.
4. `content.bullet-length`: > 30 or < 5 words; 2–8 bullets per role.
5. `contact.location`: city/region present; warn on a full street address.
6. `sections.summary`: present, 25–120 words.
7. `content.buzzwords`: cliché list; warn at ≥ 2.
8. `personal.sensitive`: photo, DOB, marital status, nationality. Warn only, and make it locale-aware.

**Considered and deferred:**
- **Tense consistency:** the current role should be present tense and past roles past tense. This needs POS tagging, which is noisy; **better as an LLM comment**.
- **File name:** low value. Rezi checks it, but recruiters rarely see it.
- **Acronym/expansion pairing:** fold it into match.hard-skills normalisation instead of making it a separate check.
- **Spelling of common tech terms:** for example "Javascript"→"JavaScript", "Github"→"GitHub", "Nodejs"→"Node.js", "Postgre"→"PostgreSQL". This is cheap as a dictionary map and could be an extra *warn-only* check if we have room.

**Change to existing checks:**
- content.gaps should never fail.
- match.hard-skills should add the placement sub-rule above.
