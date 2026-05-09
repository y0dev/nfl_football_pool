import type { Metadata } from "next";
import { Inter, Barlow, Barlow_Condensed } from "next/font/google";
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

export const metadata: Metadata = {
  title: "NFL Confidence Pool",
  description: "Join the ultimate NFL confidence pool experience",
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
