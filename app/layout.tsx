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

export const metadata: Metadata = {
  metadataBase: new URL("https://env-portal-proto-production.up.railway.app"),
  title: "小环境 — RL Environment Registry",
  description: "供应商强化学习环境样本库 · Vendor RL environment sample registry.",
  openGraph: {
    title: "小环境 — RL Environment Registry",
    description: "供应商强化学习环境样本库 · Vendor RL environment sample registry.",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "小环境 RL Environment Registry" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "小环境 — RL Environment Registry",
    description: "供应商强化学习环境样本库 · Vendor RL environment sample registry.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
