import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Rental Fleet Operating System",
  description: "Nền tảng vận hành doanh nghiệp và đội xe cho thuê",
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
