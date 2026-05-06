import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ViewTransitions } from "next-view-transitions";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "@/context/auth-context";
import { SettingsProvider } from "@/context/settings-context";
import { DeckProvider } from "@/context/deck-context";
import { FolderProvider } from "@/context/folder-context";
import MobilePaletteButton from "@/components/mobile-palette-button";
import { DecksActionSearchBar } from "@/components/action-search-bar/decks/action-search-bar";
import PwaInit from "@/components/pwa-init";
import EnvBannerClient from "@/components/env-banner-client";
import OnlineIndicator from "@/components/online-indicator";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    template: "%s | Flashcard App",
    default: "Flashcard App",
  },
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

import { CookieBannerWrapper } from "@/components/cookie-banner-wrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" />
        {/* Explicit PWA/iOS tags to aid iOS A2HS */}
        <meta name="application-name" content="Flashcard App" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Flashcard App" />
        <link rel="apple-touch-icon" sizes="180x180" href="/IMG_2253.png" />
      </head>
      <body className={inter.className}>
        {/* PWA init (service worker) */}
        <EnvBannerClient />
        {/* Dev environment banner */}

        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >

          <ViewTransitions>
            <AuthProvider>
              <SettingsProvider>
                <DeckProvider>

                  <FolderProvider>
                    {/* Mobile-only palette trigger */}
                    <MobilePaletteButton />
                    {children}
                    {/* Global Action Search - opens with Ctrl+K */}
                    <DecksActionSearchBar />
                    <Toaster />
                    <SpeedInsights />
                    <Analytics />
                    <PwaInit />
                  </FolderProvider>
                </DeckProvider>
              </SettingsProvider>
            </AuthProvider>
          </ViewTransitions>
        </ThemeProvider>
      </body>
      <Analytics />
    </html>
  );
}