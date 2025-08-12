import type { Metadata } from "next";
import Script from "next/script";
import Navbar04Page from "@/components/home/navbar";
import { Footer } from "@/components/home/footer";
import { Separator } from "@/components/ui/separator";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const canonical = `${siteUrl}/home/careers`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Careers | Yasashi",
  description: "Join Yasashi to build AI-powered learning tools that help people master anything.",
  alternates: { canonical },
  openGraph: {
    url: canonical,
    type: "website",
    title: "Careers | Yasashi",
    description: "Open roles, culture, and how we hire at Yasashi.",
    siteName: "Yasashi",
  },
  twitter: {
    card: "summary_large_image",
    title: "Careers | Yasashi",
    description: "Open roles, culture, and how we hire at Yasashi.",
  },
  robots: { index: true, follow: true },
};

export default function CareersPage() {
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: canonical,
    name: "Careers at Yasashi",
    description: "Open roles and hiring information for Yasashi.",
    publisher: {
      "@type": "Organization",
      name: "Yasashi",
      url: siteUrl,
    },
  };

  return (
    <>
      <Script id="ld-json-careers" type="application/ld+json">
        {JSON.stringify(ldJson)}
      </Script>

      <Navbar04Page />

      <main className="pt-28">
        <section className="py-16">
          <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            {/* Hero */}
            <header className="mb-8 text-center">
              <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
                Careers
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Careers at Yasashi</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Help us build the future of learning with AI, spaced repetition, and great UX.
              </p>
            </header>

            {/* TOC */}
            <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
              {[
                { id: "open-roles", label: "Open Roles" },
                { id: "culture", label: "Culture" },
                { id: "benefits", label: "Benefits" },
                { id: "how-to-apply", label: "How to Apply" },
                { id: "hiring-process", label: "Hiring Process" },
                { id: "faqs", label: "FAQs" },
                { id: "contact", label: "Contact" },
              ].map((item) => (
                <a key={item.id} href={`#${item.id}`} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
                  {item.label}
                </a>
              ))}
            </div>

            <Separator className="my-8" />

            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <h2 id="open-roles"><strong>Open Roles</strong></h2>
              <p>We are always excited to meet exceptional people. Example roles we hire for:</p>
              <ul>
                <li>Senior Full-Stack Engineer (Next.js, Supabase, shadcn/ui)</li>
                <li>Product Designer (UI/UX, systems thinking)</li>
                <li>ML/AI Engineer (LLMs, embeddings, retrieval)</li>
                <li>Developer Relations (content, tutorials, community)</li>
              </ul>
              <p>
                Don’t see the right role? Reach out anyway — we often craft roles around great people.
              </p>

              <h2 id="culture"><strong>Culture</strong></h2>
              <ul>
                <li>User-obsessed: we build for learners first.</li>
                <li>Craft and speed: high quality with fast iteration.</li>
                <li>Autonomy: own outcomes, not tasks.</li>
                <li>Remote-friendly: async-first communication.</li>
              </ul>

              <h2 id="benefits"><strong>Benefits</strong></h2>
              <ul>
                <li>Competitive compensation</li>
                <li>Flexible hours and remote work</li>
                <li>Equipment stipend</li>
                <li>Generous learning budget</li>
              </ul>

              <h2 id="how-to-apply"><strong>How to Apply</strong></h2>
              <p>
                Email your resume/portfolio and a short note about why you want to work on learning to
                <a href="mailto:samthelegend68@gmail.com"> samthelegend68@gmail.com</a>.
              </p>

              <h2 id="hiring-process"><strong>Hiring Process</strong></h2>
              <ol>
                <li>Intro call</li>
                <li>Portfolio/Code review</li>
                <li>Practical exercise (paid)</li>
                <li>Team chat</li>
              </ol>

              <h2 id="faqs"><strong>FAQs</strong></h2>
              <p>
                We encourage candidates from all backgrounds to apply. If you’re passionate about building great learning tools,
                we’d love to hear from you.
              </p>

              <h2 id="contact"><strong>Contact</strong></h2>
              <p>
                Questions about careers at Yasashi? Email <a href="mailto:samthelegend68@gmail.com">samthelegend68@gmail.com</a>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
