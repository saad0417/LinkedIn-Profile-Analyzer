import type { MetadataRoute } from "next";
import { indexablePages, site } from "@/lib/site";

/**
 * Every indexable page and nothing else: result and improve pages are noindex and left out.
 * lastModified comes from the hand-maintained dates in src/lib/site.ts. Google ignores
 * changefreq and priority, so only lastmod is emitted.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePages.map((p) => ({
    url: p.path === "/" ? `${site.url}/` : `${site.url}${p.path}`,
    lastModified: p.lastModified,
  }));
}
