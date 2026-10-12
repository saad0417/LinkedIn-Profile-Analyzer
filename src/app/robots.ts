import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // API routes and the client-only result pages (also noindex). Nothing links to the result
        // pages with a plain href, so blocking the crawl does not hide their noindex tag from Google.
        disallow: ["/api/", "/results", "/linkedin/results", "/improve"],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
