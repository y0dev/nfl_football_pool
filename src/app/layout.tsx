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

const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sunday Huddle",
    template: "%s | Sunday Huddle",
  },
  description:
    "Run your NFL confidence pool with friends and family. Weekly picks, live standings, and season-long competition made simple.",
  keywords: [
    'NFL', 'football', 'confidence pool', 'sports picks', 'weekly picks',
    'NFL pool', 'football pool', 'sports competition', 'game predictions',
    'sports entertainment', 'fantasy football', 'pick em',
  ],
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
      url: '/brand/main_logo_white.png',
      alt: 'Sunday Huddle',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@sundayhuddle',
    title: 'Sunday Huddle',
    description: 'Picks. People. Compete. — NFL confidence pools made simple.',
    images: ['/brand/main_logo_white.png'],
  },
  other: {
    'classification': 'Sports',
    'category': 'Sports/Football',
    'rating': 'general',
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Sunday Huddle',
              url: siteUrl,
              description: 'Run your NFL confidence pool with friends and family. Weekly picks, live standings, and season-long competition made simple.',
              applicationCategory: 'SportsApplication',
              applicationSubCategory: 'Sports',
              operatingSystem: 'Web',
              genre: 'Sports',
              about: {
                '@type': 'SportsOrganization',
                sport: 'American Football',
                name: 'NFL Confidence Pool',
              },
              audience: {
                '@type': 'Audience',
                audienceType: 'Sports fans',
              },
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
