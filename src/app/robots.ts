import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/results", "/linkedin/results", "/improve"] }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
