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
  title: "Environment Resource Management",
  description: "强化学习环境与任务样本目录 · RL environment and task sample catalog.",
  openGraph: {
    title: "Environment Resource Management",
    description: "强化学习环境与任务样本目录 · RL environment and task sample catalog.",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "Environment Resource Management" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Environment Resource Management",
    description: "强化学习环境与任务样本目录 · RL environment and task sample catalog.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/soundwave-icon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/soundwave-icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/soundwave-icon.svg",
    apple: "/apple-touch-icon.png",
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
