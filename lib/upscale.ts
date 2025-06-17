import { Backend } from "@/app/test-ai/upscale/page";
import { Tensor } from "onnxruntime-web";

// --- IndexedDB Caching ---
const DB_NAME = 'ModelCacheDB';
const STORE_NAME = 'ModelStore';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(new Error("Failed to open IndexedDB. Caching will be disabled."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getFromDb(key: string): Promise<ArrayBuffer | undefined> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error("IndexedDB get failed:", error);
    return undefined; // If DB fails, proceed without cache
  }
}

async function setToDb(key: string, value: ArrayBuffer): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error("IndexedDB set failed:", error);
  }
}

export interface UpscalerCallbacks {
  onStatusChange?: (message: string) => void;
  onInitialize?: (width: number, height: number) => void;
  onTile?: (tile: ImageData, x: number, y: number) => void;
  onGfpganResult?: (imageData: ImageData) => void;
  onComplete?: (inferenceTime: number) => void;
  onError?: (error: any) => void;
}

export class Upscaler {
  private worker: Worker;
  private callbacks: UpscalerCallbacks;
  private modelBuffers: { esrgan?: ArrayBuffer, gfpgan?: ArrayBuffer } = {};
  private modelsSentToWorker = false;

  constructor(callbacks: UpscalerCallbacks) {
    this.callbacks = callbacks;
    this.worker = new Worker(new URL("./upscale.worker.ts", import.meta.url));
    this.worker.onmessage = this.onWorkerMessage.bind(this);
    this.worker.onerror = (error) => this.callbacks.onError?.(error);
    this.loadModels();
  }

  private async loadModels(): Promise<void> {
    this.callbacks.onStatusChange?.("Checking model cache...");
    try {
      this.modelBuffers.esrgan = await this.loadModel(
        'esrgan-v1',
        'https://huggingface.co/Meeperomi/RealESRGAN_x4-onnx/resolve/main/RealESRGAN_x4.onnx?download=true',
        'Real-ESRGAN (~25 MB)',
      );
      this.modelBuffers.gfpgan = await this.loadModel(
        'gfpgan-v1.4',
        'https://huggingface.co/Meeperomi/GFPGANv1.4-onnx/resolve/main/GFPGANv1.4.onnx?download=true',
        'GFPGAN (~330 MB)',
      );

      this.callbacks.onStatusChange?.("All models loaded. Ready to upscale.");
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      console.error(error);
    }
  }

  private async loadModel(dbKey: string, url: string, displayName: string): Promise<ArrayBuffer> {
    const cachedModel = await getFromDb(dbKey);
    if (cachedModel) {
      this.callbacks.onStatusChange?.(`${displayName} model loaded from cache.`);
      return cachedModel;
    }

    this.callbacks.onStatusChange?.(`Downloading ${displayName}...`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${displayName}: ${response.statusText}`);
    }
    const modelBuffer = await response.arrayBuffer();
    
    // Store in the DB for next time. The DB operation creates its own copy.
    await setToDb(dbKey, modelBuffer);

    this.callbacks.onStatusChange?.(`${displayName} downloaded and cached.`);
    return modelBuffer;
  }

  upscale(imageData: ImageData, backend: Backend, useGfpgan: boolean): void {
    if (!this.modelBuffers.esrgan || !this.modelBuffers.gfpgan) {
      this.callbacks.onError?.(new Error("Models not loaded yet. Please wait until initialization is complete."));
      return;
    }

    if (this.modelsSentToWorker) {
      this.worker.postMessage({
        imageData,
        backend,
        useGfpgan,
      }, [imageData.data.buffer]);
    } else if (this.modelBuffers.esrgan && this.modelBuffers.gfpgan) {
      this.worker.postMessage({
        imageData,
        modelBuffers: this.modelBuffers,
        backend,
        useGfpgan,
      }, [imageData.data.buffer, this.modelBuffers.esrgan, this.modelBuffers.gfpgan]);
      this.modelsSentToWorker = true;
      this.modelBuffers = {};
    }
  }

  private onWorkerMessage(event: MessageEvent): void {
    const { type, success, error, message, width, height, tile, x, y, inferenceTime, imageData } = event.data;

    switch (type) {
      case 'status':
        this.callbacks.onStatusChange?.(message);
        break;
      case 'initialize':
        this.callbacks.onInitialize?.(width, height);
        break;
      case 'tile':
        this.callbacks.onTile?.(tile, x, y);
        break;
      case 'gfpgan_result':
        this.callbacks.onGfpganResult?.(imageData);
        break;
      case 'complete':
        if (success) {
          this.callbacks.onComplete?.(inferenceTime);
        } else {
          this.callbacks.onError?.(new Error(error || 'Unknown completion error'));
        }
        break;
      case 'result': // For handling errors from the catch block in worker
        if (!success) {
          this.callbacks.onError?.(new Error(error));
        }
        break;
      default:
        console.warn('Unknown message type from worker:', type);
    }
  }

  terminate(): void {
    this.worker.terminate();
  }
}

// Helper function to load an image from a URL
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Important for loading images from other origins (like Together AI)
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Helper function to convert image data to a tensor [1, 3, H, W]
function imageDataToTensor(imageData: ImageData): Tensor {
  const { data, width, height } = imageData;
  const red = [], green = [], blue = [];
  
  // Separate color channels and normalize to [0, 1]
  for (let i = 0; i < data.length; i += 4) {
    red.push(data[i] / 255);
    green.push(data[i + 1] / 255);
    blue.push(data[i + 2] / 255);
  }

  const float32Data = new Float32Array([...red, ...green, ...blue]);
  const inputTensor = new Tensor("float32", float32Data, [1, 3, height, width]);
  return inputTensor;
}

// Helper function to convert a tensor [1, 3, H, W] back to ImageData
function tensorToImageData(tensor: Tensor, width: number, height: number): ImageData {
    const float32Data = tensor.data as Float32Array;
    const [r, g, b] = new Array(3).fill(0).map((_, i) => 
        float32Data.subarray(i * width * height, (i + 1) * width * height)
    );

    const clampedData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; ++i) {
        const j = i * 4;
        clampedData[j] = (r[i] * 255);
        clampedData[j + 1] = (g[i] * 255);
        clampedData[j + 2] = (b[i] * 255);
        clampedData[j + 3] = 255; // Alpha channel
    }

    return new ImageData(clampedData, width, height);
} 