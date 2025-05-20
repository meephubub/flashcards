import { pipeline } from "@xenova/transformers";
let extractor:
  | ((input: string | string[], options?: any) => Promise<any>)
  | null = null;

/**
 * Get or initialize the feature extractor pipeline.
 */
export async function getFeatureExtractor() {
  if (!extractor) {
    console.log("[xenova-similarity] Initializing feature extractor...");
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

    console.log(
      "[xenova-similarity] Feature extractor initialized:",
      typeof extractor,
    );
  }
  return extractor;
}

/**
 * Get a normalized sentence embedding for a given sentence.
 * @param sentence - The input sentence to encode.
 * @returns A Float32Array representing the sentence embedding.
 */
export async function getSentenceEmbedding(
  sentence: string,
): Promise<Float32Array> {
  if (typeof sentence !== "string" || !sentence.trim()) {
    throw new Error(
      "[xenova-similarity] Invalid input: sentence must be a non-empty string",
    );
  }
  const extractor = await getFeatureExtractor();
  if (!extractor || typeof extractor !== "function") {
    throw new Error(
      "[xenova-similarity] Extractor is not initialized or not a function",
    );
  }
  // Always pass an array of sentences, as per HuggingFace docs
  const output = await extractor([sentence], {
    pooling: "mean",
    normalize: true,
  });
  if (!output || !output.data) {
    throw new Error("[xenova-similarity] Output or output.data is undefined");
  }
  // output.data is a Float32Array of shape [1, 384] for a single sentence
  // Return the first row only
  if (output.dims && output.dims.length === 2 && output.dims[0] === 1) {
    const size = output.dims[1];
    return output.data.slice(0, size);
  }
  // Fallback: If dims are not present, assume data is the embedding
  return output.data as Float32Array;
}

/**
 * Compute the cosine similarity between two vectors.
 * @param a - First vector.
 * @param b - Second vector.
 * @returns Cosine similarity value between -1 and 1.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
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
