# Parsewiser

ATS resume checker, resume builder and LinkedIn profile analyzer. Next.js 16 (App Router, Cache Components), TypeScript, Tailwind v4. No database: uploads are processed in memory and discarded.

## Run it

```bash
npm install          # also copies pdf.js into public/vendor (postinstall)
npm run dev
```

AI keys go in `.env.local` (gitignored; `.env.example` documents every variable):

- `GEMINI_API_KEY`: the main provider.
- `OPENROUTER_API_KEY`: optional backup. If a Gemini request fails (bad key, quota, timeout, outage) it is retried once on OpenRouter, using a free model by default.

Without either key everything works except the AI rewrites/reviews, and their buttons are hidden. Restart `npm run dev` (or rebuild in production) after changing keys.

## What's where

| Area | Path |
|---|---|
| Resume parsing + checks + scoring (deterministic) | `src/lib/analyze/` |
| LinkedIn PDF parser + rubric | `src/lib/linkedin/` |
| Overall ATS score formula | `src/lib/ats-score.ts` |
| Templates (DOCX + PDF), registry | `src/lib/export/` |
| LLM provider interface, prompts, guards | `src/lib/llm/` |
| Upload sniffing, rate limits | `src/lib/security/` |
| Research behind the rubrics | `docs/research/` |

## Tests

```bash
npx tsx scripts/run-fixtures.ts           # 29 resume fixtures: expectations, determinism, rematch
npx tsx scripts/run-linkedin-fixtures.ts  # 7 LinkedIn fixtures
```

## Deploying

Set `NEXT_PUBLIC_SITE_URL` (canonical URLs, sitemap) and, optionally, `GEMINI_API_KEY`. On Vercel note the 4.5 MB request body limit for functions, which is below the app's 5 MB upload cap. Rate limits are in-memory per instance; swap `src/lib/security/rate-limit.ts` to Redis/Upstash for strict limits.

## Deploying & SEO

Step-by-step launch guide (domain, Vercel, Search Console, Bing, what to monitor, content plan): [`docs/SEO-LAUNCH.md`](docs/SEO-LAUNCH.md).

- **`NEXT_PUBLIC_SITE_URL`** is the origin for canonicals, Open Graph URLs, `sitemap.xml`, `robots.txt` and JSON-LD. Production builds fail if it is invalid, or unset outside Vercel (on Vercel it falls back to the project's production domain). Read at build time, so redeploy after changing it.
- **`GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION`** (optional) render the `google-site-verification` / `msvalidate.01` meta tags only when set.
- **Per-page metadata:** `pageMetadata()` in `src/lib/seo.ts` (title, description, canonical, Open Graph, Twitter). Noindex pages use `privatePageMetadata()`.
- **Sitemap dates:** `indexablePages` in `src/lib/site.ts`. Bump a page's `lastModified` when its copy changes.
- **Social images:** each indexable segment has an `opengraph-image.tsx` that calls the shared card in `src/app/_og/card.tsx` (Barlow Condensed and IBM Plex Sans TTFs bundled under the SIL OFL).
- **Icons:** `src/app/icon.svg` (source), `favicon.ico`, `apple-icon.png`, and manifest PNGs in `public/` (`icon-192`, `icon-512`, `icon-maskable-512`). Regenerate the PNGs from the SVG if the mark changes.
- **Structured data:** sitewide `Organization` and `WebSite` (root layout), plus per-page WebApplication, FAQPage, HowTo, Article, BreadcrumbList, CollectionPage, AboutPage and TechArticle. Builders are in `src/components/json-ld.tsx`.
