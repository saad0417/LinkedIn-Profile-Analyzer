import type { MetadataRoute } from "next";
import { guides, site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = "2026-10-12";
  return [
    { url: `${site.url}/`, lastModified: updated, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/builder`, lastModified: updated, changeFrequency: "monthly", priority: 0.9 },
    { url: `${site.url}/linkedin`, lastModified: updated, changeFrequency: "monthly", priority: 0.9 },
    { url: `${site.url}/how-it-works`, lastModified: updated, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site.url}/templates`, lastModified: updated, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site.url}/guides`, lastModified: updated, changeFrequency: "weekly", priority: 0.7 },
    ...guides.map((g) => ({
      url: `${site.url}/guides/${g.slug}`,
      lastModified: g.published,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${site.url}/about`, lastModified: updated, changeFrequency: "yearly", priority: 0.4 },
    { url: `${site.url}/privacy`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site.url}/terms`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
  ];
}
