import type { Metadata } from "next";
import Script from "next/script";
import Navbar04Page from "@/components/home/navbar";
import { Footer } from "@/components/home/footer";
import { Separator } from "@/components/ui/separator";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const canonical = `${siteUrl}/home/terms-of-service`;
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Terms of Service | Yasashi",
  description:
    "Read the Yasashi Terms of Service to understand the rules and conditions for using our product.",
  alternates: { canonical },
  openGraph: {
    url: canonical,
    type: "article",
    title: "Terms of Service | Yasashi",
    description: "Rules and conditions for using Yasashi.",
    siteName: "Yasashi",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service | Yasashi",
    description: "Rules and conditions for using Yasashi.",
  },
  robots: { index: true, follow: true },
};

export default function TermsOfServicePage() {
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: canonical,
    name: "Terms of Service",
    description:
      "Read the Yasashi Terms of Service to understand the rules and conditions for using our product.",
    about: {
      "@type": "Organization",
      name: "Yasashi",
      url: siteUrl,
    },
  };

  return (
    <>
      <Script id="ld-json-terms" type="application/ld+json">
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
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
              <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
            </header>

            {/* TOC */}
            <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
              {[
                { id: "agreement", label: "Agreement" },
                { id: "use", label: "Use of Service" },
                { id: "ip", label: "Intellectual Property" },
                { id: "billing", label: "Subscriptions & Payments" },
                { id: "termination", label: "Termination" },
                { id: "disclaimers", label: "Disclaimers" },
                { id: "liability", label: "Liability" },
                { id: "changes", label: "Changes" },
                { id: "contact", label: "Contact" },
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
              <h2 id="agreement"><strong>1. Agreement to Terms</strong></h2>
              <p>
                By accessing or using Yasashi, you agree to be bound by these Terms of Service and our Privacy Policy.
                If you do not agree, do not use the service.
              </p>

              <h2 id="use"><strong>2. Use of Service</strong></h2>
              <ul>
                <li>You must provide accurate account information and keep your credentials secure.</li>
                <li>Do not misuse the service (e.g., abuse APIs, attempt to disrupt, or infringe rights).</li>
                <li>You are responsible for content you create and upload.</li>
              </ul>

              <h2 id="ip"><strong>3. Intellectual Property</strong></h2>
              <p>
                Yasashi, including software and branding, is owned by us or our licensors. You retain rights to your
                content. You grant us a limited license to operate the service and display your content as intended.
              </p>

              <h2 id="billing"><strong>4. Subscriptions and Payments</strong></h2>
              <p>
                If paid plans are offered, you agree to applicable pricing, billing cycles, and renewal terms. Taxes may apply.
              </p>

              <h2 id="termination"><strong>5. Termination</strong></h2>
              <p>
                We may suspend or terminate accounts that violate these Terms. You may stop using Yasashi at any time and
                request data export or deletion as permitted.
              </p>

              <h2 id="disclaimers"><strong>6. Disclaimers</strong></h2>
              <p>
                The service is provided "as is" without warranties. We do not guarantee uninterrupted or error-free
                operation.
              </p>

              <h2 id="liability"><strong>7. Limitation of Liability</strong></h2>
              <p>
                To the fullest extent permitted by law, we are not liable for indirect, incidental, or consequential damages.
              </p>

              <h2 id="changes"><strong>8. Changes to Terms</strong></h2>
              <p>
                We may update these Terms. Material changes will be communicated appropriately. Continued use signifies acceptance.
              </p>

              <h2 id="contact"><strong>9. Contact</strong></h2>
              <p>
                Questions about these Terms? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
