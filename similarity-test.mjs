import { pipeline } from "@huggingface/transformers";

async function main() {
  try {
    console.log("Loading feature extractor...");
    const extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      {
        modelType: "onnx",
        backend: "onnxruntime-node",
      },
    );
    console.log("Extracting embedding...");
    const output = await extractor("This is a test sentence.", {
      pooling: "mean",
      normalize: true,
    });

    console.log("Embedding output:", output.data);
    console.log("Embedding length:", output.data.length);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
