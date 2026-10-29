import type { Metadata, Viewport } from "next";
import { Noto_Serif, Noto_Serif_TC } from "next/font/google";
import "./globals.css";

// 內文用 Noto Serif TC；數字用 Noto Serif（等寬數字，右對齊的金額才不會參差）
const serifTC = Noto_Serif_TC({ weight: ["400", "700"], variable: "--font-noto-serif-tc", display: "swap", preload: false });
const serifDigits = Noto_Serif({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-noto-serif", display: "swap" });

export const metadata: Metadata = {
  title: "家計簿",
  description: "每天記帳，看見趨勢、預算與帳是否對得上。",
};

export const viewport: Viewport = { themeColor: "#f7f7f3" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className={`${serifTC.variable} ${serifDigits.variable}`}>
      <body>{children}</body>
    </html>
  );
}
