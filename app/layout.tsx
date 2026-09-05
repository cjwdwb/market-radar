import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "市场雷达 · Market Radar",
  description: "关注加密货币、美股、A 股与港股，查看走势并设置目标价提醒。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
