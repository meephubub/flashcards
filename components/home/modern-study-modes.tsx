import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Target,
  Languages,
  ArrowRight,
  Clock,
  Trophy,
  Globe,
} from "lucide-react";

export function ModernStudyModes() {
  return (
    <section className="bg-gray-50 py-20 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-4">
            Study modes for every learning style
          </h2>
          <p className="text-lg text-gray-600">
            Choose the perfect study mode that matches your learning goals and
            preferences.
          </p>
        </div>

        {/* Bento Grid for Study Modes */}
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Regular Study Mode - Large Card */}
          <Card className="lg:col-span-2 border-0 bg-white shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-500">
            <CardContent className="p-0">
              <div className="flex flex-col lg:flex-row">
                <div className="lg:w-2/3 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-black rounded-xl">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <Badge variant="outline" className="border-black/20">
                      Popular
                    </Badge>
                  </div>
                  <h3 className="text-2xl font-bold mb-4">
                    Regular Study Mode
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Master your flashcards with spaced repetition algorithms
                    that adapt to your learning pace and optimize retention.
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-2 h-2 bg-black rounded-full"></div>
                      <span>Spaced repetition</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-2 h-2 bg-black rounded-full"></div>
                      <span>Progress tracking</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-2 h-2 bg-black rounded-full"></div>
                      <span>Difficulty adjustment</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-2 h-2 bg-black rounded-full"></div>
                      <span>Review scheduling</span>
                    </div>
                  </div>
                  <Button className="w-full bg-black hover:bg-gray-800 group">
                    Start Regular Study
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
                <div className="lg:w-1/3 bg-gradient-to-br from-gray-100 to-gray-50 p-8 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-black/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                      <BookOpen className="w-10 h-10 text-black/60" />
                    </div>
                    <div className="text-sm text-gray-500">Most Popular</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exam Mode - Vertical Card */}
          <Card className="border-0 bg-gradient-to-br from-black to-gray-800 text-white shadow-xl overflow-hidden group hover:shadow-2xl hover:scale-[1.02] transition-all duration-500">
            <CardContent className="p-8 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Target className="w-6 h-6" />
                </div>
                <Badge
                  variant="secondary"
                  className="bg-white/20 text-white border-white/30"
                >
                  Intensive
                </Badge>
              </div>
              <h3 className="text-xl font-bold mb-4">Exam Mode</h3>
              <p className="text-white/80 mb-6 leading-relaxed flex-1">
                Test your knowledge under pressure with timed sessions and
                comprehensive scoring.
              </p>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white/80">Timed sessions</span>
                </div>
                <div className="flex items-center gap-3">
                  <Trophy className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white/80">
                    Performance analytics
                  </span>
                </div>
              </div>
              <Button
                variant="secondary"
                className="w-full bg-white text-black hover:bg-gray-200"
              >
                Try Exam Mode
              </Button>
            </CardContent>
          </Card>

          {/* Language Mode - Full Width */}
          <Card className="lg:col-span-3 border-0 bg-white shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-500">
            <CardContent className="p-0">
              <div className="flex flex-col lg:flex-row">
                <div className="lg:w-1/4 bg-gradient-to-br from-gray-900 to-black p-8 flex items-center justify-center text-white">
                  <div className="text-center">
                    <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm mb-4">
                      <Languages className="w-8 h-8" />
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-white/20 text-white border-white/30"
                    >
                      Specialized
                    </Badge>
                  </div>
                </div>
                <div className="lg:w-3/4 p-8">
                  <h3 className="text-2xl font-bold mb-4">
                    Language Study Mode
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Specialized tools for language learning with pronunciation,
                    grammar, and vocabulary focus. Perfect for mastering new
                    languages.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Pronunciation practice
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Grammar exercises
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Vocabulary building
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Languages className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Cultural context
                      </span>
                    </div>
                  </div>
                  <Button className="bg-black hover:bg-gray-800 group">
                    Explore Language Mode
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
