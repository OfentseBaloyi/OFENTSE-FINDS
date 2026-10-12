import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const sans = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "OFENTSE-FINDS — Discover more. Right around you.", template: "%s · OFENTSE-FINDS" },
  description: "Discover food spots, mechanics, car washes, shops, attractions and hidden gems in South African towns and neighbourhoods — on an interactive map.",
  applicationName: "OFENTSE-FINDS",
  openGraph: {
    type: "website",
    siteName: "OFENTSE-FINDS",
    title: "OFENTSE-FINDS — Discover more. Right around you.",
    description: "The places, people and experiences that make every South African neighbourhood special.",
    images: [{ url: "/brand/ofentse-finds-logo.png", width: 1536, height: 1024, alt: "OFENTSE-FINDS" }],
    locale: "en_ZA",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0d4a47",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${display.variable} ${sans.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only z-[2000] rounded bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
