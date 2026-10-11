# LinkedIn profile criteria — research notes

_Compiled 2026-10-12. Every claim links to its source. Anything marked "(unverified)" could not be confirmed against LinkedIn's own documentation. LinkedIn publishes very little about search ranking, so most ranking claims come from Jobscan and career sites._

---

## 1. What recruiters search on (LinkedIn Recruiter)

| Field | How it maps to the profile | Source |
|---|---|---|
| **Job titles** | Matched against titles in the **Experience** section, as current, past or both. | [LinkedIn "How search filters work" (2016–19, via Scribd)](https://www.scribd.com/document/655268675/HowSearchFiltersWork) |
| **Skills & Assessments** | Matched against the Skills section. | [Skylead](https://skylead.io/blog/find-employees-using-linkedin-recruiter-search-filters/) (vendor blog) |
| **Keywords (Boolean)** | Searches the entire profile, including headline, About and experience text. | [Skylead](https://skylead.io/blog/find-employees-using-linkedin-recruiter-search-filters/) |
| **Location** | The profile location line. Recruiters can also include people open to relocating. | [Skylead](https://skylead.io/blog/find-employees-using-linkedin-recruiter-search-filters/) |
| **Years of experience** | Summed across all positions, internships included. | [Leonar](https://www.leonar.app/blog/linkedin-recruiter-search-filters/) (vendor blog) |
| **Workplace type, Open to Work** | Taken from Open-To-Work preferences. | [Skylead](https://skylead.io/blog/find-employees-using-linkedin-recruiter-search-filters/) |

**Headline weighting:** Jobscan calls the headline "the highest-weighted field in LinkedIn's search algorithm", says earlier terms "carry the most weight", and says the key keywords belong in the first ~80 characters because mobile results show only that much ([Jobscan](https://www.jobscan.co/blog/impactful-linkedin-headline-examples)). **This is Jobscan's claim, not LinkedIn's.**

**Implication for scoring:** experience titles, the headline, skills and location are the searchable fields. Those are what our checks should weight most.

---

## 2. Section-by-section guidance

| Element | Facts and limits | Best practice | Source |
|---|---|---|---|
| **Headline** | 220 characters, up from 120 in late 2020. | Target 160–200 chars. Put the role and top keywords in the first 80. Formula: `Role \| Top skills \| Value/achievement`. Don't use the headline for job title only. | [Unilink](https://www.unilink.us/blog/linkedin-character-limits-2026) (third-party), [Jobscan](https://www.jobscan.co/blog/impactful-linkedin-headline-examples) |
| **About** | 2,600 characters. The "see more" fold is at about 370 chars on desktop and 230 on mobile, i.e. roughly the first 2–3 lines. | Open with the role and value, include keywords, add a CTA or contact line. First person is normal on LinkedIn, unlike a resume. | [Unilink](https://www.unilink.us/blog/linkedin-character-limits-2026) (third-party) |
| **Experience** | 2,000 characters per position description. | Descriptions with achievements and numbers. Titles a recruiter would actually search for, since the title filter matches Experience titles. Current role filled in. | [Unilink](https://www.unilink.us/blog/linkedin-character-limits-2026), [Scribd/LinkedIn](https://www.scribd.com/document/655268675/HowSearchFiltersWork) |
| **Skills** | Up to **100** skills. | List 5+. LinkedIn (2016): members with ≥ 5 skills get "up to 17×" more profile views and "up to 33×" more messages. | [LinkedIn Help: Display order of skills](https://www.linkedin.com/help/linkedin/answer/35265), [LinkedIn blog 2016](https://blog.linkedin.com/2016/08/03/5-steps-to-improve-your-linkedin-profile-in-minutes-), [LinkedIn news 2016](https://news.linkedin.com/2016/rethinking-linkedin-endorsements-so-members-always-look-their-best) |
| **Profile strength / "All-Star" (historical)** | Photo, location, industry, current position with description, 2 past positions, education, ≥ 5 skills (older sources say 3), ≥ 50 connections. LinkedIn has since de-emphasised the meter. | n/a | [Cleverly 2025](https://www.cleverly.co/blog/how-to-optimize-your-linkedin-profile-guide) (third-party) |
| **Photo / banner** | LinkedIn (2016): photo = "up to 21×" more views and 36× more messages. **Not in the PDF export.** | n/a | [LinkedIn blog 2016](https://blog.linkedin.com/2016/08/03/5-steps-to-improve-your-linkedin-profile-in-minutes-) |
| **Custom URL** | 3–100 chars, first come first served, max 5 changes per 6 months. | Use a name-based slug, not the default with random suffix digits. | [LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/87) (edit path), [Miltrac](https://miltrac.org/2025/11/13/how-a-custom-linkedin-url-will-help-you-stand-out-among-others/) (limits, third-party) |
| **Open to Work** | LinkedIn-reported ~40% more recruiter InMails. Options: public frame or recruiters-only. **Not visible in the PDF.** | n/a | [LinkedIn Learning via lynda.com](https://origin-www.lynda.com/LinkedIn-tutorials/Open-finding-new-job/2887179/2894320-4.html), [Coursera](https://www.coursera.org/articles/how-to-let-recruiters-know-youre-open-on-linkedin) |
| **Recommendations, endorsements, Featured, activity** | None of these appear in the PDF (see §3). | n/a | n/a |
| **Location** | A Recruiter filter field, and part of All-Star. | n/a | see above |

**Competitor scope:**
- **Resume Worded "LinkedIn Review"** does line-by-line review of the headline, summary/About, experience descriptions and keyword coverage for recruiter search. It publishes no weights ([Resume Worded llm-info](https://resumeworded.com/llm-info)).
- **Jobscan's LinkedIn tool** checks headline length, formatting and target-role fit, plus the skills recruiters search for. It recommends a match of ≥ 80% ([Jobscan LinkedIn](https://www.jobscan.co/linkedin-optimization), [WGU](https://careers.wgu.edu/resources/jobscan-information-for-faculty/)).

**Caveat on the LinkedIn statistics:** the 17×, 21× and 40× figures are LinkedIn's own "up to" marketing numbers from about 2016 with no independent verification. If we use them in UI copy, quote them as "LinkedIn says…".

---

## 3. The "Save to PDF" export: contents and layout

**How we confirmed it:**
- Export path: Profile → **More → Save to PDF**. Desktop only; not offered on mobile ([ez-parse README](https://pypi.org/project/ez-parse/), [Flowcase](https://flowcase.com/blog/linkedin-to-pdf)).
- We downloaded a real export (2023) from the [ShivanshSrivastava1/Resume-Parser](https://github.com/ShivanshSrivastava1/Resume-Parser) sample folder and ran `pdftotext` on it. That parser's header list is `Contact, Top Skills, Certifications, Honors-Awards, Publications, Summary, Languages, Experience, Education`.

**PDF metadata** (useful as a "this is a LinkedIn export" fingerprint):
- `Author: LinkedIn`
- `Title: Resume`
- `Subject: Resume generated from profile`
- `Producer: Apache FOP Version 2.2`

The fingerprint is from our single observed sample and may change.

### 3.1 Layout (observed)

The export is a **two-column page**: a narrow left sidebar plus a wide main column.

**Left sidebar, page 1, in this order:**
- `Contact`
  - phone with a type label, e.g. `5202620535 (Mobile)`
  - email
  - profile URL followed by ` (LinkedIn)`. **The URL wraps across lines** (`www.linkedin.com/in/shivansh-` / `srivastava-cs001 (LinkedIn)`).
  - other websites, also with type labels. The specific labels are **unverified**.
- `Top Skills`: **3 items in the sample.** Whether LinkedIn now shows up to 5 here, matching the newer "top skills" feature, is **unverified**.
- `Languages`: e.g. `Spanish (Professional Working)`, `Hindi (Native or Bilingual)`
- `Certifications`
- `Honors-Awards`
- `Publications`

**Main column:**
- **Name**, then **Headline**, then **Location** (e.g. `New York City Metropolitan Area`)
- `Summary`: the About text, apparently in full, with no "see more" truncation in the PDF.
- `Experience`. Each entry is:
  - Company
  - Title
  - `Month YYYY - Present (N years N months)` or `Month YYYY - Month YYYY (1 year 4 months)`. Durations below a year read `(11 months)`.
  - Location line
  - Description, which keeps the user's own bullet characters (e.g. `- `)
  - When one company has **several roles**, the company is grouped with a total duration. **Recalled from memory; the observed sample didn't show it.**
- `Education`: `School` / `Degree, Field · (YYYY - YYYY)`

**Footer:** `Page X of Y`, centred on every page.

**Text extraction gotcha:**
- With `pdftotext -layout`, the sidebar and main column **interleave on the same line** (e.g. `Top Skills   Hi, I'm Shivansh!…`). The parser must split by x-coordinate: the sidebar is roughly the left 30% of the page width.
- Sidebar content only appears on page 1. Main-column content continues across pages, so strip `Page X of Y` before joining pages.
- The **Save to PDF** feature isn't offered for some profile languages (zh, ja, ko, ru, ar, th), and "only English characters will display correctly" ([Flowcase](https://flowcase.com/blog/linkedin-to-pdf)).

### 3.2 Visible in the PDF vs not visible

| Visible in the PDF (can score) | **Not** in the PDF (must not score) |
|---|---|
| Name, headline, location | Profile photo, banner |
| Contact: email, phone, profile URL, websites | Recommendations (given and received) |
| Summary (About) | Endorsement counts; skills beyond the top ~3 |
| Experience: titles, companies, dates, durations, locations, descriptions | Featured section, Activity/posts |
| Education: school, degree, field, years | Connection or follower count |
| Top Skills (~3), Languages, Certifications, Honors-Awards, Publications | Open to Work status, Creator mode, Services |
| Custom URL slug (from Contact) | Industry field; volunteering, projects and courses (**unverified**; possibly omitted) |

**UI requirement:** the UI must say these items weren't assessed. **Never penalise a missing photo or missing recommendations.** At most, show a non-scored "also check on LinkedIn" tip list.

---

## 4. Recommended rubric for our LinkedIn score (0–100)

**Scoring rules:**
- Each check gives pass = 100%, warn = 50%, fail = 0% of its weight. Section score = sum of check weights. **Total = 100.**
- The rubric scores only what the PDF shows.
- "Role keyword" means a token from our job-title lexicon (e.g. engineer, developer, manager, analyst, designer, accountant, nurse, consultant, marketing, sales, data, product…) **or** a word from the current Experience title.

### 4.1 Section weights

| Section id | Weight | Why |
|---|---:|---|
| `headline` | 15 | Highest-weighted search field (Jobscan); the first thing recruiters see |
| `about` | 20 | Keyword-searchable and the main narrative; fully visible in the PDF |
| `experience` | 30 | Recruiter title filter and years of experience come from here; holds the most content |
| `skills` | 12 | Skills filter; only ~3 are visible in the PDF, so weight is capped |
| `education` | 8 | Common filter; All-Star criterion |
| `credentials` | 5 | Optional differentiators |
| `contact` | 10 | Custom URL and location (location is a Recruiter filter) |

### 4.2 Checks

| Section | Check | Wt | Rule | Pass / Warn / Fail | Justification + source |
|---|---|---:|---|---|---|
| **headline (15)** | length | 4 | Character count of the headline line. | pass 70–220; warn 40–69; fail < 40 | 220 limit; Jobscan targets 160–200 ([Jobscan](https://www.jobscan.co/blog/impactful-linkedin-headline-examples)) |
| | role-keyword | 5 | Contains a role keyword within the first 80 chars. | pass in first 80; warn only after char 80; fail none | Early terms weigh most; mobile shows the first ~80 ([Jobscan](https://www.jobscan.co/blog/impactful-linkedin-headline-examples)) |
| | not-generic | 3 | Fail if it matches `^(student|aspiring|seeking|looking for|unemployed|open to work)\b` with no other segment, or `^[^|•·,]{0,40}\bat\b [^|•·,]+$` (pure "Title at Company" / "Student at X"). | pass none; warn "Title at Company"; fail "Student at X" or "Seeking…" only | Title-only headlines waste the field ([Jobscan](https://www.jobscan.co/blog/impactful-linkedin-headline-examples)) |
| | value-segments | 3 | ≥ 2 segments split by `|`, `•`, `·`, `–`, or `,` **and** ≥ 1 skill or domain term beyond the title. | pass ≥ 2 segments + skill; warn 1 segment + skill; fail neither | Role \| Skills \| Value formula ([Jobscan](https://www.jobscan.co/blog/impactful-linkedin-headline-examples)) |
| **about (20)** | length | 8 | Character count of `Summary`. | pass ≥ 1,000; warn 300–999; fail < 300 or missing | 2,600 limit; a longer About gives more keyword surface ([Unilink](https://www.unilink.us/blog/linkedin-character-limits-2026)) |
| | hook | 4 | First 300 chars contain a role keyword or a skill from Top Skills/Experience. | pass / fail | Only ~230–370 chars show before "see more" on the live profile ([Unilink](https://www.unilink.us/blog/linkedin-character-limits-2026)) |
| | evidence | 3 | Contains ≥ 1 metric (`\d+%`, currency, `\d+\+?`, or number-words), excluding years. | pass ≥ 2; warn 1; fail 0 | Quantified achievements convention (RW review scope) |
| | structure | 3 | ≥ 2 paragraphs (blank-line split) or ≥ 3 bullet lines; no paragraph > 600 chars. | pass / warn | Readability ([HR Dive / Ladders](https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/)) |
| | cta | 2 | Email, URL, or a `reach out|contact me|let's connect|get in touch|open to` phrase. | pass / warn | Career-site convention (unverified). **Do not penalise first-person pronouns here.** |
| **experience (30)** | role-count | 4 | Number of Experience entries. | pass ≥ 3; warn 1–2; fail 0 | All-Star wanted current + 2 past ([Cleverly](https://www.cleverly.co/blog/how-to-optimize-your-linkedin-profile-guide)) |
| | descriptions | 6 | Share of roles with a description ≥ 100 chars. | pass ≥ 66%; warn 33–65%; fail < 33% | Keyword surface; All-Star needs a described current role |
| | current-role | 6 | ≥ 1 entry with `- Present`, and its description is ≥ 200 chars. | pass; warn if present but < 200 chars; fail if no current role or no description | [Cleverly](https://www.cleverly.co/blog/how-to-optimize-your-linkedin-profile-guide). **Students:** if there's no Present role but Education ends ≥ the current year, downgrade fail → warn. |
| | quantified | 6 | Share of described roles with ≥ 1 metric (exclude dates and durations). | pass ≥ 50%; warn 1–49%; fail 0 | Achievement convention (RW, Rezi) |
| | searchable-titles | 3 | Titles not in a vanity list (ninja, rockstar, guru, wizard, hero, evangelist w/o domain), not emoji-only, not only "Self-employed"/"Freelancer" without a role word; ≥ 1 role keyword. | pass all; warn any vanity title; fail none contain a role keyword | Recruiter title filter matches Experience titles ([LinkedIn filters doc](https://www.scribd.com/document/655268675/HowSearchFiltersWork)) |
| | dates-locations | 3 | Each entry has a parseable `Month YYYY` range (always true in exports) and a location line. | pass ≥ 80% with location; warn otherwise | Location filter; completeness |
| | action-verbs | 2 | Description bullets start with action verbs (same verb list as the ATS check). | pass ≥ 50%; warn otherwise | Readability; lenient because LinkedIn prose is acceptable |
| **skills (12)** | top-skills-count | 6 | Items under the sidebar `Top Skills`. | pass ≥ 3; warn 1–2; fail 0 or section missing | The PDF shows ~3 (observed). LinkedIn: ≥ 5 skills → "up to 17×" views ([LinkedIn 2016](https://blog.linkedin.com/2016/08/03/5-steps-to-improve-your-linkedin-profile-in-minutes-)). **Make the pass threshold configurable**, because the number of visible top skills is unverified. |
| | alignment | 4 | ≥ 1 Top Skill appears (case-insensitive) in the headline, About or Experience text. | pass ≥ 2; warn 1; fail 0 | Keyword consistency helps search (Jobscan) |
| | hard-skill | 2 | ≥ 1 Top Skill is a hard/tool skill (not in the soft-skill lexicon). | pass / warn | Recruiters filter on hard skills ([Jobscan via VisualCV](https://www.visualcv.com/blog/resume-statistics-2026-hiring-trends/)) |
| **education (8)** | present | 4 | `Education` section with ≥ 1 entry. | pass; fail if missing (warn instead if experience ≥ 10 years) | All-Star criterion ([Cleverly](https://www.cleverly.co/blog/how-to-optimize-your-linkedin-profile-guide)) |
| | degree-field | 2 | The entry has a degree/qualification line, not just a school name. | pass / warn | Degree filters |
| | dates | 2 | `· (YYYY - YYYY)` present. | pass / warn | Years-of-experience inference |
| **credentials (5)** | any | 3 | ≥ 1 of Certifications, Honors-Awards, Publications, Languages has ≥ 1 item. | pass / warn (never fail) | Optional differentiators |
| | depth | 2 | ≥ 1 Certification **or** ≥ 2 of the sections above. | pass / warn | Certifications are keyword-searchable |
| **contact (10)** | custom-url | 4 | Join wrapped lines, then take the slug from `linkedin\.com/in/([^\s/]+)`. Default-looking = ends with `-[0-9a-f]{6,}$` or `-?\d{3,}$`, or is > 40 chars. | pass custom; warn default-looking; fail no URL found | A custom URL is recommended by LinkedIn Help ([LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/87)) |
| | location | 3 | Location line under the headline is present. | pass / fail | Recruiter location filter; All-Star criterion |
| | email | 2 | Email in Contact. | pass / warn | Lets recruiters contact the candidate outside InMail |
| | extra-link | 1 | ≥ 1 website besides the LinkedIn URL (portfolio, GitHub, company). | pass / warn | Evidence of work (convention) |

**Section totals:** headline 15, about 20, experience 30, skills 12, education 8, credentials 5, contact 10 = **100**. Within-section weights also sum to each section's weight.

**Guards:**
- If the PDF isn't recognised as a LinkedIn export (metadata or header fingerprint fails), score with the ATS pipeline instead and tell the user.
- If the `Summary` heading is absent, the about section scores **0**, not "unknown". LinkedIn omits the heading when About is empty.

**Not scored; show as an "also check on LinkedIn" list:**
- photo
- banner
- recommendations (aim for ≥ 2–3)
- Featured
- Open to Work (recruiters-only if employed)
- recent activity
- full skills list (up to 100; LinkedIn Help)
- 50+ connections (old All-Star bar)

### 4.3 What the LLM review should comment on (rules can't)
1. **Target-role alignment.** Do the headline, About and titles tell one consistent story for the role the user wants? Suggest the 5–10 search keywords the profile is missing for that role.
2. **Headline quality.** Is the value proposition specific ("cut AWS spend 30%") or generic ("passionate professional")? Propose 2–3 rewrites within 220 chars, with keywords in the first 80.
3. **About opening.** Does it hook in the first ~230 characters (the mobile fold)? Is the tone authentic and in first person, without clichés? Is there a clear CTA?
4. **Experience specificity.** Are the bullets achievements or duties? Flag vague claims and suggest where a metric belongs. Without inventing numbers, point out where the user should supply one.
5. **Title searchability.** Internal or odd titles (e.g. "Member of Technical Staff") should get a market-standard equivalent in the headline or description.
6. **Consistency.** Do Top Skills match what the experience shows? Are dates and seniority coherent? Are there unexplained gaps (comment, don't penalise)?
7. **Clarity and grammar.** Spelling, tense consistency (past roles in past tense), jargon density, readability for non-specialist recruiters.
8. **Locale and audience fit.** Spelling variant, tone for the target market, and avoiding sensitive personal details.
