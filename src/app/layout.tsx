import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Barlow_Condensed, IBM_Plex_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AiProvider } from "@/components/ai-context";
import { aiEnabled } from "@/lib/ai-enabled";
import { site } from "@/lib/site";
import { JsonLd, organizationLd, websiteLd } from "@/components/json-ld";
import "./theme.css";

/** All headings, the wordmark and big numbers: a tall condensed grotesque (free stand-in for Vanguard CF). */
const heading = Barlow_Condensed({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  // Variable weight, so body text can sit at 450: a touch heavier than regular for easier reading.
  subsets: ["latin"],
  variable: "--font-plex-sans",
  display: "swap",
});


const homeTitle = `ATS Resume Checker: See What the Parser Sees | ${site.name}`;

/** Search-engine ownership tags, rendered only when the env var is set (read at build time). */
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const bingVerification = process.env.BING_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: homeTitle,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  // No `alternates` here: a canonical set in the root layout would leak onto every page that
  // forgets its own. Each indexable page sets one via pageMetadata().
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: site.locale,
    title: homeTitle,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  formatDetection: { telephone: false, email: false, address: false },
  ...(googleVerification ? { verification: { google: googleVerification } } : {}),
  ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {}),
};

export const viewport: Viewport = {
  themeColor: site.paper,
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${plexSans.variable} antialiased`}
    >
      <body className="flex min-h-dvh flex-col">
        <JsonLd data={[organizationLd(), websiteLd()]} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
        >
          Skip to content
        </a>
        <AiProvider enabled={aiEnabled()}>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </AiProvider>
        {/* Vercel Web Analytics: cookieless, aggregated page views; served from this site's own domain. */}
        <Analytics />
      </body>
    </html>
  );
}
