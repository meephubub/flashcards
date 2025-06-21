import { pipeline, env } from "@xenova/transformers";

// Import a lightweight spell checker
import { distance as levenshteinDistance } from 'fastest-levenshtein';

// Configure environment for better performance
env.allowLocalModels = false; // Use remote models for better caching
env.allowRemoteModels = true;

// Check if WebGL is available and configure accordingly
const isWebGLAvailable = (() => {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && 
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
})();

// Check if running on mobile device
const isMobileDevice = (() => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 
    'windows phone', 'mobile', 'tablet'
  ];
  
  return mobileKeywords.some(keyword => userAgent.includes(keyword)) ||
         (window.innerWidth <= 768 && window.innerHeight <= 1024);
})();

// Model selection based on device type
const getDefaultModel = () => {
  if (isMobileDevice) {
    // Use a smaller, faster model for mobile devices
    return "Xenova/all-MiniLM-L6-v2"; // ~80MB, good balance of speed and quality
  }
  // Use the larger, more accurate model for desktop
  return "Xenova/nomic-embed-text-v1"; // ~140MB, higher quality embeddings
};

// Configure execution provider based on WebGL availability
if (isWebGLAvailable) {
  env.backends.onnx.wasm.executionProviders = ['webgl'];
  console.log('[xenova-similarity] WebGL backend enabled for ONNX execution');
} else {
  console.log('[xenova-similarity] WebGL not available, using CPU backend');
}

console.log(`[xenova-similarity] Device: ${isMobileDevice ? 'Mobile' : 'Desktop'}, WebGL: ${isWebGLAvailable ? 'Available' : 'Not available'}`);

const extractorCache: {
  [model: string]: ((input: string | string[], options?: any) => Promise<any>) | null;
} = {};

/**
 * Get or initialize the feature extractor pipeline for a specific model.
 * @param modelName - The name of the model to use (auto-selects based on device if not specified).
 */
export async function getFeatureExtractor(modelName?: string) {
  const selectedModel = modelName || getDefaultModel();
  
  if (!extractorCache[selectedModel]) {
    console.log(`[xenova-similarity] Initializing feature extractor for model: ${selectedModel}...`);
    console.log(`[xenova-similarity] Using ${isWebGLAvailable ? 'WebGL' : 'CPU'} backend`);
    console.log(`[xenova-similarity] Device type: ${isMobileDevice ? 'Mobile' : 'Desktop'}`);
    
    try {
      extractorCache[selectedModel] = await pipeline("feature-extraction", selectedModel, {
        quantized: true, // Use quantized models for better performance
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            console.log(`[xenova-similarity] Loading model: ${Math.round(progress.progress * 100)}%`);
          }
        }
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

/**
 * Clear the model cache to free up memory.
 * @param modelName - Optional specific model to clear, otherwise clears all models.
 */
export function clearModelCache(modelName?: string) {
  if (modelName) {
    if (extractorCache[modelName]) {
      console.log(`[xenova-similarity] Clearing cache for model: ${modelName}`);
      extractorCache[modelName] = null;
    }
  } else {
    console.log('[xenova-similarity] Clearing all model caches');
    Object.keys(extractorCache).forEach(key => {
      extractorCache[key] = null;
    });
  }
}

/**
 * Get information about cached models and WebGL availability.
 */
export function getModelInfo() {
  const cachedModels = Object.keys(extractorCache).filter(key => extractorCache[key] !== null);
  return {
    webglAvailable: isWebGLAvailable,
    isMobileDevice,
    defaultModel: getDefaultModel(),
    cachedModels,
    cacheSize: cachedModels.length
  };
}

/**
 * Preload a model to ensure it's cached and ready for use.
 * @param modelName - The name of the model to preload (auto-selects based on device if not specified).
 */
export async function preloadModel(modelName?: string) {
  const selectedModel = modelName || getDefaultModel();
  console.log(`[xenova-similarity] Preloading model: ${selectedModel}`);
  await getFeatureExtractor(selectedModel);
  console.log(`[xenova-similarity] Model preloaded: ${selectedModel}`);
}

/** 
 * Get a normalized sentence embedding for a given sentence. 
 * @param sentence - The input sentence to encode. 
 * @param modelName - The name of the model to use (auto-selects based on device if not specified). 
 * @returns A Float32Array representing the sentence embedding. 
 */ 
export async function getSentenceEmbedding(
  sentence: string,
  modelName?: string,
): Promise<Float32Array> {
  if (typeof sentence !== "string" || !sentence.trim()) {
    throw new Error(
      "[xenova-similarity] Invalid input: sentence must be a non-empty string",
    );
  }
  const extractor = await getFeatureExtractor(modelName);

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
 * Spellcheck a string against a reference string.
 * @param input - The input string to spellcheck
 * @param reference - The reference string to check against
 * @returns The corrected string if minor spelling errors were found, or the original input
 */
export function spellcheckAnswer(input: string, reference: string): string {
  if (!input || !reference) return input;
  
  // Convert both strings to lowercase for comparison
  const inputLower = input.toLowerCase().trim();
  const referenceLower = reference.toLowerCase().trim();
  
  // If the strings are already identical (ignoring case), return the input
  if (inputLower === referenceLower) return input;
  
  // Split the strings into words
  const inputWords = inputLower.split(/\s+/);
  const referenceWords = referenceLower.split(/\s+/);
  
  // If the word counts are very different, don't attempt correction
  if (Math.abs(inputWords.length - referenceWords.length) > 2) return input;
  
  // Try to correct each word in the input
  const correctedWords = inputWords.map(inputWord => {
    // Find the closest word in the reference
    let closestWord = inputWord;
    let minDistance = Infinity;
    
    for (const refWord of referenceWords) {
      // Use simple Levenshtein distance calculation
      const dist = levenshteinDistance(inputWord, refWord);
      
      // If the distance is small enough (based on word length), consider it a spelling error
      const maxAllowedDistance = Math.max(1, Math.floor(refWord.length / 4));
      
      if (dist < minDistance && dist <= maxAllowedDistance) {
        minDistance = dist;
        closestWord = refWord;
      }
    }
    
    return closestWord;
  });
  
  // Join the corrected words back into a string
  const correctedInput = correctedWords.join(' ');
  
  // Log the correction if it was made
  if (correctedInput !== inputLower) {
    console.log(`[spellcheck] Corrected "${inputLower}" to "${correctedInput}"`);
  }
  
  return correctedInput;
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
