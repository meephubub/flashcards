import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio'; // Import cheerio
import { pipeline, env } from '@huggingface/transformers';

// Configure environment for better performance
env.allowLocalModels = false; // Use remote models for better caching
env.allowRemoteModels = true;

// Initialize the feature extractor pipeline globally to reuse it across requests
let extractor: any | null = null;
const modelName = "Xenova/nomic-embed-text-v1"; // A good balance of speed and quality

async function getOrInitExtractor() {
  if (!extractor) {
    console.log(`[websearch-scrape] Initializing feature extractor for model: ${modelName}...`);
    try {
      extractor = await pipeline("feature-extraction", modelName);
      console.log(`[websearch-scrape] Feature extractor initialized for model: ${modelName}`);
    } catch (error) {
      console.error(`[websearch-scrape] Failed to initialize model ${modelName}:`, error);
      throw error;
    }
  }
  return extractor;
}

/**
 * Compute the cosine similarity between two vectors.
 * @param a - First vector.
 * @param b - Second vector.
 * @returns Cosine similarity value between -1 and 1.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

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

    // Step 3: Split text into chunks (e.g., sentences or paragraphs)
    // For simplicity, splitting by double newline to get paragraphs
    const paragraphs = textContent.split(/\n\s*\n/g).filter(p => p.trim().length > 0);

    if (paragraphs.length === 0) {
      return NextResponse.json({ message: 'No readable content found on the page.' }, { status: 200 });
    }

    // Initialize the extractor
    const extractorInstance = await getOrInitExtractor();

    // Step 4: Generate embedding for the prompt
    const promptOutput = await extractorInstance([prompt], {
      pooling: "mean",
      normalize: true,
    });
    const promptEmbedding = promptOutput.data as Float32Array;

    let bestMatch = null;
    let highestSimilarity = -1;

    // Step 5: Iterate through paragraphs, generate embeddings, and find the best match
    for (const paragraph of paragraphs) {
      const paragraphOutput = await extractorInstance([paragraph], {
        pooling: "mean",
        normalize: true,
      });
      const paragraphEmbedding = paragraphOutput.data as Float32Array;
      const similarity = cosineSimilarity(promptEmbedding, paragraphEmbedding);

      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = paragraph;
      }
    }

    if (bestMatch) {
      return NextResponse.json({ answer: bestMatch, similarity: highestSimilarity }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'No relevant answer found.' }, { status: 200 });
    }

  } catch (error: any) {
    console.error('Error in web search scrape API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
