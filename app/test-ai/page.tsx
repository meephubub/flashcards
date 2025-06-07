"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { makeGroqRequest } from "@/lib/groq";
import { generateImage } from "@/lib/image-generation";

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

      const endpoint = "https://raspberrypi.unicorn-deneb.ts.net/api/v1/chat/completions";
      
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
            }`
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
        if (fetchError instanceof TypeError && fetchError.message === "Failed to fetch") {
          throw new Error(
            `Network error: Could not connect to ${endpoint}. Please check if the server is running and accessible.`
          );
        }
        throw fetchError;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
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
        endpoint: "https://raspberrypi.unicorn-deneb.ts.net/api/v1/chat/completions",
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
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          `API error: ${response.statusText}${
            errorData ? ` - ${JSON.stringify(errorData)}` : ""
          }`
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
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
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
        model: "flux",
        response_format: "b64_json"
      };

      const result = await generateImage(prompt);
      
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
            b64_json: "[BASE64_IMAGE_DATA]" // Truncate base64 data for display
          }))
        },
        endpoint: "https://raspberrypi.unicorn-deneb.ts.net/api/v1/images/generate",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      
      // Capture error in debug info
      setDebugInfo({
        request: {
          prompt,
          model: "flux",
          response_format: "b64_json"
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
              <pre className="bg-gray-100 p-2 rounded">{debugInfo.endpoint}</pre>
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
              <pre className="bg-gray-100 p-2 rounded">{debugInfo.timestamp}</pre>
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

      {image && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Image</CardTitle>
          </CardHeader>
          <CardContent>
            <img src={image} alt="Generated" className="max-w-full h-auto" />
          </CardContent>
        </Card>
      )}
    </div>
  );
} 