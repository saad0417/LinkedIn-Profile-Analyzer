import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/privacy",
  title: "Privacy Policy",
  description:
    "Your resume and LinkedIn PDF are processed in memory and never stored. What we do and don't keep, what goes to the AI provider, and what stays in your browser.",
});

export default function Privacy() {
  return (
    <div className="container-page pt-12 sm:pt-20">
      <div className="max-w-2xl">
        <p className="eyebrow">Privacy policy</p>
        <h1 className="mt-3 font-display text-[2.3rem] leading-[1.12] sm:text-[3.2rem]">Your files are never stored.</h1>
        <p className="mt-4 text-ink-muted">Last updated 12 October 2026.</p>
      </div>
      <div className="glass-strong mt-10 max-w-3xl px-6 py-4 sm:px-12 sm:py-8">
        <div className="prose-guide">
          <h2>Files you upload</h2>
          <p>
            When you check a resume or analyse a LinkedIn PDF, the file is sent over an encrypted connection to our
            server, held in memory while it is analysed, and discarded when your results are returned, usually within
            a second or two. It is never written to disk, never put in a database, and never used to train any model.
          </p>
          <p>
            We check the file&apos;s contents to confirm its type, and read only its text and layout. Document metadata
            such as author names or editing history is not returned or kept.
          </p>

          <h2>What stays in your browser</h2>
          <ul>
            <li>
              <strong>Results</strong> for a resume check or LinkedIn analysis are kept in your browser tab (session
              storage) so a refresh doesn&apos;t lose them. Closing the tab clears them.
            </li>
            <li>
              <strong>Resume builder drafts</strong> are saved in your browser&apos;s local storage so you can come
              back to them. They stay on your device until you press &ldquo;Start over&rdquo; or clear your browser
              data. We have no copy.
            </li>
          </ul>

          <h2>AI features</h2>
          <p>
            AI runs only when you press a button. When you do, only the text needed for that request is sent to our AI
            provider, Google&apos;s Gemini API. If Gemini is unavailable, the same request may be sent to OpenRouter as
            a backup, which routes it to the model we&apos;ve configured there:
          </p>
          <ul>
            <li>a bullet rewrite or explanation sends that bullet or finding;</li>
            <li>&ldquo;Write it with AI&rdquo; in the builder sends the details you typed into the builder;</li>
            <li>a LinkedIn AI review sends the profile text we extracted from your PDF.</li>
          </ul>
          <p>
            Files themselves are never sent to an AI provider. Each provider processes requests under its own terms;
            free models on OpenRouter may be offered by providers that keep prompts, so the backup is only used when
            Gemini fails.
          </p>

          <h2>What we do keep</h2>
          <p>
            To prevent abuse, we count requests per IP address for up to 24 hours (for example, five resume checks per
            hour). These counters contain no resume content and expire automatically. Our hosting provider keeps
            standard access logs.
          </p>

          <h2>Analytics</h2>
          <p>
            We use Vercel Web Analytics to count page views and see which pages are useful. It sets no cookies,
            doesn&apos;t track you across sites, and only reports aggregated numbers (pages, referrers, country, device
            type). It never sees your files, results or anything you type.
          </p>

          <h2>No accounts, no ad tracking</h2>
          <p>
            There are no user accounts, no advertising cookies and no selling of data. There is nothing to sell.
          </p>

          <h2>Questions</h2>
          <p>
            See how scoring works on <Link href="/how-it-works">the method page</Link>, or read our{" "}
            <Link href="/terms">terms of use</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
