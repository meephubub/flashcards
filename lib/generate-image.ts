interface GenerateImageResponse {
  data: Array<{
    b64_json: string;
  }>;
}

export async function generateImage(prompt: string): Promise<GenerateImageResponse> {
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
    throw new Error(`Failed to generate image: ${response.statusText}`);
  }

  return response.json();
} 