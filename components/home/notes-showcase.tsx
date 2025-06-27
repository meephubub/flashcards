import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Code,
  Calculator,
  ImageIcon,
  ArrowRight,
} from "lucide-react";

const noteFeatures = [
  {
    icon: FileText,
    title: "Rich Markdown Support",
    description:
      "Full Markdown syntax with headings, lists, tables, and formatting",
  },
  {
    icon: Calculator,
    title: "Math Equations",
    description:
      "LaTeX support for complex mathematical expressions and formulas",
  },
  {
    icon: Code,
    title: "Interactive Elements",
    description: "MCQs, fill-the-gap, drag-and-drop matching, and more",
  },
  {
    icon: ImageIcon,
    title: "Visual Content",
    description: "Images, Mermaid diagrams, and tree structures",
  },
];

export function NotesShowcase() {
  return (
    <section className="bg-gray-50 py-20 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left side - Content */}
            <div className="space-y-8">
              <div>
                <Badge variant="outline" className="mb-4 border-black">
                  <FileText className="mr-2 h-4 w-4" />
                  Advanced Notes
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  Take notes that enhance your learning
                </h2>
                <p className="mt-4 text-lg text-gray-600">
                  Our advanced notes system supports everything from basic
                  Markdown to interactive learning elements, making your study
                  materials more engaging and effective.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {noteFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black">
                      <feature.icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Button className="w-full sm:w-auto bg-black hover:bg-gray-800">
                Explore Notes Features
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Right side - Example */}
            <Card className="border border-gray-200 bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">
                  Example: Biology Notes
                </CardTitle>
                <CardDescription>
                  See how rich formatting enhances learning
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-4 font-mono text-sm">
                  <div className="space-y-2">
                    <div className="text-blue-600"># Cell Biology</div>
                    <div className="text-gray-600">## Mitochondria</div>
                    <div>
                      The mitochondria is the **powerhouse** of the cell.
                    </div>
                    <div className="mt-3 text-green-600">{"::blue"}</div>
                    <div>💡 **Key Fact**: Mitochondria have their own DNA!</div>
                    <div className="text-green-600">::</div>
                    <div className="mt-3">
                      **Formula**: $ATP = ADP + P_i + Energy$
                    </div>
                    <div className="mt-3 text-purple-600">
                      ?? What produces ATP in cells?
                    </div>
                    <div>[x] Mitochondria</div>
                    <div>[ ] Nucleus</div>
                    <div>[ ] Ribosomes</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  This example shows headings, formatting, info boxes, math, and
                  interactive MCQs
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
