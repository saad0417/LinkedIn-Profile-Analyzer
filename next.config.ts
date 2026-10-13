import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy, sent as a static header.
 *
 * Why 'unsafe-inline' for scripts instead of nonces: Next streams RSC payloads
 * and bootstraps hydration with inline <script> tags, and most pages here are
 * prerendered at build time (Cache Components / partial prerendering). A nonce
 * must be fresh per request, which forces every page to render dynamically and
 * is incompatible with the prerendered shells, so nonces would cost the static
 * pages. The policy still blocks every third-party origin (scripts, frames,
 * connections), plugins, <base> hijacking and framing. JSON-LD blocks are data
 * (type="application/ld+json"), not executed, and are escaped at the source.
 *
 * - img-src data:/blob:  DOCX preview images are data: URIs; builder previews are blobs.
 * - worker-src blob:     pdf.js (/vendor/pdfjs) may fall back to a blob: worker.
 * - dev only: 'unsafe-eval' (React's dev tooling), ws: (HMR socket) and va.vercel-scripts.com
 *   (Vercel Analytics' debug script; in production it loads from /_vercel/insights on this origin).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // browsing-topics replaces the retired interest-cohort (FLoC), which Chrome now reports as unrecognised.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Production only: HSTS on http://localhost would pin the dev host to HTTPS in the browser.
  // includeSubDomains/preload are left off until every subdomain of the final domain is HTTPS.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ["pdfjs-dist"],
  poweredByHeader: false,
  // Hide the Next.js "N" badge in development; build errors still show.
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // pdf.js is copied here on install and never changes between deploys of the same version.
        source: "/vendor/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
  partialPrefetching: true,
};

export default nextConfig;
