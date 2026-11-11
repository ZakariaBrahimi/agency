import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Instrument_Sans, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({ variable: "--font-plex", subsets: ["arabic"], weight: ["400", "500", "700"], display: "swap" });
const inst = Instrument_Sans({ variable: "--font-inst", subsets: ["latin"], display: "swap" });
const brico = Bricolage_Grotesque({ variable: "--font-brico", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "نواة",
  robots: { index: false, follow: false },
  icons: { icon: "/assets/img/favicon.svg" },
};
export const viewport: Viewport = { themeColor: "#0B1220", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${plex.variable} ${inst.variable} ${brico.variable} min-h-dvh bg-background font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
