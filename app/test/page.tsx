"use client";
import React, { useState } from "react";
import {
  getSentenceEmbedding,
  cosineSimilarity,
} from "../actions/xenova-similarity";

export default function XenovaSimilarityTestPage() {
  const [sentenceA, setSentenceA] = useState("");
  const [sentenceB, setSentenceB] = useState("");
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [embeddingA, setEmbeddingA] = useState<Float32Array | null>(null);
  const [embeddingB, setEmbeddingB] = useState<Float32Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompare() {
    setLoading(true);
    setError(null);
    setSimilarity(null);
    setEmbeddingA(null);
    setEmbeddingB(null);
    try {
      const embA = await getSentenceEmbedding(sentenceA);
      const embB = await getSentenceEmbedding(sentenceB);
      setEmbeddingA(embA);
      setEmbeddingB(embB);
      const sim = cosineSimilarity(embA, embB);
      setSimilarity(sim);
    } catch (err: any) {
      setError(err.message || "Error computing similarity");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "2rem auto",
        padding: 24,
        border: "1px solid #eee",
        borderRadius: 8,
      }}
    >
      <h2>Xenova Similarity Test</h2>
      <div style={{ marginBottom: 16 }}>
        <label>
          Sentence A:
          <input
            type="text"
            value={sentenceA}
            onChange={(e) => setSentenceA(e.target.value)}
            style={{ width: "100%", marginTop: 4 }}
            disabled={loading}
          />
        </label>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>
          Sentence B:
          <input
            type="text"
            value={sentenceB}
            onChange={(e) => setSentenceB(e.target.value)}
            style={{ width: "100%", marginTop: 4 }}
            disabled={loading}
          />
        </label>
      </div>
      <button
        onClick={handleCompare}
        disabled={loading || !sentenceA || !sentenceB}
      >
        {loading ? "Computing..." : "Compare Similarity"}
      </button>
      {error && <div style={{ color: "red", marginTop: 12 }}>{error}</div>}
      {similarity !== null && (
        <div style={{ marginTop: 20 }}>
          <strong>Cosine Similarity:</strong> {similarity.toFixed(4)}
        </div>
      )}
      {embeddingA && embeddingB && (
        <details style={{ marginTop: 16 }}>
          <summary>Show Embeddings (debug)</summary>
          <div>
            <div>
              <strong>Embedding A:</strong> [
              {Array.from(embeddingA)
                .slice(0, 10)
                .map((v) => v.toFixed(4))
                .join(", ")}{" "}
              ...]
            </div>
            <div>
              <strong>Embedding B:</strong> [
              {Array.from(embeddingB)
                .slice(0, 10)
                .map((v) => v.toFixed(4))
                .join(", ")}{" "}
              ...]
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
