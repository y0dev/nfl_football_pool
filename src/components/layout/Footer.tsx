import React from "react";

type FooterProps = {
  pageName?: string;
  brand?: string;
};

export function Footer({
  pageName,
  brand = "Sunday Huddle",
}: FooterProps) {
  const year = new Date().getFullYear();
  const title = pageName ? `${brand} · ${pageName}` : brand;

  const bg = "oklch(0.13 0.025 255)";
  const border = "oklch(0.26 0.03 255)";
  const text = "oklch(0.5 0.018 255)";
  const font = "var(--font-barlow)";

  return (
    <footer
      style={{
        background: bg,
        borderTop: `1px solid ${border}`,
        padding: "2rem 0",
      }}
    >
      <div className="lp-inner" style={{ textAlign: "center" }}>
        <p
          style={{
            fontFamily: font,
            fontSize: "0.82rem",
            color: text,
            lineHeight: 1.5,
          }}
        >
          © {year} {title}. All rights reserved.
        </p>

        <p
          style={{
            fontFamily: font,
            fontSize: "0.72rem",
            color: text,
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
    </footer>
  );
}