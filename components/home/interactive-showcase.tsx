import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Code,
  Calculator,
  ImageIcon,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

export function InteractiveShowcase() {
  return (
    <section className="py-20 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div>
                <Badge
                  variant="outline"
                  className="mb-4 border-black/20 bg-black/5"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Advanced Notes System
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-6">
                  Take notes that enhance your learning
                </h2>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Our advanced notes system supports everything from basic
                  Markdown to interactive learning elements, making your study
                  materials more engaging and effective.
                </p>
              </div>

              {/* Feature Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-black/20 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-black rounded-lg">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-sm">Rich Markdown</h3>
                  </div>
                  <p className="text-xs text-gray-600">
                    Full syntax support with formatting
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-black/20 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-black rounded-lg">
                      <Calculator className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-sm">Math Equations</h3>
                  </div>
                  <p className="text-xs text-gray-600">
                    LaTeX support for formulas
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-black/20 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-black rounded-lg">
                      <Code className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-sm">
                      Interactive Elements
                    </h3>
                  </div>
                  <p className="text-xs text-gray-600">
                    MCQs, fill-the-gap, matching
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-black/20 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-black rounded-lg">
                      <ImageIcon className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-sm">Visual Content</h3>
                  </div>
                  <p className="text-xs text-gray-600">
                    Images, diagrams, charts
                  </p>
                </div>
              </div>

              <Button className="w-full sm:w-auto bg-black hover:bg-gray-800 group">
                Explore Notes Features
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>

            {/* Right Interactive Demo */}
            <div className="relative">
              <Card className="border-0 bg-white shadow-2xl overflow-hidden">
                <CardContent className="p-0">
                  {/* Mock Browser Header */}
                  <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      <div className="ml-4 text-xs text-gray-500 font-mono">
                        Biology Notes
                      </div>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="p-6 space-y-6">
                    {/* Title */}
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        # Cell Biology
                      </h3>
                      <div className="text-lg text-gray-700">
                        ## Mitochondria
                      </div>
                    </div>

                    {/* Text Content */}
                    <div className="space-y-3">
                      <p className="text-gray-700">
                        The mitochondria is the <strong>powerhouse</strong> of
                        the cell.
                      </p>

                      {/* Info Box */}
                      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-blue-600">💡</span>
                          <div>
                            <strong className="text-blue-900">Key Fact:</strong>
                            <span className="text-blue-800">
                              {" "}
                              Mitochondria have their own DNA!
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Math Formula */}
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="font-mono text-sm text-gray-700">
                          <strong>Formula:</strong> ATP = ADP + P<sub>i</sub> +
                          Energy
                        </div>
                      </div>

                      {/* Interactive MCQ */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="font-semibold text-gray-900 mb-3">
                          ?? What produces ATP in cells?
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-green-700 font-medium">
                              Mitochondria
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border border-gray-300 rounded"></div>
                            <span className="text-gray-600">Nucleus</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border border-gray-300 rounded"></div>
                            <span className="text-gray-600">Ribosomes</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-black rounded-2xl flex items-center justify-center shadow-xl">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center shadow-lg">
                <Code className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
