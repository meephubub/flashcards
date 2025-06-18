import { InferenceSession, Tensor } from "onnxruntime-web";
import { Backend } from "@/app/test-ai/upscale/page";

let esrganSession: InferenceSession | null = null;
let gfpganSession: InferenceSession | null = null;
let currentBackend: Backend | null = null;
let localModelBuffers: { esrgan?: ArrayBuffer, gfpgan?: ArrayBuffer } | null = null;

// Listen for messages from the main thread
self.onmessage = async (event) => {
  const { imageData, modelBuffers, backend, useGfpgan, useRealEsrgan } = event.data;

  try {
    // If model buffers are provided (on first call), store them locally.
    if (modelBuffers) {
      localModelBuffers = modelBuffers;
    }

    // Create new sessions if the backend has changed or sessions don't exist.
    if (backend !== currentBackend) {
      currentBackend = backend;
      const options = {
        executionProviders: [backend],
        executionProviderOptions: { webgpu: { powerPreference: 'high-performance' } }
      };

      // Initialize Real-ESRGAN if needed
      if (useRealEsrgan && localModelBuffers?.esrgan && (!esrganSession || backend !== currentBackend)) {
        self.postMessage({ type: 'status', message: `Initializing Real-ESRGAN with ${backend.toUpperCase()}...` });
        esrganSession = await InferenceSession.create(localModelBuffers.esrgan, options);
        self.postMessage({ type: 'status', message: `Real-ESRGAN initialized.` });
      }

      // Initialize GFPGAN if needed
      if (useGfpgan && localModelBuffers?.gfpgan && (!gfpganSession || backend !== currentBackend)) {
        self.postMessage({ type: 'status', message: `Initializing GFPGAN with ${backend.toUpperCase()}...` });
        gfpganSession = await InferenceSession.create(localModelBuffers.gfpgan, options);
        self.postMessage({ type: 'status', message: `GFPGAN initialized.` });
      }
    }
    
    let imageToProcess = imageData;
    let totalInferenceTime = 0;

    // Step 1: Run GFPGAN if requested
    if (useGfpgan) {
      if (!gfpganSession) {
        throw new Error("GFPGAN session is not initialized but was requested.");
      }
      self.postMessage({ type: 'status', message: 'Running face restoration with GFPGAN...' });
      const gfpganStartTime = performance.now();

      const originalWidth = imageToProcess.width;
      const originalHeight = imageToProcess.height;

      // 1. Resize input to 512x512 for GFPGAN
      const resizedForGfpgan = resizeImageData(imageToProcess, 512, 512);

      // 2. Run GFPGAN inference
      const gfpganInputTensor = imageDataToTensor(resizedForGfpgan);
      const gfpganFeeds = { [gfpganSession.inputNames[0]]: gfpganInputTensor };
      const gfpganResults = await gfpganSession.run(gfpganFeeds);
      const gfpganOutputTensor = gfpganResults[gfpganSession.outputNames[0]];
      if (!gfpganOutputTensor) {
        throw new Error("GFPGAN model execution failed to return an output tensor.");
      }
      
      // 3. Convert GFPGAN output tensor (512x512) to ImageData
      const gfpganOutputImageData = tensorToImageData(gfpganOutputTensor, 512, 512);

      // 4. Resize GFPGAN output back to original dimensions
      imageToProcess = resizeImageData(gfpganOutputImageData, originalWidth, originalHeight);
      
      // Post the GFPGAN result back to the main thread for display
      self.postMessage({
        type: 'gfpgan_result',
        imageData: imageToProcess
      });

      const gfpganTime = performance.now() - gfpganStartTime;
      totalInferenceTime += gfpganTime;
      self.postMessage({ type: 'status', message: `GFPGAN finished in ${gfpganTime.toFixed(0)}ms.` });
    }
    
    // Step 2: Run Real-ESRGAN if requested
    if (useRealEsrgan) {
      if (!esrganSession) {
        throw new Error("Real-ESRGAN session is not initialized but was requested.");
      }
      await upscaleAndStreamTiles(esrganSession, imageToProcess, totalInferenceTime);
    } else {
      // If only GFPGAN was used, send completion message
      self.postMessage({ type: 'complete', success: true, inferenceTime: totalInferenceTime });
    }

  } catch (error) {
    const errorMessage = error instanceof Error 
      ? `Error in ${currentBackend?.toUpperCase() || 'processing'} backend: ${error.message}`
      : "An unknown error occurred";
    self.postMessage({ type: 'result', success: false, error: errorMessage });
    esrganSession = gfpganSession = null; // Reset sessions on error
    currentBackend = null;
    localModelBuffers = null;
  }
};

function resizeImageData(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData {
  // Create an OffscreenCanvas to draw the original image data.
  const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) throw new Error("Could not get OffscreenCanvas context for source");
  sourceCtx.putImageData(imageData, 0, 0);

  // Create another OffscreenCanvas for the resized result.
  const destCanvas = new OffscreenCanvas(targetWidth, targetHeight);
  const destCtx = destCanvas.getContext('2d');
  if (!destCtx) throw new Error("Could not get OffscreenCanvas context for destination");

  // Draw the original canvas onto the destination canvas, resizing it in the process.
  destCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  return destCtx.getImageData(0, 0, targetWidth, targetHeight);
}

const TILE_SIZE = 256; // The dimension of the square tile for processing

async function upscaleAndStreamTiles(
  session: InferenceSession,
  imageData: ImageData,
  totalInferenceTime: number
): Promise<void> {
  const scale = 4;
  const outputWidth = imageData.width * scale;
  const outputHeight = imageData.height * scale;

  // 1. Send initialization message with final dimensions
  self.postMessage({
    type: 'initialize',
    width: outputWidth,
    height: outputHeight,
  });

  const numTilesX = Math.ceil(imageData.width / TILE_SIZE);
  const numTilesY = Math.ceil(imageData.height / TILE_SIZE);
  const totalTiles = numTilesX * numTilesY;
  let processedTiles = 0;

  for (let y = 0; y < numTilesY; y++) {
    for (let x = 0; x < numTilesX; x++) {
      const tileX = x * TILE_SIZE;
      const tileY = y * TILE_SIZE;
      const tileWidth = Math.min(TILE_SIZE, imageData.width - tileX);
      const tileHeight = Math.min(TILE_SIZE, imageData.height - tileY);

      const tileImageData = extractTile(imageData, tileX, tileY, tileWidth, tileHeight);
      
      const inputTensor = imageDataToTensor(tileImageData);
      const feeds = { [session.inputNames[0]]: inputTensor };

      const t0 = performance.now();
      const results = await session.run(feeds);
      const inferenceTime = performance.now() - t0;
      totalInferenceTime += inferenceTime;

      const outputTensor = results[session.outputNames[0]];
      if (!outputTensor) {
        throw new Error("Model execution failed to return an output tensor.");
      }
      const upscaledTile = tensorToImageData(outputTensor, tileWidth * scale, tileHeight * scale);
      
      processedTiles++;
      self.postMessage({ type: 'status', message: `Upscaling tile ${processedTiles} of ${totalTiles}...` });
      
      // 2. Post each tile as it's completed
      self.postMessage({
          type: 'tile',
          tile: upscaledTile,
          x: tileX * scale,
          y: tileY * scale,
      }, [upscaledTile.data.buffer] as any);
    }
  }

  // 3. Send a final completion message with statistics
  self.postMessage({ type: 'complete', success: true, inferenceTime: totalInferenceTime });
}

// Extracts a rectangular tile from a larger ImageData
function extractTile(source: ImageData, x: number, y: number, width: number, height: number): ImageData {
  const tileData = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    const sourceStartIndex = ((y + row) * source.width + x) * 4;
    const tileStartIndex = row * width * 4;
    const rowData = source.data.subarray(sourceStartIndex, sourceStartIndex + width * 4);
    tileData.set(rowData, tileStartIndex);
  }
  return new ImageData(tileData, width, height);
}

// Pastes a smaller ImageData (tile) into a larger one at a specified offset
function pasteTile(destination: ImageData, tile: ImageData, x: number, y: number): void {
  for (let row = 0; row < tile.height; row++) {
    const destStartIndex = ((y + row) * destination.width + x) * 4;
    const tileStartIndex = row * tile.width * 4;
    const rowData = tile.data.subarray(tileStartIndex, tileStartIndex + tile.width * 4);
    destination.data.set(rowData, destStartIndex);
  }
}

// --- Helper functions (same as before) ---
function imageDataToTensor(imageData: ImageData): Tensor {
  const { data, width, height } = imageData;
  const red: number[] = [], green: number[] = [], blue: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    red.push(data[i] / 255);
    green.push(data[i + 1] / 255);
    blue.push(data[i + 2] / 255);
  }
  const float32Data = new Float32Array([...red, ...green, ...blue]);
  return new Tensor("float32", float32Data, [1, 3, height, width]);
}

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
    clampedData[j + 3] = 255;
  }
  return new ImageData(clampedData, width, height);
} 