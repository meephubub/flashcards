interface GenerateImageResponse {
  data: Array<{
    b64_json: string;
  }>;
}

export type ImageModel = "flux" | "turbo" | "gptimage" | "together" | "dall-e-3" | "sdxl-1.0" | "sdxl-l" | "sdxl-turbo" | "sd-3.5-large" | "flux-pro" | "flux-dev" | "flux-schnell" | "flux-canny" | "midjourney";

export async function generateImage(prompt: string, model: ImageModel = "flux"): Promise<GenerateImageResponse> {
  if (model === "together") {
    const apiKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
    if (!apiKey) {
      throw new Error("NEXT_PUBLIC_TOGETHER_API_KEY is not defined in environment variables");
    }

    const response = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell-Free",
        prompt: prompt,
        steps: 1,
        n: 1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
    }

    const result = await response.json();
    return {
      data: [{
        b64_json: result.data[0].url
      }]
    };
  }

  // Use render endpoint for gptimage and other advanced models
  const advancedModels = ["gptimage", "dall-e-3", "sdxl-1.0", "sdxl-l", "sdxl-turbo", "sd-3.5-large", "flux-pro", "flux-dev", "flux-schnell", "flux-canny", "midjourney"];
  
  if (advancedModels.includes(model)) {
    const response = await fetch("https://flashcards-api-mhmd.onrender.com/v1/images/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        model: model,
        response_format: "url"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
    }

    const result = await response.json();
    const generatedImageUrl = result.url || result.data?.[0]?.url;
    if (!generatedImageUrl) {
      throw new Error("No image URL found in response");
    }

    // Convert URL to base64 for consistency with the existing interface
    const imageResponse = await fetch(generatedImageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch generated image: ${imageResponse.statusText}`);
    }

    const blob = await imageResponse.blob();
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve({
          data: [{
            b64_json: base64data.split(',')[1] // Remove the data URL prefix
          }]
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Use direct pollinations API for basic models (flux, turbo)
  const apiKey = process.env.NEXT_PUBLIC_POLLINATIONS_API;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_POLLINATIONS_API is not defined in environment variables");
  }

  const params = new URLSearchParams({
    model,
    width: "1024",
    height: "1024",
    nologo: "false",
    private: "false",
    enhance: "false",
    safe: "false",
    transparent: "false",
    api_key: apiKey,
  });

  const endpoint = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;

  try {
    // Try using allorigins.win as a CORS proxy
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`;
    
    const response = await fetch(proxyUrl, {
      method: "GET",
      headers: {
        "Accept": "image/*",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve({
          data: [{
            b64_json: base64data.split(',')[1] // Remove the data URL prefix
          }]
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
} 