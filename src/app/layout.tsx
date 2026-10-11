import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AiProvider } from "@/components/ai-context";
import { aiEnabled } from "@/lib/ai-enabled";
import { site } from "@/lib/site";
import "./theme.css";

const ancola = localFont({
  src: [
    { path: "./fonts/ancola-regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/ancola-italic.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-ancola",
  display: "swap",
  adjustFontFallback: "Arial",
});

const instrument = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
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
      className={`${ancola.variable} ${instrument.variable} ${plexSans.variable} ${plexMono.variable} antialiased`}
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
