import type { Metadata } from "next";
import Script from "next/script";
import Navbar04Page from "@/components/home/navbar";
import { Footer } from "@/components/home/footer";
import { Separator } from "@/components/ui/separator";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const canonical = `${siteUrl}/home/privacy-policy`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Privacy Policy | Yasashi",
  description:
    "Read the Yasashi Privacy Policy to understand how we collect, use, and protect your data.",
  alternates: { canonical },
  openGraph: {
    url: canonical,
    type: "article",
    title: "Privacy Policy | Yasashi",
    description: "How Yasashi collects, uses, and protects your data.",
    siteName: "Yasashi",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | Yasashi",
    description: "How Yasashi collects, uses, and protects your data.",
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: canonical,
    name: "Privacy Policy",
    description:
      "Read the Yasashi Privacy Policy to understand how we collect, use, and protect your data.",
    about: {
      "@type": "Organization",
      name: "Yasashi",
      url: siteUrl,
    },
  };

  return (
    <>
      <Script id="ld-json-privacy" type="application/ld+json">
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
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
              <p className="mt-2 text-sm text-muted-foreground">Effective date: {new Date().toLocaleDateString()}</p>
            </header>

            {/* TOC */}
            <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
              {[
                { id: "introduction", label: "Introduction" },
                { id: "data-we-collect", label: "Data We Collect" },
                { id: "how-we-use-data", label: "How We Use Data" },
                { id: "data-sharing", label: "Data Sharing" },
                { id: "data-retention", label: "Data Retention" },
                { id: "security", label: "Security" },
                { id: "your-rights", label: "Your Rights" },
                { id: "children", label: "Children" },
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
              <h2 id="introduction"><strong>1. Introduction</strong></h2>
              <p>
                Your privacy matters. This policy explains what data we collect, how we use it, and the
                choices you have. We design Yasashi with privacy by default and minimal data collection.
              </p>

              <h2 id="data-we-collect"><strong>2. Data We Collect</strong></h2>
              <ul>
                <li>Account data (e.g., email) to authenticate you.</li>
                <li>Content you create (decks, notes, flashcards) to provide the service.</li>
                <li>Usage data (limited analytics) to improve performance and reliability.</li>
              </ul>

              <h2 id="how-we-use-data"><strong>3. How We Use Data</strong></h2>
              <ul>
                <li>Operate and improve Yasashi features like spaced repetition and AI assistance.</li>
                <li>Secure your account and prevent abuse.</li>
                <li>Communicate important updates about the service.</li>
              </ul>

              <h2 id="data-sharing"><strong>4. Data Sharing</strong></h2>
              <p>
                We do not sell your data. We may share minimal data with trusted processors to run the
                service (e.g., hosting, databases) under strict agreements.
              </p>

              <h2 id="data-retention"><strong>5. Data Retention</strong></h2>
              <p>
                We retain data only as long as necessary to provide Yasashi. You may request deletion of
                your account and content at any time.
              </p>

              <h2 id="security"><strong>6. Security</strong></h2>
              <p>
                We use industry-standard security practices. No system is perfect; we continually improve
                protections for your data.
              </p>

              <h2 id="your-rights"><strong>7. Your Rights</strong></h2>
              <ul>
                <li>Access, update, export, or delete your data.</li>
                <li>Object to or restrict certain processing.</li>
                <li>Contact us for help: <a href="mailto:samthelegend68@gmail.com">samthelegend68@gmail.com</a>.</li>
              </ul>

              <h2 id="children"><strong>8. Children</strong></h2>
              <p>
                Yasashi is not directed to children under the age where parental consent is required by applicable law.
              </p>

              <h2 id="changes"><strong>9. Changes</strong></h2>
              <p>
                We may update this policy. Material changes will be communicated appropriately. Continued use of Yasashi
                after changes means you accept the updated policy.
              </p>

              <h2 id="contact"><strong>10. Contact</strong></h2>
              <p>
                Questions about privacy? Email us at <a href="mailto:samthelegend68@gmail.com">samthelegend68@gmail.com</a>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
