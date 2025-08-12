import type { Metadata } from "next";
import Script from "next/script";
import Navbar04Page from "@/components/home/navbar";
import AboutUsSection from "@/components/home/about-us";
import { Footer } from "@/components/home/footer";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const canonical = `${siteUrl}/home/about-us`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "About Us | Yasashi Flashcards",
  description:
    "Learn about Yasashi: AI-powered flashcards, spaced repetition, and an elegant notes system that help you learn faster and remember longer.",
  alternates: {
    canonical,
  },
  openGraph: {
    url: canonical,
    type: "website",
    title: "About Us | Yasashi Flashcards",
    description:
      "AI-powered flashcards and spaced repetition to help you learn faster and remember longer.",
    siteName: "Yasashi",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Us | Yasashi Flashcards",
    description:
      "AI-powered flashcards and spaced repetition to help you learn faster and remember longer.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function AboutUsPage() {
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: canonical,
    name: "About Yasashi",
    description:
      "Yasashi builds AI-powered flashcards and spaced-repetition tools to help people learn efficiently.",
    publisher: {
      "@type": "Organization",
      name: "Yasashi",
      url: siteUrl,
    },
  };

  return (
    <>
      <Script id="ld-json-about" type="application/ld+json">
        {JSON.stringify(ldJson)}
      </Script>

      <Navbar04Page />

      <main className="pt-28">
        <AboutUsSection />
      </main>

      <Footer />
    </>
  );
}

