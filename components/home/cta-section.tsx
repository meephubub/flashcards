import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Brain, Sparkles } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-20 sm:py-32 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="mx-auto max-w-4xl overflow-hidden border-0 bg-black shadow-2xl">
          <CardContent className="p-12 text-center text-white">
            <Badge
              variant="secondary"
              className="mb-6 bg-white/20 text-white hover:bg-white/30 border-white/30"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Join thousands of learners
            </Badge>

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Ready to transform your learning?
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-300 sm:text-xl">
              Start creating AI-powered flashcards today and experience the
              future of personalized learning. No credit card required.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                variant="secondary"
                className="px-8 py-3 text-lg font-semibold bg-white text-black hover:bg-gray-200"
              >
                <Brain className="mr-2 h-5 w-5" />
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/10 px-8 py-3 text-lg font-semibold text-white hover:bg-white/20"
              >
                Watch Demo
              </Button>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div className="flex flex-col items-center">
                <div className="text-2xl font-bold">10,000+</div>
                <div className="text-sm text-gray-300">Active learners</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-2xl font-bold">1M+</div>
                <div className="text-sm text-gray-300">Flashcards created</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-2xl font-bold">95%</div>
                <div className="text-sm text-gray-300">
                  Retention improvement
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
