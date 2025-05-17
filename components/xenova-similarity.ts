// xenova-similarity.ts
import { pipeline } from '@xenova/transformers'

let extractor: any = null

export async function getFeatureExtractor() {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', '/models/Xenova/all-MiniLM-L6-v2');
  }
  return extractor
}

export async function getSentenceEmbedding(sentence: string): Promise<Float32Array> {
  const extractor = await getFeatureExtractor()
  const output = await extractor(sentence, { pooling: 'mean', normalize: true })
  return output.data as Float32Array
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0.0
  let normA = 0.0
  let normB = 0.0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
