import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mono.css";
import "./motion.css";
import "./mobile.css";
import "./radar.css";
import { MotionExperience } from "@/components/motion-experience";
import { MOTION_BOOTSTRAP } from "@/lib/motion-preference";

export const metadata: Metadata = {
  title: "市场雷达 · Market Radar",
  description: "关注加密货币、美股、A 股与港股，查看走势并设置目标价提醒。",
  icons: {
    icon: { url: "/favicon-v2.png", type: "image/png", sizes: "48x48" },
    shortcut: "/favicon-v2.png",
    apple: { url: "/apple-touch-icon-v2.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  // Vinext 0.0.50 omits viewportFit. Suppress its default tag and render one explicit tag below.
  width: undefined,
  initialScale: undefined,
  themeColor: "#080808",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
        <script dangerouslySetInnerHTML={{__html:MOTION_BOOTSTRAP}}/>
      </head>
      <body className="antialiased"><MotionExperience/>{children}</body>
    </html>
  );
}
