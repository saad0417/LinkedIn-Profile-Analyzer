# SEO launch checklist

A step-by-step for getting Parsewiser live and indexed. The site already ships the technical pieces:
per-page titles, descriptions and canonicals, `sitemap.xml`, `robots.txt`, a web manifest, icons,
Open Graph images, and structured data. What's left is accounts, DNS and patience.

Nothing here guarantees rankings. "ATS resume checker" is a competitive query owned by established
tools. A new domain usually gets indexed within days to a couple of weeks, and ranking for the
head terms takes months of useful content and genuine links.

## 0. Launching on `*.vercel.app` (no custom domain yet)

You can launch on the free Vercel address now and move to a domain later.

1. **Vercel → New Project → import the GitHub repo.** Framework: Next.js (auto-detected). No build settings to change.
2. **Environment variables** (Settings → Environment Variables, scope *Production*):
   - `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.1-flash-lite`
   - `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (copy the list from `.env.example`)
   - `LLM_DAILY_CEILING=500`
   - AI quotas (whole site): `GEMINI_RPM`, `GEMINI_RPD`, `OPENROUTER_RPM`, `OPENROUTER_RPD`. Set each to ~90% of
     your real limits (Gemini: AI Studio → your project → Rate limits; a Google AI Plus/Pro subscription does
     not change API limits, only enabling billing does). When Gemini's quota is spent, requests use the
     OpenRouter backup; only when both are spent do visitors see a friendly "AI is busy" message.
   - Strongly recommended: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (free Upstash database). Without
     it every Vercel instance counts limits and quotas on its own, so the site-wide quotas aren't exact.
   - **Leave `NEXT_PUBLIC_SITE_URL` unset.** The site then uses the project's production address
     (`https://<project>.vercel.app`) for canonicals, the sitemap and share images automatically.
3. **Deploy**, then open `https://<project>.vercel.app/sitemap.xml` and `/robots.txt` and check they show that address.
   Preview deployments (other branches/PRs) get a `noindex` header from Vercel, so only production is indexed.
4. **Google Search Console** → Add property → **URL prefix** → `https://<project>.vercel.app/`
   (a *Domain* property needs DNS access, which `vercel.app` doesn't give you).
   - Choose **HTML tag** verification, copy only the `content="…"` value.
   - In Vercel add `GOOGLE_SITE_VERIFICATION=<that value>`, then **Redeploy** (the tag is added at build time).
   - Back in Search Console press **Verify**, then **Sitemaps** → submit `sitemap.xml`.
   - **URL Inspection** → Request indexing for `/`, `/builder`, `/linkedin`, `/templates`.

### When you buy a domain later
1. Vercel → Settings → Domains → add it and follow the DNS instructions. Make it the primary domain;
   Vercel then redirects the `vercel.app` address to it.
2. Set `NEXT_PUBLIC_SITE_URL=https://yourdomain.com` and redeploy.
3. Search Console: add a **Domain** property for the new domain (DNS TXT), submit its sitemap, and use
   **Change of address** on the old `vercel.app` property so Google moves the rankings across.

## 1. Domain

1. Buy the domain (any registrar). Decide on **one** host, apex (`parsewiser.app`) or `www`, and stick with it.
2. In Vercel → Project → Settings → Domains, add both `parsewiser.app` and `www.parsewiser.app`, and set the
   one you don't use to **redirect (308)** to the one you do. Follow Vercel's DNS instructions at your registrar.
3. Optional but tidy: redirect the `*.vercel.app` production alias to your domain too. The canonical tags
   already point at your domain, so this is belt and braces.

## 2. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Environments | Value |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Production | `https://parsewiser.app` (your chosen host, no trailing slash) |
| `GOOGLE_SITE_VERIFICATION` | Production | Only if you verify by meta tag (step 4b). The `content` value Google gives you. |
| `BING_SITE_VERIFICATION` | Production | Only if you verify Bing by meta tag. Rendered as `<meta name="msvalidate.01">`. |

How the site URL behaves (`src/lib/site.ts`):

- **Set:** must be an absolute `http(s)` URL or the build fails. A Vercel production build pointing at
  `localhost` also fails.
- **Unset on Vercel:** falls back to `https://` + Vercel's production domain for the project. That's the
  real domain, so canonicals stay correct, but set it explicitly anyway.
- **Unset in any other production build:** the build fails with a clear message. This is deliberate. A wrong
  origin doesn't break anything you can see. It writes `localhost` into every canonical tag and the sitemap,
  and you'd only find out from Search Console weeks later.

All of these are read **at build time**, so redeploy after changing any of them.

## 3. Deploy and smoke-test

Deploy, then check on the live domain:

```bash
curl -s https://parsewiser.app/robots.txt          # Sitemap: line must show your domain
curl -s https://parsewiser.app/sitemap.xml | head  # 12 URLs, all on your domain
curl -s https://parsewiser.app/ | grep -o '<link rel="canonical"[^>]*>'
curl -sI https://parsewiser.app/opengraph-image | grep -i content-type   # image/png
```

Preview deployments: Vercel sends `X-Robots-Tag: noindex` on preview URLs by default. Check one with
`curl -sI <preview-url> | grep -i x-robots` and leave it that way.

Paste a few URLs into the [Rich Results Test](https://search.google.com/test/rich-results) and a
social-card previewer (e.g. opengraph.xyz) to confirm the markup and images.

## 4. Google Search Console

Go to <https://search.google.com/search-console> and add a property.

**a. Domain property via DNS (recommended).** Covers `http`/`https`, apex and `www` in one property.
Choose *Domain*, enter `parsewiser.app`, copy the `google-site-verification=…` TXT record, add it at your
DNS provider, and click Verify (DNS can take a few minutes to an hour). Leave the TXT record in place.

**b. URL-prefix property via meta tag (alternative).** Choose *URL prefix*, enter `https://parsewiser.app/`,
pick *HTML tag*, and copy only the `content="…"` value. Set it as `GOOGLE_SITE_VERIFICATION` in Vercel,
redeploy, confirm `curl -s https://parsewiser.app/ | grep google-site-verification` shows it, then click
Verify. Keep the variable set, because removing the tag can un-verify the property.

Then:

1. **Sitemaps** → submit `https://parsewiser.app/sitemap.xml`. Status should become *Success* with 12 URLs discovered.
2. **URL Inspection** → inspect each key page and click **Request indexing** (there's a daily quota, so do
   the important ones first):
   `/`, `/linkedin`, `/builder`, `/templates`, `/guides`, `/guides/ats-resume-format`,
   `/guides/do-ats-reject-resumes`, `/guides/resume-keywords`, `/how-it-works`.
3. Use *Test live URL* → *View tested page* → *Screenshot* on `/builder` to confirm Google renders the
   builder's start screen (it is client-rendered).

## 5. Bing Webmaster Tools

Go to <https://www.bing.com/webmasters>, sign in, and choose **Import from Google Search Console**. It
copies verified sites and sitemaps in a couple of clicks. Bing also powers DuckDuckGo and Yahoo results,
and feeds some AI assistants. If you'd rather verify by meta tag, set `BING_SITE_VERIFICATION` and redeploy.

## 6. What to watch (weekly for the first two months)

- **Pages (indexing) report.** Watch "Crawled – currently not indexed" and "Discovered – currently not
  indexed" (usually just time or thin content), and "Duplicate, Google chose different canonical" (should
  be zero; if it isn't, check `NEXT_PUBLIC_SITE_URL` and the `www`/apex redirect). The result pages show as
  "Blocked by robots.txt" or "Excluded by noindex". That's expected.
- **Core Web Vitals.** Shows "Not enough data" until real Chrome users visit. Until then, use PageSpeed
  Insights on `/`, `/linkedin` and `/templates`.
- **Performance → Search results.** Queries, impressions, CTR and average position per page. Pages with
  high impressions and low CTR are where a better title or description pays off (edit in that page's
  `pageMetadata(...)`).
- **Enhancements.** Breadcrumbs (guides) should be valid. FAQ and HowTo markup is valid, but Google now shows
  FAQ rich results only for a small set of authoritative government and health sites and has retired HowTo
  rich results. Don't expect those snippets. The markup is harmless and some other consumers read it.
  The WebApplication markup has no ratings, so it won't produce star snippets, and fake ratings must never
  be added.
- When you edit a page's copy, bump its `lastModified` in `indexablePages` (`src/lib/site.ts`) so the
  sitemap stays truthful.

## 7. Content plan: next 10 guides

Each guide should answer one question well, link to the tool it relates to, and stay honest (the site's
edge is not overclaiming). Add each one to `guides` in `src/lib/site.ts`, with a `seoTitle` of 48
characters or fewer so the full `<title>` stays within 60, a 140–160 character description, and an
`opengraph-image.tsx` copied from an existing guide.

| # | Working title | Target keyword |
|---|---|---|
| 1 | What "ATS-friendly resume" actually means (and what it doesn't) | ats friendly resume |
| 2 | PDF or Word: which resume format do ATS read best? | pdf vs word resume ats |
| 3 | Resume section headings an ATS recognises | resume section headings |
| 4 | Two-column resumes and ATS: what really happens to your text | two column resume ats |
| 5 | How to tailor your resume to a job description in 15 minutes | tailor resume to job description |
| 6 | Resume action verbs that say what you did (with weak openers to replace) | resume action verbs |
| 7 | How to quantify resume achievements when you don't have obvious numbers | quantify resume achievements |
| 8 | LinkedIn headline examples by role, and the rules behind them | linkedin headline examples |
| 9 | How to write a LinkedIn About section recruiters read | linkedin about section examples |
| 10 | Applying through Workday: why it mangles your resume and how to fix it | workday resume parsing |

Also worth doing: a short "How to save your LinkedIn profile as a PDF" guide (keyword *save linkedin
profile as pdf*). The `/linkedin` page already explains it, and a guide can rank on its own.

## 8. Backlinks and first visitors

Aim for links from places real job seekers and developers already go. Never buy links or join link schemes.

- **Product Hunt.** Launch with a clear tagline ("See what an ATS actually extracts from your resume") and a
  short demo GIF of the parser view.
- **Reddit.** r/resumes, r/jobs, r/careerguidance, r/cscareerquestions. Read each sub's self-promotion
  rules, answer real questions first, and share the tool where it genuinely answers someone. These links are
  nofollow, but they bring users, and users bring natural links.
- **dev.to / Hashnode write-up.** "How I built a resume parser preview with pdf.js and Next.js": the
  two-column reading-order problem makes a strong technical story. Link to the site and the repo.
- **GitHub.** Put the live URL in the repo's About field and at the top of the README.
- **Show HN.** Only once the site is stable and fast. Lead with the "no fake ATS score" angle.
- **Career-centre and resource pages.** University careers services and bootcamps keep "free tools" lists.
  A short, polite email with what the tool does and the fact that it stores nothing works better than a pitch.
- **Free-tool directories** (AlternativeTo, There's An AI For That, etc.). Low value per link, but they help discovery early on.
