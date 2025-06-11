interface GenerateImageResponse {
  data: Array<{
    b64_json: string;
  }>;
}

export type ImageModel = "flux" | "turbo" | "gptimage";

export async function generateImage(prompt: string, model: ImageModel = "flux"): Promise<GenerateImageResponse> {
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