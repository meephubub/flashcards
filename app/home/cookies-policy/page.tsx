import type { Metadata } from "next";
import Script from "next/script";
import Navbar04Page from "@/components/home/navbar";
import { Footer } from "@/components/home/footer";
import { Separator } from "@/components/ui/separator";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const canonical = `${siteUrl}/home/cookies-policy`;
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Cookies Policy | Yasashi",
  description:
    "Read the Yasashi Cookies Policy to understand how we use cookies to improve your experience.",
  alternates: { canonical },
  openGraph: {
    url: canonical,
    type: "article",
    title: "Cookies Policy | Yasashi",
    description: "How Yasashi uses cookies and similar technologies.",
    siteName: "Yasashi",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cookies Policy | Yasashi",
    description: "How Yasashi uses cookies and similar technologies.",
  },
  robots: { index: true, follow: true },
};

export default function CookiesPolicyPage() {
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: canonical,
    name: "Cookies Policy",
    description:
      "Read the Yasashi Cookies Policy to understand how we use cookies to improve your experience.",
    about: {
      "@type": "Organization",
      name: "Yasashi",
      url: siteUrl,
    },
  };

  return (
    <>
      <Script id="ld-json-cookies" type="application/ld+json">
        {JSON.stringify(ldJson)}
      </Script>

      <Navbar04Page />

      <main className="pt-28">
        <section className="py-16">
          <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            {/* Hero */}
            <header className="mb-8 text-center">
              <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
                Legal
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Cookies Policy</h1>
              <p className="mt-2 text-sm text-muted-foreground">Effective date: {new Date().toLocaleDateString()}</p>
            </header>

            <Separator className="my-8" />

            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <h2><strong>1. What are cookies?</strong></h2>
              <p>
                Cookies are small text files stored on your device when you visit a website. They help us
                recognize you, remember your preferences, and provide a more personalized experience.
              </p>

              <h2><strong>2. How we use cookies</strong></h2>
              <p>We use cookies for the following purposes:</p>
              <ul>
                <li><strong>Essential cookies:</strong> Necessary for the website to function correctly (e.g., authentication, session management).</li>
                <li><strong>Preference cookies:</strong> Remember your settings (e.g., theme, language).</li>
                <li><strong>Analytics cookies:</strong> Help us understand how you use the app to improve features.</li>
              </ul>

              <h2><strong>3. Managing your preferences</strong></h2>
              <p>
                You can control and manage cookies through your browser settings. Most browsers allow you
                to refuse or delete cookies. Note that disabling essential cookies may impact your ability
                to use certain features of Yasashi.
              </p>

              <h2><strong>4. Third-party cookies</strong></h2>
              <p>
                Some cookies may be placed by third-party services we use for analytics (e.g., Vercel Analytics)
                or authentication. These third parties have their own privacy and cookies policies.
              </p>

              <h2><strong>5. Contact us</strong></h2>
              <p>
                If you have any questions about our use of cookies, please contact us at{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
