import type { Metadata } from "next";
import { site } from "@/lib/site";

type PageSeo = {
  /** Path from the site root, e.g. "/linkedin". Becomes the canonical and og:url (made absolute via metadataBase). */
  path: `/${string}`;
  /** Goes through the root "%s | Parsewise" template unless `absoluteTitle` is set. Aim for 60 characters or fewer in total. */
  title: string;
  absoluteTitle?: boolean;
  /** 140 to 160 characters, primary keyword included. */
  description: string;
  /** Title on social cards, where og:site_name already names the brand. Defaults to `title`. */
  socialTitle?: string;
  keywords?: string[];
  article?: { publishedTime: string; modifiedTime: string };
};

/**
 * Metadata for one indexable page. Child metadata replaces the parent's `openGraph` and `twitter`
 * objects wholesale (shallow merge), so every page sets complete ones here instead of inheriting a
 * half-overridden mix from the root layout. og:image and twitter:image come from the
 * `opengraph-image.tsx` file in the page's own segment.
 */
export function pageMetadata(p: PageSeo): Metadata {
  const social = p.socialTitle ?? p.title;
  const og = {
    siteName: site.name,
    locale: site.locale,
    url: p.path,
    title: social,
    description: p.description,
  };
  return {
    title: p.absoluteTitle ? { absolute: p.title } : p.title,
    description: p.description,
    ...(p.keywords ? { keywords: p.keywords } : {}),
    alternates: { canonical: p.path },
    openGraph: p.article
      ? { ...og, type: "article", publishedTime: p.article.publishedTime, modifiedTime: p.article.modifiedTime }
      : { ...og, type: "website" },
    twitter: { card: "summary_large_image", title: social, description: p.description },
  };
}

/** For client-only pages that must never be indexed (results, improve). No canonical, no index. */
export function privatePageMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    // Replace the inherited alternates so a noindex page never declares a canonical.
    alternates: {},
  };
}
