import type { Metadata } from "next";
import { Inter, Barlow, Barlow_Condensed } from "next/font/google";
// @ts-ignore
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
});
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-barlow-condensed",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sunday Huddle",
    template: "%s | Sunday Huddle",
  },
  description:
    "Run your NFL confidence pool with friends and family. Weekly picks, live standings, and season-long competition made simple.",
  icons: {
    icon: '/brand/sh-icon.png',
    apple: '/brand/sh-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Sunday Huddle',
    title: 'Sunday Huddle',
    description: 'Picks. People. Compete. — NFL confidence pools made simple.',
    url: siteUrl,
    locale: 'en_US',
    images: [{
      url: '/brand/initials.png',
      alt: 'Sunday Huddle',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@sundayhuddle',
    title: 'Sunday Huddle',
    description: 'Picks. People. Compete. — NFL confidence pools made simple.',
    images: ['/brand/initials.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} ${barlow.variable} ${barlowCondensed.variable}`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
