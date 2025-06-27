import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Target, Languages, ArrowRight } from "lucide-react";

const studyModes = [
  {
    icon: BookOpen,
    title: "Regular Study Mode",
    description:
      "Master your flashcards with spaced repetition algorithms that adapt to your learning pace.",
    features: [
      "Spaced repetition",
      "Progress tracking",
      "Difficulty adjustment",
      "Review scheduling",
    ],
    color: "from-black to-gray-800",
    badge: "Popular",
  },
  {
    icon: Target,
    title: "Exam Mode",
    description:
      "Test your knowledge under pressure with timed sessions and comprehensive scoring.",
    features: [
      "Timed sessions",
      "Comprehensive scoring",
      "Performance analytics",
      "Weak area identification",
    ],
    color: "from-gray-800 to-gray-600",
    badge: "Intensive",
  },
  {
    icon: Languages,
    title: "Language Study Mode",
    description:
      "Specialized tools for language learning with pronunciation, grammar, and vocabulary focus.",
    features: [
      "Pronunciation practice",
      "Grammar exercises",
      "Vocabulary building",
      "Cultural context",
    ],
    color: "from-gray-600 to-gray-400",
    badge: "Specialized",
  },
];

export function StudyModes() {
  return (
    <section className="bg-gray-50 py-20 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Study modes for every learning style
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Choose the perfect study mode that matches your learning goals and
            preferences.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-3">
          {studyModes.map((mode, index) => (
            <Card
              key={index}
              className="relative overflow-hidden border border-gray-200 bg-white shadow-lg hover:shadow-xl transition-shadow"
            >
              <div
                className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${mode.color}`}
              />

              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${mode.color}`}
                  >
                    <mode.icon className="h-6 w-6 text-white" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {mode.badge}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{mode.title}</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  {mode.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {mode.features.map((feature, featureIndex) => (
                    <li
                      key={featureIndex}
                      className="flex items-center text-sm text-gray-600"
                    >
                      <div className="mr-2 h-1.5 w-1.5 rounded-full bg-gray-400" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  variant="outline"
                  className="w-full border-black text-black hover:bg-black hover:text-white bg-transparent"
                >
                  Try {mode.title}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
