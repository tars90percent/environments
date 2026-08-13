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
  title: "小环境 — RL Environment Catalog",
  description: "强化学习环境与任务样本目录 · RL environment and task sample catalog.",
  openGraph: {
    title: "小环境 — RL Environment Catalog",
    description: "强化学习环境与任务样本目录 · RL environment and task sample catalog.",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "小环境 RL Environment Catalog" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "小环境 — RL Environment Catalog",
    description: "强化学习环境与任务样本目录 · RL environment and task sample catalog.",
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
