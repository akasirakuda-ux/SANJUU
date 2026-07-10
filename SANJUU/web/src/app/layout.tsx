import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import DevRelayPortHint from "../components/DevRelayPortHint";
import RakudaTopRightCluster from "../components/RakudaTopRightCluster";
import TabletPhoneCanvasSync from "../components/TabletPhoneCanvasSync";
import { TABLET_PHONE_CANVAS_BOOT_SCRIPT } from "../lib/tabletPhoneCanvas";

const fontSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fontMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ひと言探し",
  description: "30人=1クラス向けリアルタイム集団パズル（WS のみ）",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body>
        <Script id="rakuda-phone-canvas-boot" strategy="beforeInteractive">
          {TABLET_PHONE_CANVAS_BOOT_SCRIPT}
        </Script>
        <TabletPhoneCanvasSync />
        <DevRelayPortHint />
        <div className="rk-sanjuu-login-status-host">
          <RakudaTopRightCluster />
        </div>
        {children}
      </body>
    </html>
  );
}
