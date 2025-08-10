import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { DeckProvider } from "@/context/deck-context";
import { SettingsProvider } from "@/context/settings-context";
import { AuthProvider } from "@/context/auth-context";
import { Toaster } from "@/components/ui/toaster";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import ActionSearchBar from "@/components/action-search-bar";
import MobilePaletteButton from "@/components/mobile-palette-button";
import PwaInit from "@/components/pwa-init";
import EnvBannerClient from "@/components/env-banner-client";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Flashcard App",
  description: "A modern flashcard app with an Obsidian-like interface",
  generator: "me - sam",
  icons: [
    { url: "/IMG_2251.png", sizes: "192x192", type: "image/png" },
    { url: "/favicon.png", sizes: "512x512", type: "image/png" },
    { url: "/IMG_2253.png", sizes: "180x180", type: "image/png", rel: "apple-touch-icon" },
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Flashcard App",
  },
  verification: {
    google: "EivDjNReXp8-Wx5s5TaGj34rbcFZYCKx4SdSEHJHvHE",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className={inter.className}>
        {/* PWA init (service worker) */}
        <PwaInit />
        <EnvBannerClient/>
        {/* Dev environment banner */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <SettingsProvider>
              <DeckProvider>
                {/* Mobile-only palette trigger */}
                <MobilePaletteButton />
                {children}
                {/* Global Action Search - opens with Ctrl+K */}
                <ActionSearchBar />
                <Toaster />
              </DeckProvider>
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
      <SpeedInsights />
      <Analytics />
    </html>
  );
}