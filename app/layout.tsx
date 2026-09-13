import type { Metadata } from "next";
import "./globals.css";
import "./mono.css";
import "./motion.css";
import { MotionExperience } from "@/components/motion-experience";

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
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:`try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!sessionStorage.getItem('radar-brand-seen')&&!location.hash){document.documentElement.dataset.intro='play';sessionStorage.setItem('radar-brand-seen','1');setTimeout(function(){delete document.documentElement.dataset.intro},2200)}}catch(e){}`}}/></head>
      <body className="antialiased"><MotionExperience/>{children}</body>
    </html>
  );
}
