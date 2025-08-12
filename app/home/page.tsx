import type { Metadata } from "next";
import { Homepage } from "@/components/home/homepage";

export const metadata: Metadata = {
  title: "AI Flashcards | Learn Faster with Spaced Repetition",
  description:
    "Master any subject with AI-generated flashcards, spaced repetition, and modern study modes. Create decks, review efficiently, and track your progress.",
  alternates: {
    canonical: "/home",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "AI Flashcards | Learn Faster with Spaced Repetition",
    description:
      "Master any subject with AI-generated flashcards, spaced repetition, and modern study modes.",
    url: "/home",
    siteName: "Flashcard App",
    type: "website",
    images: [
      {
        url: "/IMG_2251.png",
        width: 1200,
        height: 630,
        alt: "Flashcard App - AI-powered learning",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Flashcards | Learn Faster with Spaced Repetition",
    description:
      "Master any subject with AI-generated flashcards, spaced repetition, and modern study modes.",
    images: ["/IMG_2251.png"],
  },
};

export default function Page() {
  return (
    <>
      {/* JSON-LD: WebSite + SearchAction (helps search engines understand site) */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Flashcard App",
            url: "/home",
            potentialAction: {
              "@type": "SearchAction",
              target: "/search?q={query}",
              "query-input": "required name=query",
            },
          }),
        }}
      />
      <Homepage />
    </>
  );
}
