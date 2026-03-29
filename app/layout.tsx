import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { DebateProvider } from "@/lib/debate-store";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import PasswordGate from "@/components/PasswordGate";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Polymath X",
  description:
    "Xpand your perspective — Claude, GPT-4o, and Gemini debate any topic, moderated by DeepSeek.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Polymath X",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#EF9F27",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} font-sans antialiased bg-[#0A0A0A] text-white`}>
        <PasswordGate>
          <ConvexClientProvider>
            <DebateProvider>
              {children}
            </DebateProvider>
          </ConvexClientProvider>
        </PasswordGate>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
