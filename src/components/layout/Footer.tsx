import React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { isPricingVisible } from "@/lib/billing";

type FooterProps = {
  pageName?: string;
  brand?: string;
};

const bg     = "oklch(0.13 0.025 255)";
const border = "oklch(0.26 0.03 255)";
const text   = "oklch(0.95 0.006 255)";
const textMid = "oklch(0.72 0.015 255)";
const textDim = "oklch(0.5 0.018 255)";
const font   = "var(--font-barlow)";
const fontHeading = "var(--font-barlow-condensed)";

const headingStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontWeight: 700,
  fontSize: "0.68rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: textDim,
  marginBottom: "0.85rem",
};

const linkStyle: React.CSSProperties = {
  fontFamily: font,
  fontSize: "0.82rem",
  color: textMid,
  textDecoration: "none",
};

export function Footer({
  pageName,
  brand = "Sunday Huddle",
}: FooterProps) {
  const year = new Date().getFullYear();
  const title = pageName ? `${brand} · ${pageName}` : brand;

  const pageLinks = [
    { label: "Home", href: "/" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "FAQ", href: "/faq" },
    ...(isPricingVisible() ? [{ label: "Pricing", href: "/pricing" }] : []),
  ];

  return (
    <footer
      style={{
        background: bg,
        borderTop: `1px solid ${border}`,
        padding: "2.5rem 0 2rem",
      }}
    >
      <div className="footer-inner">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "2rem", paddingBottom: "1.75rem" }}>
          {/* Company info */}
          <div style={{ flex: "1 1 260px", minWidth: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
              <BrandLogo variant="icon" size={24} />
              <span
                style={{
                  fontFamily: fontHeading,
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  letterSpacing: "0.06em",
                  color: text,
                  textTransform: "uppercase",
                }}
              >
                {brand}
              </span>
            </div>
            <p style={{ fontFamily: font, fontSize: "0.8rem", color: textDim, lineHeight: 1.6 }}>
              Run your NFL confidence pool with friends and family — weekly picks, live standings, and season-long competition.
            </p>
          </div>

          {/* Explore + Follow grouped together — side by side on larger screens
              (see .footer-links-group in globals.css), stacked on mobile. */}
          <div className="footer-links-group">
            {/* Page links */}
            <div style={{ minWidth: 160 }}>
              <p style={headingStyle}>Explore</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                {pageLinks.map(({ label, href }) => (
                  <Link key={href} href={href} style={linkStyle}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Socials — none yet, reserved for future use */}
            <div style={{ minWidth: 160 }}>
              <p style={headingStyle}>Follow</p>
              <p style={{ fontFamily: font, fontSize: "0.82rem", color: textDim }}>Coming soon</p>
            </div>
          </div>
        </div>

        <div
          id="footer-bottom"
          style={{ borderTop: `1px solid ${border}`, paddingTop: "1.5rem", textAlign: "center" }}>
          <p
            style={{
              fontFamily: font,
              fontSize: "0.82rem",
              color: textDim,
              lineHeight: 1.5,
            }}
          >
            © {year} {title}. All rights reserved.
          </p>

          <p
            id="footer-disclaimer"
            style={{
              fontFamily: font,
              fontSize: "0.72rem",
              color: textDim,
              marginTop: "0.5rem",
              lineHeight: 1.6,
            }}
          >
            For entertainment purposes only. {brand} is not affiliated with or
            endorsed by the NFL or any professional or collegiate sports team,
            league, or association. All team names, logos, and trademarks are the
            property of their respective owners.
          </p>
        </div>
      </div>
    </footer>
  );
}
