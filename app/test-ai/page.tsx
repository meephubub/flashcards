"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { makeGroqRequest } from "@/lib/groq";
import { generateImage } from "@/lib/image-generation";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface DebugInfo {
  request: any;
  response: any;
  endpoint: string;
  timestamp: string;
  error?: string;
}

export default function TestAIPage() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [selectedModel, setSelectedModel] = useState("gptimage");
  const [imageWidth, setImageWidth] = useState(1024);
  const [imageHeight, setImageHeight] = useState(1024);
  const [numImages, setNumImages] = useState(1);
  const { toast } = useToast();

  const handleCustomEndpoint = async () => {
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    try {
      const requestBody = {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.6,
        max_tokens: 3000,
      };

      const endpoint =
        "https://raspberrypi.unicorn-deneb.ts.net/api/v1/chat/completions";

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            `API error: ${response.statusText}${
              errorData ? ` - ${JSON.stringify(errorData)}` : ""
            }`,
          );
        }

        const data = await response.json();
        const result = data.choices[0].message.content;
        setResponse(result);

        // Capture debug info
        setDebugInfo({
          request: requestBody,
          response: result,
          endpoint,
          timestamp: new Date().toISOString(),
        });
      } catch (fetchError) {
        // Handle network errors specifically
        if (
          fetchError instanceof TypeError &&
          fetchError.message === "Failed to fetch"
        ) {
          throw new Error(
            `Network error: Could not connect to ${endpoint}. Please check if the server is running and accessible.`,
          );
        }
        throw fetchError;
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);

      // Capture error in debug info
      setDebugInfo({
        request: {
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.6,
          max_tokens: 3000,
        },
        response: null,
        endpoint:
          "https://raspberrypi.unicorn-deneb.ts.net/api/v1/chat/completions",
        timestamp: new Date().toISOString(),
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGroq = async () => {
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    try {
      const requestBody = {
        model: "llama3-70b-8192",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.6,
        max_tokens: 3000,
      };

      // Get API key from environment variables
      const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("GROQ_API_KEY is not defined in environment variables");
      }

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          `API error: ${response.statusText}${
            errorData ? ` - ${JSON.stringify(errorData)}` : ""
          }`,
        );
      }

      const data = await response.json();
      const result = data.choices[0].message.content;
      setResponse(result);

      // Capture debug info
      setDebugInfo({
        request: requestBody,
        response: result,
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);

      // Capture error in debug info
      setDebugInfo({
        request: {
          model: "llama3-70b-8192",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.6,
          max_tokens: 3000,
        },
        response: null,
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        timestamp: new Date().toISOString(),
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageGeneration = async () => {
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    try {
      const requestBody = {
        prompt,
        model: selectedModel,
        width: imageWidth,
        height: imageHeight,
        n: numImages,
        response_format: "b64_json",
      };

      const result = await generateImage(prompt, selectedModel, imageWidth, imageHeight, numImages);

      // Get the first image from the data array
      if (result.data && result.data.length > 0) {
        setImage(`data:image/png;base64,${result.data[0].b64_json}`);
      } else {
        throw new Error("No image data received");
      }

      // Capture debug info
      setDebugInfo({
        request: requestBody,
        response: {
          ...result,
          data: result.data.map((item: any) => ({
            ...item,
            b64_json: "[BASE64_IMAGE_DATA]", // Truncate base64 data for display
          })),
        },
        endpoint: "https://raspberrypi.unicorn-deneb.ts.net/api/v1/images/generate",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setDebugInfo({
        request: {
          prompt,
          model: selectedModel,
          width: imageWidth,
          height: imageHeight,
          n: numImages,
          response_format: "b64_json",
        },
        response: null,
        endpoint: "https://raspberrypi.unicorn-deneb.ts.net/api/v1/images/generate",
        timestamp: new Date().toISOString(),
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyImage = () => {
    if (image) {
      const markdownImage = `![Generated Image](${image})`;
      navigator.clipboard.writeText(markdownImage);
      toast({
        title: "Copied!",
        description: "Image copied in Markdown format",
      });
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">AI Test Page</h1>

      <Card>
        <CardHeader>
          <CardTitle>Test Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter your prompt..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button onClick={handleCustomEndpoint} disabled={loading}>
                {loading ? "Loading..." : "Test Custom Endpoint"}
              </Button>
              <Button onClick={handleGroq} disabled={loading}>
                {loading ? "Loading..." : "Test Groq"}
              </Button>
            </div>
            <div className="text-sm text-gray-500">
              Note: Image generation is only available with the custom endpoint
            </div>
            <Button
              onClick={handleImageGeneration}
              disabled={loading}
              variant="outline"
            >
              {loading ? "Loading..." : "Generate Image (Custom Endpoint Only)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Image Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flux">Flux</SelectItem>
                <SelectItem value="turbo">Turbo</SelectItem>
                <SelectItem value="gptimage">GPT Image</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Width</Label>
              <Input
                type="number"
                value={imageWidth}
                onChange={(e) => setImageWidth(Number(e.target.value))}
                min={256}
                max={2048}
                step={64}
              />
            </div>
            <div className="space-y-2">
              <Label>Height</Label>
              <Input
                type="number"
                value={imageHeight}
                onChange={(e) => setImageHeight(Number(e.target.value))}
                min={256}
                max={2048}
                step={64}
              />
            </div>
            <div className="space-y-2">
              <Label>Number of Images</Label>
              <Input
                type="number"
                value={numImages}
                onChange={(e) => setNumImages(Number(e.target.value))}
                min={1}
                max={4}
              />
            </div>
          </div>

          <Textarea
            placeholder="Enter your image generation prompt..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px]"
          />
          <Button onClick={handleImageGeneration} disabled={loading}>
            {loading ? "Generating..." : "Generate Image"}
          </Button>
          
          {error && <div className="text-red-500">{error}</div>}
          
          {image && (
            <div className="relative">
              <img src={image} alt="Generated" className="max-w-full rounded-lg" />
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={handleCopyImage}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {debugInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Endpoint:</h3>
              <pre className="bg-gray-100 p-2 rounded">
                {debugInfo.endpoint}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Request:</h3>
              <pre className="bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(debugInfo.request, null, 2)}
              </pre>
            </div>
            {debugInfo.error ? (
              <div>
                <h3 className="font-semibold mb-2 text-red-600">Error:</h3>
                <pre className="bg-red-50 p-2 rounded overflow-auto">
                  {debugInfo.error}
                </pre>
              </div>
            ) : (
              <div>
                <h3 className="font-semibold mb-2">Response:</h3>
                <pre className="bg-gray-100 p-2 rounded overflow-auto">
                  {JSON.stringify(debugInfo.response, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <h3 className="font-semibold mb-2">Timestamp:</h3>
              <pre className="bg-gray-100 p-2 rounded">
                {debugInfo.timestamp}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {response && (
        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap">{response}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
