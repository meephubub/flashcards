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
export async function getFeatureExtractor(modelName?: string) {
  // Dynamically import to keep this strictly client-side
  const { pipeline, env } = await import('@xenova/transformers');

  // Configure environment for browser
  if (!(env as any).configured) {
    env.allowLocalModels = false; // Use remote models for better caching in browser
    env.allowRemoteModels = true;

    // Point ONNX wasm assets to our public/wasm path if needed
    // (We already ship ONNX wasm in public/wasm/ per repo.)
    try {
      // Some versions use nested config objects; guard accesses
      const wasmPaths: any = (env.backends?.onnx?.wasm as any);
      if (wasmPaths && typeof wasmPaths === 'object') {
        // If not already set by the library, set a default base path
        if (!wasmPaths.wasmPaths) {
          wasmPaths.wasmPaths = '/wasm/';
        }
      }
    } catch (_) {
      // best-effort only
    }

    (env as any).configured = true;
  }

  // Configure execution provider based on WebGL availability
  if (isWebGLAvailable && (env as any).set) {
    env.set('XENOVA_ONNX_EXECUTION_PROVIDERS', ['webgl']);
    console.log('[xenova-similarity] WebGL backend enabled for ONNX execution');
  } else {
    console.log('[xenova-similarity] WebGL not available, using CPU backend');
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
}

/** Spellcheck a string against a reference string. */
export function spellcheckAnswer(input: string, reference: string): string {
  if (!input || !reference) return input;

  const inputLower = input.toLowerCase().trim();
  const referenceLower = reference.toLowerCase().trim();

  if (inputLower === referenceLower) return input;

  const inputWords = inputLower.split(/\s+/);
  const referenceWords = referenceLower.split(/\s+/);

  if (Math.abs(inputWords.length - referenceWords.length) > 2) return input;

  const correctedWords = inputWords.map((inputWord) => {
    let closestWord = inputWord;
    let minDistance = Infinity;
    for (const refWord of referenceWords) {
      const dist = levenshteinDistance(inputWord, refWord);
      const maxAllowedDistance = Math.max(1, Math.floor(refWord.length / 4));
      if (dist < minDistance && dist <= maxAllowedDistance) {
        minDistance = dist;
        closestWord = refWord;
      }
    }
    return closestWord;
  });

  const correctedInput = correctedWords.join(' ');
  if (correctedInput !== inputLower) {
    console.log(`[spellcheck] Corrected "${inputLower}" to "${correctedInput}"`);
  }
  return correctedInput;
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
