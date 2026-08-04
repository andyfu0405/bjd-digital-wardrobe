import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "BJD Digital Wardrobe｜数字衣橱",
  description: "为 BJD 玩家设计的轻量数字衣橱，快速记录衣物、娃体、娃头与配件。",
  applicationName: "BJD Wardrobe",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BJD 衣橱",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/app-icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "BJD Digital Wardrobe",
    description: "把喜欢的，好好收藏。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1792, height: 912, alt: "BJD Digital Wardrobe" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BJD Digital Wardrobe",
    description: "把喜欢的，好好收藏。",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
