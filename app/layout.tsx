import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://gametoolx.top";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "GameToolX - Multi-language game guide index",
    template: "%s | GameToolX",
  },
  description: "Free multi-language game guide index with AI summaries. Aggregated from multiple public sources. No login required. License-aware attribution to original authors.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "GameToolX",
    url: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
