# Parsewise

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
