import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, ldIds, orgRef } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { guides, site, type Guide } from "@/lib/site";

export function guideMetadata(slug: Guide["slug"]): Metadata {
  const g = guides.find((x) => x.slug === slug)!;
  return pageMetadata({
    path: `/guides/${g.slug}`,
    title: g.seoTitle,
    socialTitle: g.title,
    description: g.description,
    article: { publishedTime: g.published, modifiedTime: g.updated },
  });
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d} ${months[m - 1]} ${y}`;
}

export function GuideArticle({
  slug,
  readMinutes,
  children,
}: {
  slug: Guide["slug"];
  readMinutes: number;
  children: React.ReactNode;
}) {
  const g = guides.find((x) => x.slug === slug)!;
  const others = guides.filter((x) => x.slug !== slug);
  const url = `${site.url}/guides/${g.slug}`;

  return (
    <article className="container-page pt-10 sm:pt-16">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: g.title,
            description: g.description,
            image: `${url}/opengraph-image`,
            datePublished: g.published,
            dateModified: g.updated,
            inLanguage: "en",
            mainEntityOfPage: url,
            isPartOf: { "@id": ldIds.website() },
            author: { "@type": "Organization", "@id": ldIds.organization(), name: site.name, url: `${site.url}/` },
            publisher: orgRef(),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${site.url}/` },
              { "@type": "ListItem", position: 2, name: "Guides", item: `${site.url}/guides` },
              { "@type": "ListItem", position: 3, name: g.short, item: url },
            ],
          },
        ]}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-ink">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/guides" className="hover:text-ink">Guides</Link>
          </li>
        </ol>
      </nav>

      <header className="mt-6 max-w-3xl">
        <h1 className="font-display text-[2.1rem] leading-[1.14] sm:text-[3.1rem]">{g.title}</h1>
        <p className="mt-5 text-[1.08rem] text-ink-muted">{g.description}</p>
        <p className="mt-5 font-mono text-xs uppercase tracking-[0.08em] text-ink-faint">
          <time dateTime={g.published}>{formatDate(g.published)}</time>
          {g.updated !== g.published && (
            <>
              {" "}· Updated <time dateTime={g.updated}>{formatDate(g.updated)}</time>
            </>
          )}{" "}
          · {readMinutes} min read
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14">
        <div className="glass-strong px-6 py-4 sm:px-12 sm:py-8">
          <div className="prose-guide">{children}</div>
        </div>
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="glass p-6">
            <p className="font-display text-xl leading-tight">Check yours now</p>
            <p className="mt-2 text-sm text-ink-muted">
              Upload your resume and see what a parser extracts from it. Free, nothing stored.
            </p>
            <Link href="/#check" className="btn btn-primary mt-4 w-full">
              Check my resume
            </Link>
          </div>
          <div className="glass-thin p-5">
            <p className="eyebrow">More guides</p>
            <ul className="mt-3 space-y-3 text-sm">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={`/guides/${o.slug}`} className="link">
                    {o.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </article>
  );
}
