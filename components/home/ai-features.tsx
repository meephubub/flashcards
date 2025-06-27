import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  MessageSquare,
  GraduationCap,
  Zap,
  ArrowRight,
} from "lucide-react";

export function AIFeatures() {
  return (
    <section className="py-20 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4 px-4 py-2 border-black">
            <Sparkles className="mr-2 h-4 w-4" />
            Powered by AI
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Your AI-powered learning companion
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Harness the power of artificial intelligence to create, study, and
            master your flashcards like never before.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-6xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Main AI Feature */}
            <Card className="lg:col-span-2 overflow-hidden border border-gray-200 bg-gradient-to-br from-gray-50 to-white shadow-lg">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">
                      AI Flashcard Generation
                    </CardTitle>
                    <CardDescription className="text-base">
                      Transform any text into comprehensive flashcards instantly
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-900">
                      Smart Content Analysis
                    </h4>
                    <p className="text-sm text-gray-600">
                      AI analyzes your content to identify key concepts and
                      create relevant questions
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-900">
                      Multiple Formats
                    </h4>
                    <p className="text-sm text-gray-600">
                      Generate various question types: multiple choice,
                      fill-in-the-blank, and more
                    </p>
                  </div>
                </div>
                <Button className="w-full sm:w-auto bg-black hover:bg-gray-800">
                  Try AI Generation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Secondary AI Features */}
            <Card className="border-0 bg-white shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      AI Study Assistant
                    </CardTitle>
                    <CardDescription>
                      Get personalized help while studying
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-black" />
                    Explain difficult concepts
                  </li>
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-black" />
                    Provide study tips
                  </li>
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-black" />
                    Answer questions instantly
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800">
                    <GraduationCap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      AI-Powered Grading
                    </CardTitle>
                    <CardDescription>
                      Intelligent feedback on your answers
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-gray-800" />
                    Detailed answer analysis
                  </li>
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-gray-800" />
                    Constructive feedback
                  </li>
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-gray-800" />
                    Progress recommendations
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
