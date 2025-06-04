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

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Flashcard App",
  description: "A modern flashcard app with an Obsidian-like interface",
  generator: "me - sam",
  icons: {
    icon: "/favicon.ico", // or .png if you used that
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <SettingsProvider>
              <DeckProvider>
                {children}
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
