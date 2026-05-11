import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import DevRelayPortHint from "../components/DevRelayPortHint";

const fontSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fontMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "30SANJUU",
  description: "30人=1クラス向けリアルタイム集団パズル（WS のみ）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body>
        <DevRelayPortHint />
        {children}
      </body>
    </html>
  );
}
