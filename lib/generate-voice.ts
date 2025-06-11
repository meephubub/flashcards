import { getProxyUrl } from './proxy';

export interface VoiceGenerationOptions {
  prompt: string;
  voice?: string;
}

export async function generateVoice({ prompt, voice = 'alloy' }: VoiceGenerationOptions): Promise<Blob> {
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://text.pollinations.ai/${encodedPrompt}?model=openai-audio&voice=${voice}`;
    const proxyUrl = getProxyUrl(url);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'audio/mpeg',
      },
    });

    if (!response.ok) {
      throw new Error(`Voice generation failed: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error('Error generating voice:', error);
    throw error;
  }
} 