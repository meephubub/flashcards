import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio'; // Import cheerio

// Configure environment for better performance
// env.allowLocalModels = false; // Use remote models for better caching
// env.allowRemoteModels = true;

// Initialize the feature extractor pipeline globally to reuse it across requests
// let extractor: any | null = null;
// const modelName = "Xenova/nomic-embed-text-v1"; // A good balance of speed and quality

// async function getOrInitExtractor() {
//   if (!extractor) {
//     console.log(`[websearch-scrape] Initializing feature extractor for model: ${modelName}...`);
//     try {
//       extractor = await pipeline("feature-extraction", modelName);
//       console.log(`[websearch-scrape] Feature extractor initialized for model: ${modelName}`);
//     } catch (error) {
//       console.error(`[websearch-scrape] Failed to initialize model ${modelName}:`, error);
//       throw error;
//     }
//   }
//   return extractor;
// }

/**
 * Compute the cosine similarity between two vectors.
 * @param a - First vector.
 * @param b - Second vector.
 * @returns Cosine similarity value between -1 and 1.
 */
// function cosineSimilarity(a: Float32Array, b: Float32Array): number {
//   let dot = 0.0;
//   let normA = 0.0;
//   let normB = 0.0;
//   for (let i = 0; i < a.length; i++) {
//     dot += a[i] * b[i];
//     normA += a[i] * a[i];
//     normB += b[i] * b[i];
//   }
//   if (normA === 0 || normB === 0) return 0;
//   return dot / (Math.sqrt(normA) * Math.sqrt(normB));
// }

export async function POST(request: Request) {
  try {
    const { url, prompt } = await request.json();

    if (!url || !prompt) {
      return NextResponse.json({ error: 'URL and prompt are required' }, { status: 400 });
    }

    // Step 1: Scrape the web page content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    const htmlContent = await response.text();

    // Step 2: Extract meaningful text using cheerio
    const $ = cheerio.load(htmlContent);
    // Remove script and style elements to clean up the text
    $('script, style').remove();
    const textContent = $('body').text().replace(/\s\s+/g, ' ').trim(); // Replace multiple spaces with single and trim

    if (textContent.length === 0) {
      return NextResponse.json({ message: 'No readable content found on the page.' }, { status: 200 });
    }

    // Step 3: Use Groq to extract content based on the prompt
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not set in environment variables' }, { status: 500 });
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that extracts information from text based on a given prompt.' },
          { role: 'user', content: `From the following text, extract the most relevant information related to the prompt: "${prompt}".\n\nText: ${textContent}` },
        ],
        temperature: 0.1, // Keep it low for extraction tasks
        max_tokens: 1000, // Adjust as needed
      }),
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json();
      throw new Error(`Groq API error: ${groqResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const groqData = await groqResponse.json();
    const extractedContent = groqData.choices[0]?.message?.content?.trim();

    if (extractedContent) {
      return NextResponse.json({ answer: extractedContent }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'No relevant answer found by Groq.' }, { status: 200 });
    }

  } catch (error: any) {
    console.error('Error in web search scrape API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
