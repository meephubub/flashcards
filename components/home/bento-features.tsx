import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Repeat,
  Target,
  MessageSquare,
  BarChart3,
  FileText,
  Upload,
  GraduationCap,
  Zap,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export function BentoFeatures() {
  return (
    <section className="py-20 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-4">
            Everything you need to learn effectively
          </h2>
          <p className="text-lg text-gray-600">
            Powerful features designed to accelerate your learning and help you
            retain knowledge longer.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Large AI Feature Card */}
          <Card className="lg:col-span-2 lg:row-span-2 border-0 bg-gradient-to-br from-black to-gray-800 text-white overflow-hidden group hover:scale-[1.02] transition-all duration-300">
            <CardContent className="p-8 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Brain className="w-6 h-6" />
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-white/20 text-white border-white/30"
                  >
                    AI Powered
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold mb-4">
                  AI Flashcard Generation
                </h3>
                <p className="text-white/80 mb-6 leading-relaxed">
                  Transform any text into comprehensive flashcards instantly
                  using advanced AI technology. Smart content analysis creates
                  relevant questions automatically.
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Sparkles className="w-4 h-4" />
                  <span>Smart content analysis</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Zap className="w-4 h-4" />
                  <span>Multiple question formats</span>
                </div>
                <Button
                  variant="secondary"
                  className="w-full bg-white text-black hover:bg-gray-200 group"
                >
                  Try AI Generation
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Spaced Repetition */}
          <Card className="border-0 bg-white shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-black rounded-xl">
                  <Repeat className="w-6 h-6 text-white" />
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-black to-gray-600 rounded-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Spaced Repetition</h3>
              <p className="text-gray-600 text-sm">
                Scientifically-proven algorithms optimize your learning schedule
              </p>
            </CardContent>
          </Card>

          {/* Study Modes */}
          <Card className="border-0 bg-gradient-to-br from-gray-50 to-white shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-gray-800 to-black rounded-xl">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <Badge variant="outline" className="text-xs">
                  3 Modes
                </Badge>
              </div>
              <h3 className="text-lg font-semibold mb-2">Study Modes</h3>
              <p className="text-gray-600 text-sm">
                Regular, exam, and language learning modes
              </p>
            </CardContent>
          </Card>

          {/* AI Assistant */}
          <Card className="lg:col-span-2 border-0 bg-gradient-to-r from-gray-900 to-black text-white overflow-hidden group hover:scale-[1.02] transition-all duration-300">
            <CardContent className="p-6 flex items-center gap-6">
              <div className="flex-shrink-0">
                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <MessageSquare className="w-8 h-8" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">
                  AI Study Assistant
                </h3>
                <p className="text-white/80 mb-4">
                  Get personalized help, explanations, and study tips from your
                  AI companion
                </p>
                <div className="flex gap-4 text-sm text-white/60">
                  <span>• Instant explanations</span>
                  <span>• Study tips</span>
                  <span>• 24/7 available</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress Tracking */}
          <Card className="border-0 bg-white shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-black rounded-xl">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div className="flex gap-1">
                  <div className="w-2 h-8 bg-black rounded-full"></div>
                  <div className="w-2 h-6 bg-gray-300 rounded-full"></div>
                  <div className="w-2 h-4 bg-gray-200 rounded-full"></div>
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Progress Tracking</h3>
              <p className="text-gray-600 text-sm">
                Detailed analytics and learning insights
              </p>
            </CardContent>
          </Card>

          {/* Notes System */}
          <Card className="border-0 bg-gradient-to-br from-gray-50 to-white shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-gray-700 to-black rounded-xl">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <Badge variant="outline" className="text-xs">
                  Rich Text
                </Badge>
              </div>
              <h3 className="text-lg font-semibold mb-2">Advanced Notes</h3>
              <p className="text-gray-600 text-sm">
                Markdown, math, diagrams, and interactive elements
              </p>
            </CardContent>
          </Card>

          {/* Import/Export */}
          <Card className="border-0 bg-white shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-black rounded-xl">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Import & Export</h3>
              <p className="text-gray-600 text-sm">
                Seamless data transfer and backup
              </p>
            </CardContent>
          </Card>

          {/* AI Grading */}
          <Card className="border-0 bg-gradient-to-br from-black to-gray-800 text-white overflow-hidden group hover:scale-[1.02] transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <Badge
                  variant="secondary"
                  className="bg-white/20 text-white border-white/30"
                >
                  AI
                </Badge>
              </div>
              <h3 className="text-lg font-semibold mb-2">Smart Grading</h3>
              <p className="text-white/80 text-sm mb-4">
                Intelligent feedback and scoring on your answers
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                  <span>Detailed analysis</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                  <span>Constructive feedback</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
