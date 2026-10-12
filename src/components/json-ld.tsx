import { site } from "@/lib/site";

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" so user-facing strings can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** Stable @id values so page-level markup (Article author, publisher...) can point at the sitewide nodes. */
export const ldIds = {
  organization: () => `${site.url}/#organization`,
  website: () => `${site.url}/#website`,
};

/** A reference to the sitewide Organization node, for author/publisher fields. */
export const orgRef = () => ({ "@id": ldIds.organization() });

/**
 * Sitewide Organization. Only real data: the logo is the site's own icon, and there is no
 * `sameAs` because there are no official social profiles yet. Add them here when there are.
 */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ldIds.organization(),
    name: site.name,
    url: `${site.url}/`,
    description: site.tagline,
    logo: { "@type": "ImageObject", url: `${site.url}/icon-512.png`, width: 512, height: 512 },
  };
}

/** Sitewide WebSite node: gives Google the site name. No SearchAction, as there is no site search. */
export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": ldIds.website(),
    name: site.name,
    url: `${site.url}/`,
    description: site.description,
    inLanguage: "en",
    publisher: orgRef(),
  };
}
