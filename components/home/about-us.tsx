import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Brain, Lightbulb, Rocket, Users } from "lucide-react";

const stats = [
  { label: "Active learners", value: "10k+" },
  { label: "Decks created", value: "75k+" },
  { label: "Retention boost", value: "2.3x" },
  { label: "Countries", value: "120+" },
];

function Feature({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex w-14 aspect-square items-center justify-center rounded-2xl bg-black text-white dark:bg-white dark:text-black">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-base font-semibold leading-6">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function AboutUsSection() {
  return (
    <section id="about" className="relative py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 flex w-16 aspect-square items-center justify-center rounded-2xl bg-black text-white dark:bg-white dark:text-black">
            <Brain className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About Yasashi</h1>
          <p className="mt-3 text-muted-foreground">
            We build AI-powered flashcards and spaced-repetition tools that help you learn faster and remember longer —
            with beautiful UX and privacy by default.
          </p>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-5 text-center shadow-sm">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Mission */}
        <div className="mx-auto mt-14 max-w-3xl text-center">
          <h2 className="text-xl font-semibold">Our mission</h2>
          <p className="mt-2 text-muted-foreground">
            Make self‑learning effortless. Yasashi combines spaced repetition, generative AI, and a powerful notes system so you
            can transform any material into bite‑sized, memorable knowledge.
          </p>
        </div>

        <Separator className="my-14" />

        {/* Features */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <Feature
            icon={Lightbulb}
            title="AI that accelerates you"
            description="Generate high‑quality flashcards from notes, links, or PDFs. Get hints, examples, and explanations when you need them."
          />
          <Feature
            icon={Rocket}
            title="Master with spaced repetition"
            description="Prioritized daily reviews, smart scheduling, and progress insights — designed to maximize retention."
          />
          <Feature
            icon={Users}
            title="Built for real learners"
            description="From students to professionals, Yasashi adapts to your workflow with clean design and zero clutter."
          />
        </div>

        {/* CTA */}
        <div className="mt-14 flex flex-col items-center gap-3">
          <Button asChild className="rounded-full px-6 py-5 text-sm">
            <a href="/signup">Start learning free</a>
          </Button>
          <p className="text-xs text-muted-foreground">No credit card required</p>
        </div>
      </div>
    </section>
  );
}

