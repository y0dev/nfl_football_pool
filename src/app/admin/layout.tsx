import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Admin Dashboard",
    template: "%s | Sunday Huddle Admin",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="admin-theme"
      style={{ minHeight: "100vh", background: "oklch(13% 0.025 255)" }}
    >
      {children}
    </div>
  );
}