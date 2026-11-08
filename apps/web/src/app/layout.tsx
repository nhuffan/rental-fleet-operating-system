import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeSync } from "@/components/theme/theme-toggle";
import { themeInitScript } from "@/lib/theme-init";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "carBase — Nền tảng vận hành cho thuê xe và quản lý đội xe",
  description:
    "Quản lý hợp đồng, bàn giao, GPS, thu chi và giấy tờ đội xe cho doanh nghiệp cho thuê xe. Dữ liệu tách biệt theo từng doanh nghiệp.",
  applicationName: "carBase",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
