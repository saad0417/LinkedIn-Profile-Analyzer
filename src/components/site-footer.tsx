import Link from "next/link";
import { guides, site } from "@/lib/site";
import { Wordmark } from "./site-header";

export function SiteFooter() {
  return (
    <footer className="container-page mt-24 pb-6">
      <div className="glass grid gap-10 p-7 sm:grid-cols-2 sm:p-10 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Wordmark />
          <p className="mt-3 text-sm text-ink-muted">
            Free tools to check, fix and build resumes and LinkedIn profiles that applicant tracking systems can read.
            Files are processed in memory and never stored.
          </p>
        </div>
        <FooterGroup title="Tools">
          <FooterLink href="/">ATS resume checker</FooterLink>
          <FooterLink href="/builder">Resume builder</FooterLink>
          <FooterLink href="/linkedin">LinkedIn profile analyzer</FooterLink>
          <FooterLink href="/templates">Resume templates</FooterLink>
        </FooterGroup>
        <FooterGroup title="Learn">
          <FooterLink href="/how-it-works">How scoring works</FooterLink>
          {guides.map((g) => (
            <FooterLink key={g.slug} href={`/guides/${g.slug}`}>
              {g.short}
            </FooterLink>
          ))}
        </FooterGroup>
        <FooterGroup title="Company">
          <FooterLink href="/about">About</FooterLink>
          <FooterLink href="/privacy">Privacy policy</FooterLink>
          <FooterLink href="/terms">Terms of use</FooterLink>
        </FooterGroup>
      </div>
      <div className="flex flex-col gap-2 px-2 py-5 text-xs text-ink-muted sm:flex-row sm:justify-between">
        <span>© 2026 {site.name}. Built for job seekers, not recruiters.</span>
        <span>Not affiliated with LinkedIn or any applicant tracking system vendor.</span>
      </div>
    </footer>
  );
}

function FooterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="eyebrow mb-3">{title}</h2>
      <ul className="space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-ink-muted hover:text-ink">
        {children}
      </Link>
    </li>
  );
}
