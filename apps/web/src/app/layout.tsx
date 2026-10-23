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
