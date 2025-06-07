export interface ImageGenerationResult {
  data: Array<{
    b64_json: string;
    revised_prompt?: string;
  }>;
  model: string;
  provider: string;
  created: number;
}

export async function generateImage(prompt: string): Promise<ImageGenerationResult> {
  try {
    const response = await fetch("https://raspberrypi.unicorn-deneb.ts.net/api/v1/images/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        model: "flux",
        response_format: "b64_json"
      }),
    });

    if (!response.ok) {
      throw new Error(`Image generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
} 