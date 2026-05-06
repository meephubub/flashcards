import type { Metadata } from "next";
import Script from "next/script";
import Navbar04Page from "@/components/home/navbar";
import { Footer } from "@/components/home/footer";
import { Separator } from "@/components/ui/separator";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const canonical = `${siteUrl}/home/contact`;
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Contact | Yasashi",
  description: "Get in touch with the Yasashi team for support, feedback, or business inquiries.",
  alternates: { canonical },
  openGraph: {
    url: canonical,
    type: "website",
    title: "Contact | Yasashi",
    description: "Support, feedback, and business contact for Yasashi.",
    siteName: "Yasashi",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact | Yasashi",
    description: "Support, feedback, and business contact for Yasashi.",
  },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: canonical,
    name: "Contact Yasashi",
    description: "How to reach the Yasashi team for support and inquiries.",
    publisher: {
      "@type": "Organization",
      name: "Yasashi",
      url: siteUrl,
    },
  };

  return (
    <>
      <Script id="ld-json-contact" type="application/ld+json">
        {JSON.stringify(ldJson)}
      </Script>

      <Navbar04Page />

      <main className="pt-28">
        <section className="py-16">
          <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            {/* Hero */}
            <header className="mb-8 text-center">
              <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
                Contact
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contact Us</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We read every message. Choose the best channel below.
              </p>
            </header>

            {/* TOC */}
            <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
              {[
                { id: "support", label: "Support" },
                { id: "feedback", label: "Feedback" },
                { id: "bugs", label: "Bug Reports" },
                { id: "business", label: "Business" },
                { id: "press", label: "Press" },
                { id: "other", label: "Other" },
              ].map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <Separator className="my-8" />

            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <h2 id="support"><strong>Support</strong></h2>
              <p>
                Account or product issues? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we'll help.
              </p>

              <h2 id="feedback"><strong>Feedback</strong></h2>
              <p>
                Tell us what would make Yasashi better. Feature requests and UX notes welcome.
                Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>

              <h2 id="bugs"><strong>Bug Reports</strong></h2>
              <p>
                Found a bug? Please include steps to reproduce, screenshots or console output if possible.
                Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>

              <h2 id="business"><strong>Business</strong></h2>
              <p>
                Partnerships, education, or enterprise? Reach out at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>

              <h2 id="press"><strong>Press</strong></h2>
              <p>
                Media inquiries: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>

              <h2 id="other"><strong>Other</strong></h2>
              <p>
                Anything else? Contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
