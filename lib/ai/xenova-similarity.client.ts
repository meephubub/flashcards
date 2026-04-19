"use client";

// Import a lightweight spell checker
import { distance as levenshteinDistance } from 'fastest-levenshtein';

// Check if WebGL is available and configure accordingly (safe for SSR)
const isWebGLAvailable = (() => {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      (window as any).WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
})();

// Lightweight fallback: hashed bag-of-words embedding (module scope)
function computeFallbackEmbedding(text: string, dim = 512): Float32Array {
  const vec = new Float32Array(dim);
  const tokens = tokenizeText(text);
  for (const t of tokens) {
    const h = djb2(t);
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] = vec[i] / norm;
  return vec;
}

function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return hash;
}

// Check if running on mobile device (guarded)
const isMobileDevice = (() => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry',
    'windows phone', 'mobile', 'tablet'
  ];
  return (
    mobileKeywords.some((keyword) => userAgent.includes(keyword)) ||
    ((window.innerWidth || 0) <= 768 && (window.innerHeight || 0) <= 1024)
  );
})();

// Model selection based on device type
const getDefaultModel = () => {
  if (isMobileDevice) {
    // Use a smaller, faster model for mobile devices
    return 'Xenova/all-MiniLM-L6-v2';
  }
  // Use the larger, more accurate model for desktop
  return 'Xenova/nomic-embed-text-v1';
};

const extractorCache: {
  [model: string]: ((input: string | string[], options?: any) => Promise<any>) | null;
} = {};

/**
 * Get or initialize the feature extractor pipeline for a specific model.
 * Ensures we only load browser-compatible assets.
 */
// Internal helper to load a browser-first Transformers implementation
async function loadTransformers(): Promise<{ pipeline: any; env: any }> {
  // Use Hugging Face Transformers.js which is designed for browsers
  const mod: any = await import('@huggingface/transformers');
  if (!mod?.pipeline || !mod?.env) {
    throw new Error('[xenova-similarity] Failed to load @huggingface/transformers');
  }
  return mod as any;
}

export async function getFeatureExtractor(modelName?: string) {
  // Dynamically import to keep this strictly client-side
  if (typeof window === 'undefined') {
    throw new Error('[xenova-similarity] Must be called in the browser');
  }
  const { pipeline, env } = await loadTransformers();

  // Configure environment for browser
  if (!(env as any).configured) {
    env.allowLocalModels = false; // Use remote models for better caching in browser
    env.allowRemoteModels = true;
    // Prefer using the browser cache for model files
    (env as any).useBrowserCache = true;

    // Point ONNX wasm assets to our public/wasm path
    try {
      const onnx = (env as any).backends?.onnx;
      if (onnx && typeof onnx === 'object') {
        if (onnx.wasm && typeof onnx.wasm === 'object') {
          // Ensure .wasm files are fetched from /wasm/
          (onnx.wasm as any).wasmPaths = '/wasm/';
          // Proactively set proxy loader if available in our public assets
          (onnx.wasm as any).proxy = '/wasm/ort-wasm-simd-threaded.mjs';
          // Optional tuning
          (onnx.wasm as any).numThreads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4)));
          (onnx.wasm as any).simd = true;
        }
      }
    } catch (_) {
      // best-effort only
    }

    (env as any).configured = true;
  }

  // Configure execution provider based on WebGL availability
  if ((env as any).set) {
    if (isWebGLAvailable) {
      env.set('XENOVA_ONNX_EXECUTION_PROVIDERS', ['webgl']);
      console.log('[xenova-similarity] WebGL backend enabled for ONNX execution');
    } else {
      env.set('XENOVA_ONNX_EXECUTION_PROVIDERS', ['wasm']);
      console.log('[xenova-similarity] WebGL not available, using WASM CPU backend');
    }
  }

  const selectedModel = modelName || getDefaultModel();
  if (!extractorCache[selectedModel]) {
    console.log(`[xenova-similarity] Initializing feature extractor for model: ${selectedModel}...`);
    console.log(`[xenova-similarity] Using ${isWebGLAvailable ? 'WebGL' : 'CPU'} backend`);
    console.log(`[xenova-similarity] Device type: ${isMobileDevice ? 'Mobile' : 'Desktop'}`);
    try {
      extractorCache[selectedModel] = await pipeline('feature-extraction', selectedModel, {
        quantized: true,
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            console.log(`[xenova-similarity] Loading model: ${Math.round(progress.progress * 100)}%`);
          }
        },
      });
      console.log(
        `[xenova-similarity] Feature extractor initialized for model: ${selectedModel}:`,
        typeof extractorCache[selectedModel],
      );
    } catch (error) {
      console.error(`[xenova-similarity] Failed to initialize model ${selectedModel}:`, error);
      throw error;
    }
  }
  return extractorCache[selectedModel]!;
}

/** Clear the model cache to free up memory. */
export function clearModelCache(modelName?: string) {
  if (modelName) {
    if (extractorCache[modelName]) {
      console.log(`[xenova-similarity] Clearing cache for model: ${modelName}`);
      extractorCache[modelName] = null;
    }
  } else {
    console.log('[xenova-similarity] Clearing all model caches');
    Object.keys(extractorCache).forEach((key) => {
      extractorCache[key] = null;
    });
  }
}

/** Get information about cached models and WebGL availability. */
export function getModelInfo() {
  const cachedModels = Object.keys(extractorCache).filter((key) => extractorCache[key] !== null);
  return {
    webglAvailable: isWebGLAvailable,
    isMobileDevice,
    defaultModel: getDefaultModel(),
    cachedModels,
    cacheSize: cachedModels.length,
  };
}

/** Preload a model to ensure it's cached and ready for use. */
export async function preloadModel(modelName?: string) {
  const selectedModel = modelName || getDefaultModel();
  console.log(`[xenova-similarity] Preloading model: ${selectedModel}`);
  await getFeatureExtractor(selectedModel);
  console.log(`[xenova-similarity] Model preloaded: ${selectedModel}`);
}

/** 
 * Get a normalized sentence embedding for a given sentence. 
 */
export async function getSentenceEmbedding(
  sentence: string,
  modelName?: string,
): Promise<Float32Array> {
  if (typeof sentence !== 'string' || !sentence.trim()) {
    throw new Error('[xenova-similarity] Invalid input: sentence must be a non-empty string');
  }
  try {
    const extractor = await getFeatureExtractor(modelName);
    if (!extractor || typeof extractor !== 'function') {
      throw new Error('[xenova-similarity] Extractor is not initialized or not a function');
    }
    // Always pass an array of sentences, as per HuggingFace docs
    const output = await extractor([sentence], {
      pooling: 'mean',
      normalize: true,
    });
    if (!output || !output.data) {
      throw new Error('[xenova-similarity] Output or output.data is undefined');
    }
    // output.data is a Float32Array of shape [1, 384] for a single sentence
    // Return the first row only
    if (output.dims && output.dims.length === 2 && output.dims[0] === 1) {
      const size = output.dims[1];
      return (output.data as Float32Array).slice(0, size);
    }
    // Fallback: If dims are not present, assume data is the embedding
    return output.data as Float32Array;
  } catch (err) {
    console.warn('[xenova-similarity] Model embedding failed, using lightweight fallback embedding.', err);
    return computeFallbackEmbedding(sentence);
  }
}

/** 
 * Normalize Spanish text for comparison - handle common variations
 */
export function normalizeSpanish(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Remove accent marks for more lenient matching
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Normalize punctuation
    .replace(/[¿¡]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Handle common contractions/possessives
    .replace(/\bdel\b/g, 'de el')
    .replace(/\bal\b/g, 'a el');
}

/**
 * Check if answer contains key Spanish articles that should match
 */
function hasMatchingArticles(input: string, reference: string): boolean {
  const articles = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'];
  const inputArticles = articles.filter(a => input.includes(` ${a} `) || input.startsWith(`${a} `));
  const refArticles = articles.filter(a => reference.includes(` ${a} `) || reference.startsWith(`${a} `));
  
  // If reference has articles, input should have at least one matching
  if (refArticles.length > 0 && inputArticles.length === 0) {
    return false;
  }
  return true;
}

/** 
 * Spellcheck a string against a reference string or multiple reference strings.
 * Returns the best-matched version against all references.
 */
export function spellcheckAnswer(input: string, reference: string | string[]): string {
  if (!input) return input;
  
  // Handle multiple valid answers (e.g., "coche, carro, auto")
  const references = Array.isArray(reference) ? reference : reference.split(/,|;|\/|\|/);
  const normalizedRefs = references.map(r => normalizeSpanish(r.trim())).filter(Boolean);
  
  if (normalizedRefs.length === 0) return input;
  
  const inputLower = normalizeSpanish(input);
  
  // Check exact match first
  for (const ref of normalizedRefs) {
    if (inputLower === ref) return input;
  }
  
  // Try spellchecking against each reference and pick best result
  let bestResult = input;
  let bestScore = -1;
  
  for (const referenceLower of normalizedRefs) {
    const inputWords = inputLower.split(/\s+/);
    const referenceWords = referenceLower.split(/\s+/);
    
    // Word count tolerance: allow difference up to 2 words or 30%
    const wordCountDiff = Math.abs(inputWords.length - referenceWords.length);
    const wordCountTolerance = Math.max(2, Math.floor(referenceWords.length * 0.3));
    
    if (wordCountDiff > wordCountTolerance) continue;
    
    const correctedWords = inputWords.map((inputWord) => {
      let closestWord = inputWord;
      let minDistance = Infinity;
      for (const refWord of referenceWords) {
        const dist = levenshteinDistance(inputWord, refWord);
        // More lenient for Spanish: allow up to 40% of word length
        const maxAllowedDistance = Math.max(1, Math.floor(refWord.length * 0.4));
        if (dist < minDistance && dist <= maxAllowedDistance) {
          minDistance = dist;
          closestWord = refWord;
        }
      }
      return closestWord;
    });
    
    const correctedInput = correctedWords.join(' ');
    // Score based on how many words were corrected
    const corrections = correctedWords.filter((w, i) => w !== inputWords[i]).length;
    const score = -corrections; // Fewer corrections = higher score
    
    if (score > bestScore) {
      bestScore = score;
      bestResult = correctedInput === inputLower ? input : correctedInput;
    }
  }
  
  if (bestResult !== input && bestResult !== normalizeSpanish(input)) {
    console.log(`[spellcheck] Corrected "${input}" to "${bestResult}"`);
  }
  return bestResult;
}

/**
 * Get the best similarity score against multiple valid answers
 */
export async function getBestSimilarity(
  userAnswer: string,
  validAnswers: string[],
  modelName?: string
): Promise<{ score: number; matchedAnswer: string; isCorrect: boolean }> {
  const normalizedUser = normalizeSpanish(userAnswer);
  const normalizedAnswers = validAnswers.map(a => normalizeSpanish(a.trim())).filter(Boolean);
  
  let bestScore = 0;
  let bestMatch = normalizedAnswers[0] || '';
  
  // Get embeddings for all
  const userEmbedding = await getSentenceEmbedding(normalizedUser, modelName);
  
  for (const answer of normalizedAnswers) {
    const answerEmbedding = await getSentenceEmbedding(answer, modelName);
    const score = cosineSimilarity(userEmbedding, answerEmbedding);
    
    // Bonus for keyword overlap
    const userWords = new Set(normalizedUser.split(/\s+/));
    const answerWords = new Set(answer.split(/\s+/));
    const overlap = [...userWords].filter(w => answerWords.has(w)).length;
    const overlapBonus = overlap / Math.max(userWords.size, answerWords.size) * 0.1;
    
    const finalScore = score + overlapBonus;
    
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMatch = answer;
    }
  }
  
  // Adaptive threshold based on answer length
  const wordCount = normalizedUser.split(/\s+/).length;
  const threshold = wordCount <= 2 ? 0.7 : 0.75;
  
  return {
    score: bestScore,
    matchedAnswer: bestMatch,
    isCorrect: bestScore >= threshold
  };
}

/** Compute the cosine similarity between two vectors. */
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
