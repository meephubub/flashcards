"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upscaler } from "@/lib/upscale";
import Link from "next/link";
import { InfoIcon } from "lucide-react";

export type Backend = "webgpu" | "wasm";

export default function UpscaleTestPage() {
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [gfpganImageUrl, setGfpganImageUrl] = useState<string | null>(null);
  const [upscaledImageUrl, setUpscaledImageUrl] = useState<string | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [upscaleStats, setUpscaleStats] = useState<{ time: number; inferenceTime: number; } | null>(null);
  const [backend, setBackend] = useState<Backend>("wasm");
  const [useGfpgan, setUseGfpgan] = useState(false);
  const originalImageDataRef = useRef<ImageData | null>(null);
  const upscalerRef = useRef<Upscaler | null>(null);
  const upscaleStartTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setStatusLog(prev => ["Initializing..."]);
    // Instantiate upscaler on client-side mount
    upscalerRef.current = new Upscaler({
      onStatusChange: (message) => {
        setStatusLog(prevLog => [...prevLog, message]);
        if (message.includes("All models loaded")) {
          setIsModelReady(true);
        }
      },
      onInitialize: (width, height) => {
        // Create a canvas to draw tiles on
        const canvas = canvasRef.current ?? document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvasRef.current = canvas;
        setUpscaledImageUrl(canvas.toDataURL('image/png')); // Show blank canvas
      },
      onTile: (tile, x, y) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(tile, x, y);
          // Update the image src to show the new tile.
          // This can be slow, a more optimized approach might update less frequently.
          setUpscaledImageUrl(canvas.toDataURL('image/png'));
        }
      },
      onGfpganResult: (imageData) => {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(imageData, 0, 0);
          setGfpganImageUrl(canvas.toDataURL('image/png'));
        }
      },
      onComplete: (inferenceTime) => {
        setStatusLog(prevLog => [...prevLog, "Upscaling complete!"]);
        const endTime = performance.now();
        setUpscaleStats({ time: endTime - upscaleStartTimeRef.current, inferenceTime });
        setIsUpscaling(false);
      },
      onError: (err) => {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
        console.error("Upscaler Error:", err);
        setError(errorMessage);
        setStatusLog(prev => prev.filter(s => s !== 'Initializing...'));
        setIsUpscaling(false);
        setIsModelReady(false); // Assume model is broken if an error occurs
      }
    });

    return () => {
      // Cleanup worker when component unmounts
      upscalerRef.current?.terminate();
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        setOriginalImageUrl(imageUrl);
        setUpscaledImageUrl(null);
        setGfpganImageUrl(null);
        setError(null);
        setUpscaleStats(null);
        setStatusLog([]);

        // Load image to canvas to get ImageData
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            originalImageDataRef.current = ctx.getImageData(0, 0, img.width, img.height);
          }
        };
        img.src = imageUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpscale = async () => {
    if (!originalImageDataRef.current || !upscalerRef.current) return;
    
    setIsUpscaling(true);
    setError(null);
    setUpscaleStats(null);
    setUpscaledImageUrl(null);
    setGfpganImageUrl(null);
    setStatusLog([]);
    upscaleStartTimeRef.current = performance.now();
    
    upscalerRef.current.upscale(originalImageDataRef.current, backend, useGfpgan);
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="flex justify-start">
        <Button asChild variant="outline">
          <Link href="/test-ai">← Back to AI Tests</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Client-Side Image Upscaling Test</CardTitle>
          <CardDescription>
            This tool uses the Real-ESRGAN model to upscale images directly in your browser.
            You can also optionally enable GFPGAN for face restoration before upscaling.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="image-upload">1. Upload an Image</Label>
                <Input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backend-select">2. Choose a Backend</Label>
                <Select value={backend} onValueChange={(value) => setBackend(value as Backend)}>
                  <SelectTrigger id="backend-select">
                    <SelectValue placeholder="Select backend" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wasm">WASM (CPU) - Recommended</SelectItem>
                    <SelectItem value="webgpu">WebGPU (GPU) - Experimental</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch id="gfpgan-switch" checked={useGfpgan} onCheckedChange={setUseGfpgan} disabled={!isModelReady || isUpscaling}/>
                <Label htmlFor="gfpgan-switch">Use GFPGAN (Face Restoration)</Label>
              </div>
              <div className="flex items-start text-xs text-gray-500 p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <InfoIcon className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                  <span>GFPGAN is a large model (~330MB) that will be downloaded. It runs before upscaling to improve faces. For this model, WASM is often faster than WebGPU.</span>
              </div>
            </div>
          </div>
          
          <div>
            <Button onClick={handleUpscale} disabled={!originalImageUrl || isUpscaling || !isModelReady}>
              {isUpscaling ? "Upscaling..." : !isModelReady ? "Models Loading..." : "3. Upscale Image"}
            </Button>
          </div>

          {(isUpscaling || (!isModelReady && !error)) && statusLog.length > 0 && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-md">
               <div className="flex items-center mb-2">
                 <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
                 <p className="font-semibold text-blue-800 dark:text-blue-200">
                  {isUpscaling ? "Processing..." : "Initializing Models..."}
                 </p>
               </div>
               <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300 list-disc list-inside">
                  {statusLog.map((status, index) => (
                    <li key={index}>{status}</li>
                  ))}
               </ul>
            </div>
          )}

          {error && (
            <div className="p-4 text-red-500 bg-red-50 rounded-md">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}

          {upscaleStats && !isUpscaling && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <h3 className="text-sm font-medium mb-2">Upscale Statistics</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Total Time:</span>
                  <span className="ml-2 font-mono">{upscaleStats.time.toFixed(2)}ms</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Inference Time:</span>
                  <span className="ml-2 font-mono">{upscaleStats.inferenceTime.toFixed(2)}ms</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {originalImageUrl && (
              <Card>
                <CardHeader><CardTitle>Original</CardTitle></CardHeader>
                <CardContent>
                  <img src={originalImageUrl} alt="Original" className="w-full h-auto rounded-md" />
                </CardContent>
              </Card>
            )}
            {gfpganImageUrl && (
              <Card>
                <CardHeader><CardTitle>GFPGAN Result</CardTitle></CardHeader>
                <CardContent>
                  <img src={gfpganImageUrl} alt="GFPGAN Restored" className="w-full h-auto rounded-md" />
                </CardContent>
              </Card>
            )}
            {upscaledImageUrl && (
              <Card>
                <CardHeader><CardTitle>Upscaled Result</CardTitle></CardHeader>
                <CardContent>
                  <img src={upscaledImageUrl} alt="Upscaled" className="w-full h-auto rounded-md" />
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 