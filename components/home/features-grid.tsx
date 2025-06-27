import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Brain,
  FileText,
  BarChart3,
  Upload,
  MessageSquare,
  Target,
  Repeat,
  GraduationCap,
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Smart Deck Management",
    description:
      "Create, organize, and tag your flashcard decks with an intuitive interface.",
    badge: "Core",
  },
  {
    icon: Brain,
    title: "AI Flashcard Generation",
    description:
      "Generate flashcards automatically from any text using advanced AI technology.",
    badge: "AI",
  },
  {
    icon: Repeat,
    title: "Spaced Repetition",
    description:
      "Optimize your learning with scientifically-proven spaced repetition algorithms.",
    badge: "Smart",
  },
  {
    icon: Target,
    title: "Multiple Study Modes",
    description:
      "Regular study, exam mode, and specialized language learning modes.",
    badge: "Modes",
  },
  {
    icon: MessageSquare,
    title: "AI Study Assistant",
    description:
      "Get personalized help and explanations from your AI-powered study companion.",
    badge: "AI",
  },
  {
    icon: GraduationCap,
    title: "AI-Powered Grading",
    description:
      "Receive intelligent feedback and grading on your answers and progress.",
    badge: "AI",
  },
  {
    icon: FileText,
    title: "Rich Notes System",
    description:
      "Take advanced notes with Markdown, math equations, diagrams, and interactive elements.",
    badge: "Notes",
  },
  {
    icon: Upload,
    title: "Import & Export",
    description:
      "Easily import flashcards from Markdown files and export your progress.",
    badge: "Sync",
  },
  {
    icon: BarChart3,
    title: "Progress Tracking",
    description:
      "Monitor your learning journey with detailed analytics and insights.",
    badge: "Analytics",
  },
];

export function FeaturesGrid() {
  return (
    <section className="py-20 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything you need to learn effectively
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Powerful features designed to accelerate your learning and help you
            retain knowledge longer.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="relative overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow hover:border-black"
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <Badge variant="outline" className="text-xs border-gray-300">
                    {feature.badge}
                  </Badge>
                </div>
                <CardTitle className="text-xl text-black">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed text-gray-600">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
