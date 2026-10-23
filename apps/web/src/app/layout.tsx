import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Rental Fleet OS",
  description:
    "Manage vehicles, rentals, customers, and GPS tracking from one connected workspace.",
  applicationName: "Rental Fleet OS",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
