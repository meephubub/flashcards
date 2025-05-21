// Utility to fetch API keys from environment variables

export async function getGroqApiKey() {
  return process.env.GROQ_API_KEY || '';
}
