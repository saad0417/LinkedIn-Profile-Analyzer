import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, IBM_Plex_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AiProvider } from "@/components/ai-context";
import { aiEnabled } from "@/lib/ai-enabled";
import { site } from "@/lib/site";
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


export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `Free ATS Resume Checker: see what the parser sees | ${site.name}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "ATS resume checker",
    "ATS resume scanner",
    "resume parser test",
    "ATS friendly resume",
    "resume keyword match",
    "free resume checker",
    "CV checker",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: site.locale,
    url: "/",
    title: `Free ATS Resume Checker | ${site.name}`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `Free ATS Resume Checker | ${site.name}`,
    description: site.description,
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#faf8f4",
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
      </body>
    </html>
  );
}
