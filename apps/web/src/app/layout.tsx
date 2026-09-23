import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Rental Fleet Operating System",
  description: "Rental Fleet development foundation",
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
