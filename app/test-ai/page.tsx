"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { makeGroqRequest } from "@/lib/groq";
import { generateImage } from "@/lib/image-generation";
import { generateVoice } from "@/lib/generate-voice";
import { Copy, Play, Pause } from "lucide-react";
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
  
  // Image generation parameters
  const [selectedModel, setSelectedModel] = useState("flux");
  const [imageWidth, setImageWidth] = useState(1024);
  const [imageHeight, setImageHeight] = useState(1024);
  const [seed, setSeed] = useState<string>("");
  const [nologo, setNologo] = useState(false);
  const [privateImage, setPrivateImage] = useState(false);
  const [enhance, setEnhance] = useState(false);
  const [safe, setSafe] = useState(false);
  const [transparent, setTransparent] = useState(false);

  // Text generation parameters
  const [textModel, setTextModel] = useState("openai");
  const [textSeed, setTextSeed] = useState<string>("");
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1.0);
  const [presencePenalty, setPresencePenalty] = useState(0);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  const [jsonResponse, setJsonResponse] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [privateText, setPrivateText] = useState(false);

  // Voice generation parameters
  const [voiceModel, setVoiceModel] = useState("elevenlabs");
  const [voiceId, setVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");
  const [voiceStability, setVoiceStability] = useState(0.5);
  const [voiceSimilarity, setVoiceSimilarity] = useState(0.75);
  const [voiceStyle, setVoiceStyle] = useState(0.0);
  const [voiceUseCase, setVoiceUseCase] = useState("narration");
  const [voiceAudio, setVoiceAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const { toast } = useToast();

  const handleCustomEndpoint = async () => {
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    try {
      const params = new URLSearchParams({
        model: textModel,
        temperature: temperature.toString(),
        top_p: topP.toString(),
        presence_penalty: presencePenalty.toString(),
        frequency_penalty: frequencyPenalty.toString(),
        json: jsonResponse.toString(),
        private: privateText.toString(),
      });

      if (textSeed) params.append("seed", textSeed);
      if (systemPrompt) params.append("system", systemPrompt);

      // Get API key from environment variables
      const apiKey = process.env.NEXT_PUBLIC_POLLINATIONS_API;
      if (!apiKey) {
        throw new Error("NEXT_PUBLIC_POLLINATIONS_API is not defined in environment variables");
      }

      // Add API key to the URL instead of headers
      params.append("api_key", apiKey);
      const endpoint = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?${params.toString()}`;

      try {
        // Try using allorigins.win as a CORS proxy
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`;
        
        console.log("Attempting to fetch from:", proxyUrl);
        
        const response = await fetch(proxyUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
        });

        console.log("Response status:", response.status);
        console.log("Response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", errorText);
          throw new Error(`API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
        }

        const result = await response.text();
        setResponse(result);

        // Capture debug info
        setDebugInfo({
          request: { prompt, ...Object.fromEntries(params) },
          response: result,
          endpoint: proxyUrl,
          timestamp: new Date().toISOString(),
        });
      } catch (fetchError: unknown) {
        console.error("Fetch error details:", {
          error: fetchError,
          type: fetchError instanceof Error ? fetchError.constructor.name : typeof fetchError,
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
          stack: fetchError instanceof Error ? fetchError.stack : undefined
        });

        // Try alternative proxy
        try {
          const altProxyUrl = `https://cors-anywhere.herokuapp.com/${endpoint}`;
          console.log("Trying alternative proxy:", altProxyUrl);

          const altResponse = await fetch(altProxyUrl, {
            method: "GET",
            headers: {
              "Accept": "application/json",
              "X-Requested-With": "XMLHttpRequest",
            },
          });

          if (!altResponse.ok) {
            const errorText = await altResponse.text();
            throw new Error(`Alternative proxy error: ${altResponse.status} ${altResponse.statusText}${errorText ? ` - ${errorText}` : ""}`);
          }

          const result = await altResponse.text();
          setResponse(result);

          setDebugInfo({
            request: { prompt, ...Object.fromEntries(params) },
            response: result,
            endpoint: altProxyUrl,
            timestamp: new Date().toISOString(),
          });
        } catch (altError: unknown) {
          console.error("Alternative proxy error details:", {
            error: altError,
            type: altError instanceof Error ? altError.constructor.name : typeof altError,
            message: altError instanceof Error ? altError.message : String(altError),
            stack: altError instanceof Error ? altError.stack : undefined
          });

          // Try direct fetch as last resort
          try {
            console.log("Attempting direct fetch as last resort");
            const directResponse = await fetch(endpoint, {
              method: "GET",
              headers: {
                "Accept": "application/json",
              },
            });

            if (!directResponse.ok) {
              throw new Error(`Direct fetch failed: ${directResponse.status} ${directResponse.statusText}`);
            }

            const result = await directResponse.text();
            setResponse(result);

            setDebugInfo({
              request: { prompt, ...Object.fromEntries(params) },
              response: result,
              endpoint,
              timestamp: new Date().toISOString(),
            });
          } catch (directError: unknown) {
            throw new Error(
              `All fetch attempts failed:\n` +
              `1. First proxy error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}\n` +
              `2. Alternative proxy error: ${altError instanceof Error ? altError.message : String(altError)}\n` +
              `3. Direct fetch error: ${directError instanceof Error ? directError.message : String(directError)}`
            );
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setDebugInfo({
        request: { prompt },
        response: null,
        endpoint: `https://text.pollinations.ai/${encodeURIComponent(prompt)}`,
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
      const params = new URLSearchParams({
        model: selectedModel,
        width: imageWidth.toString(),
        height: imageHeight.toString(),
        nologo: nologo.toString(),
        private: privateImage.toString(),
        enhance: enhance.toString(),
        safe: safe.toString(),
        transparent: transparent.toString(),
      });

      if (seed) params.append("seed", seed);

      // Get API key from environment variables
      const apiKey = process.env.NEXT_PUBLIC_POLLINATIONS_API;
      if (!apiKey) {
        throw new Error("NEXT_PUBLIC_POLLINATIONS_API is not defined in environment variables");
      }

      // Add API key to the URL instead of headers
      params.append("api_key", apiKey);
      const endpoint = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;

      try {
        // Try using allorigins.win as a CORS proxy
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`;
        
        console.log("Attempting to fetch from:", proxyUrl);
        
        const response = await fetch(proxyUrl, {
          method: "GET",
          headers: {
            "Accept": "image/*",
          },
        });

        console.log("Response status:", response.status);
        console.log("Response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", errorText);
          throw new Error(`API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
        }

        const blob = await response.blob();
        console.log("Received blob:", blob.type, blob.size);
        
        const imageUrl = URL.createObjectURL(blob);
        setImage(imageUrl);

        // Capture debug info
        setDebugInfo({
          request: { prompt, ...Object.fromEntries(params) },
          response: "Image generated successfully",
          endpoint: proxyUrl,
          timestamp: new Date().toISOString(),
        });
      } catch (fetchError: unknown) {
        console.error("Fetch error details:", {
          error: fetchError,
          type: fetchError instanceof Error ? fetchError.constructor.name : typeof fetchError,
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
          stack: fetchError instanceof Error ? fetchError.stack : undefined
        });

        // Try alternative proxy
        try {
          const altProxyUrl = `https://cors-anywhere.herokuapp.com/${endpoint}`;
          console.log("Trying alternative proxy:", altProxyUrl);

          const altResponse = await fetch(altProxyUrl, {
            method: "GET",
            headers: {
              "Accept": "image/*",
              "X-Requested-With": "XMLHttpRequest",
            },
          });

          if (!altResponse.ok) {
            const errorText = await altResponse.text();
            throw new Error(`Alternative proxy error: ${altResponse.status} ${altResponse.statusText}${errorText ? ` - ${errorText}` : ""}`);
          }

          const blob = await altResponse.blob();
          const imageUrl = URL.createObjectURL(blob);
          setImage(imageUrl);

          setDebugInfo({
            request: { prompt, ...Object.fromEntries(params) },
            response: "Image generated successfully via alternative proxy",
            endpoint: altProxyUrl,
            timestamp: new Date().toISOString(),
          });
        } catch (altError: unknown) {
          console.error("Alternative proxy error details:", {
            error: altError,
            type: altError instanceof Error ? altError.constructor.name : typeof altError,
            message: altError instanceof Error ? altError.message : String(altError),
            stack: altError instanceof Error ? altError.stack : undefined
          });

          // Try direct fetch as last resort
          try {
            console.log("Attempting direct fetch as last resort");
            const directResponse = await fetch(endpoint, {
              method: "GET",
              headers: {
                "Accept": "image/*",
              },
            });

            if (!directResponse.ok) {
              throw new Error(`Direct fetch failed: ${directResponse.status} ${directResponse.statusText}`);
            }

            const blob = await directResponse.blob();
            const imageUrl = URL.createObjectURL(blob);
            setImage(imageUrl);

            setDebugInfo({
              request: { prompt, ...Object.fromEntries(params) },
              response: "Image generated successfully via direct fetch",
              endpoint,
              timestamp: new Date().toISOString(),
            });
          } catch (directError: unknown) {
            throw new Error(
              `All fetch attempts failed:\n` +
              `1. First proxy error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}\n` +
              `2. Alternative proxy error: ${altError instanceof Error ? altError.message : String(altError)}\n` +
              `3. Direct fetch error: ${directError instanceof Error ? directError.message : String(directError)}`
            );
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setDebugInfo({
        request: { prompt },
        response: null,
        endpoint: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
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

  const handleVoiceGeneration = async () => {
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    try {
      const params = new URLSearchParams({
        model: "openai-audio",
        voice: voiceId,
      });

      // Get API key from environment variables
      const apiKey = process.env.NEXT_PUBLIC_POLLINATIONS_API;
      if (!apiKey) {
        throw new Error("NEXT_PUBLIC_POLLINATIONS_API is not defined in environment variables");
      }

      // Add API key to the URL instead of headers
      params.append("api_key", apiKey);
      const endpoint = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?${params.toString()}`;

      try {
        // Use our proxy server
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(endpoint)}`;
        
        console.log("Attempting to fetch from:", proxyUrl);
        
        const response = await fetch(proxyUrl, {
          method: "GET",
          headers: {
            "Accept": "audio/*",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        setVoiceAudio(audioUrl);

        // Create new audio element
        const audio = new Audio(audioUrl);
        setAudioElement(audio);

        // Capture debug info
        setDebugInfo({
          request: { prompt, ...Object.fromEntries(params) },
          response: "Voice generated successfully",
          endpoint: proxyUrl,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        throw new Error(`Voice generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setDebugInfo({
        request: { prompt },
        response: null,
        endpoint: `https://text.pollinations.ai/${encodeURIComponent(prompt)}`,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioElement) return;

    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">AI Test Page</h1>

      <Card>
        <CardHeader>
          <CardTitle>Text Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={textModel} onValueChange={setTextModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="mistral">Mistral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Seed (optional)</Label>
              <Input
                type="text"
                value={textSeed}
                onChange={(e) => setTextSeed(e.target.value)}
                placeholder="Enter seed for reproducibility"
              />
            </div>
            <div className="space-y-2">
              <Label>Temperature (0.0 - 3.0)</Label>
              <Input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                min={0}
                max={3}
                step={0.1}
              />
            </div>
            <div className="space-y-2">
              <Label>Top P (0.0 - 1.0)</Label>
              <Input
                type="number"
                value={topP}
                onChange={(e) => setTopP(Number(e.target.value))}
                min={0}
                max={1}
                step={0.1}
              />
            </div>
            <div className="space-y-2">
              <Label>Presence Penalty (-2.0 - 2.0)</Label>
              <Input
                type="number"
                value={presencePenalty}
                onChange={(e) => setPresencePenalty(Number(e.target.value))}
                min={-2}
                max={2}
                step={0.1}
              />
            </div>
            <div className="space-y-2">
              <Label>Frequency Penalty (-2.0 - 2.0)</Label>
              <Input
                type="number"
                value={frequencyPenalty}
                onChange={(e) => setFrequencyPenalty(Number(e.target.value))}
                min={-2}
                max={2}
                step={0.1}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>System Prompt (optional)</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter system prompt..."
              className="min-h-[100px]"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="jsonResponse"
                checked={jsonResponse}
                onChange={(e) => setJsonResponse(e.target.checked)}
              />
              <Label htmlFor="jsonResponse">JSON Response</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="privateText"
                checked={privateText}
                onChange={(e) => setPrivateText(e.target.checked)}
              />
              <Label htmlFor="privateText">Private</Label>
            </div>
          </div>

          <Textarea
            placeholder="Enter your prompt..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px]"
          />
          <Button onClick={handleCustomEndpoint} disabled={loading}>
            {loading ? "Loading..." : "Generate Text"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Image Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label>Seed (optional)</Label>
              <Input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Enter seed for reproducibility"
              />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="nologo"
                checked={nologo}
                onChange={(e) => setNologo(e.target.checked)}
              />
              <Label htmlFor="nologo">No Logo</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="privateImage"
                checked={privateImage}
                onChange={(e) => setPrivateImage(e.target.checked)}
              />
              <Label htmlFor="privateImage">Private</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enhance"
                checked={enhance}
                onChange={(e) => setEnhance(e.target.checked)}
              />
              <Label htmlFor="enhance">Enhance Prompt</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="safe"
                checked={safe}
                onChange={(e) => setSafe(e.target.checked)}
              />
              <Label htmlFor="safe">Safe Mode</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="transparent"
                checked={transparent}
                onChange={(e) => setTransparent(e.target.checked)}
              />
              <Label htmlFor="transparent">Transparent Background</Label>
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

      <Card>
        <CardHeader>
          <CardTitle>Voice Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alloy">Alloy</SelectItem>
                  <SelectItem value="echo">Echo</SelectItem>
                  <SelectItem value="fable">Fable</SelectItem>
                  <SelectItem value="onyx">Onyx</SelectItem>
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="shimmer">Shimmer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Textarea
            placeholder="Enter your text to convert to speech..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex gap-4">
            <Button onClick={handleVoiceGeneration} disabled={loading}>
              {loading ? "Generating..." : "Generate Voice"}
            </Button>
            {voiceAudio && (
              <Button
                variant="outline"
                onClick={handlePlayPause}
                className="flex items-center gap-2"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Play
                  </>
                )}
              </Button>
            )}
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
