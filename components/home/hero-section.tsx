import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Brain, Sparkles, Play } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white py-20 sm:py-32">
      {/* Animated background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] animate-pulse" />
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-black/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-black/3 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="mx-auto max-w-5xl">
          {/* Top badge */}
          <div className="text-center mb-8">
            <Badge
              variant="outline"
              className="px-6 py-2 border-black/20 bg-black/5 backdrop-blur-sm"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              AI-Powered Learning Platform
            </Badge>
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left content */}
            <div className="lg:col-span-7 space-y-8">
              <h1 className="text-4xl font-bold tracking-tight text-black sm:text-6xl lg:text-7xl leading-tight">
                Master Any Subject with{" "}
                <span className="relative">
                  <span className="bg-gradient-to-r from-black via-gray-800 to-black bg-clip-text text-transparent">
                    Smart Flashcards
                  </span>
                  <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-black to-transparent opacity-20"></div>
                </span>
              </h1>

              <p className="text-xl leading-8 text-gray-600 max-w-2xl">
                Transform your learning with AI-generated flashcards, spaced
                repetition, and intelligent study modes.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="px-8 py-4 text-lg bg-black hover:bg-gray-800 group"
                >
                  <Brain className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                  Start Learning Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="px-8 py-4 text-lg border-black/20 text-black hover:bg-black hover:text-white bg-transparent group"
                >
                  <Play className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                  Watch Demo
                </Button>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-8 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-black">10K+</div>
                  <div className="text-sm text-gray-500">Active Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-black">1M+</div>
                  <div className="text-sm text-gray-500">Flashcards</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-black">95%</div>
                  <div className="text-sm text-gray-500">Success Rate</div>
                </div>
              </div>
            </div>

            {/* Right visual element */}
            <div className="lg:col-span-5">
              <div className="relative">
                <div className="w-full h-96 bg-gradient-to-br from-gray-100 to-gray-50 rounded-3xl border border-gray-200 p-8 shadow-2xl">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-black rounded-full"></div>
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-4 bg-black/10 rounded-lg w-3/4"></div>
                      <div className="h-4 bg-black/5 rounded-lg w-1/2"></div>
                      <div className="h-20 bg-black/5 rounded-xl"></div>
                      <div className="flex gap-2">
                        <div className="h-8 bg-black rounded-lg flex-1"></div>
                        <div className="h-8 bg-gray-200 rounded-lg flex-1"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-black rounded-2xl flex items-center justify-center shadow-xl">
                  <Brain className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
