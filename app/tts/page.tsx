"use client";

import { useState } from "react";

export default function TTSTestPage() {
  const [text, setText] = useState("Life is like a box of chocolates. You never know what you're gonna get.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioObj, setAudioObj] = useState<any>(null);
  const [audioProps, setAudioProps] = useState<any>([]);
  const [backend, setBackend] = useState<'wasm' | 'webgpu'>('wasm');

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    setAudioObj(null);
    setAudioProps(null);
    try {
      // Set ONNX_WASM_PATH for browser
      if (typeof window !== "undefined") {
        (window.globalThis as any).ONNX_WASM_PATH = "/wasm/";
      }
      // Dynamically import KokoroTTS and TextSplitterStream only on client
      const { KokoroTTS, TextSplitterStream } = await import("kokoro-js");
      const model_id = "onnx-community/Kokoro-82M-ONNX";
      // Set WASM path for ONNX if needed
      (window as any).globalThis = window.globalThis || window;
      (window as any).ONNX_WASM_PATH = "/wasm/";
      // Load model with backend
      const tts = await KokoroTTS.from_pretrained(model_id, { dtype: "fp32", device: backend });
      // Set up the stream
      const splitter = new TextSplitterStream();
      // Set voice in stream options
      const stream = tts.stream(splitter, { voice: "af_sky" });
      // Defensive tokenization
      const tokens = text.match(/\s*\S+/g) ?? [];
      // Start streaming and collecting audio chunks
      // Helper: encode Float32Array PCM to WAV (mono, 24kHz)
      function encodeWAV(float32Samples: Float32Array, sampleRate: number): Uint8Array {
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * bitsPerSample / 8;
        const blockAlign = numChannels * bitsPerSample / 8;
        const buffer = new ArrayBuffer(44 + float32Samples.length * 2);
        const view = new DataView(buffer);
        // Write WAV header
        function writeString(offset: number, str: string) {
          for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        }
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + float32Samples.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // PCM chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeString(36, 'data');
        view.setUint32(40, float32Samples.length * 2, true);
        // Write PCM samples
        let offset = 44;
        for (let i = 0; i < float32Samples.length; i++, offset += 2) {
          let s = Math.max(-1, Math.min(1, float32Samples[i]));
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return new Uint8Array(buffer);
      }
      let errorDuringStream = null;
      let i = 0;
      let debugLog = "";
      let sampleRate = 24000; // default, will update from chunk if present
      // Queue for sequential playback
      let lastAudioPromise: Promise<void> = Promise.resolve();
      const streamPromise = (async () => {
        try {
          for await (const chunk of stream) {
            console.log("Kokoro stream chunk:", chunk);
            debugLog += `Chunk #${i}: ${JSON.stringify(chunk)}\n`;
            // Log RawAudio object and its keys
            const audioKeys = chunk.audio ? Object.keys(chunk.audio) : [];
            console.log("RawAudio keys:", audioKeys);
            console.log("RawAudio object:", chunk.audio);
            debugLog += `RawAudio keys: ${JSON.stringify(audioKeys)}\n`;
            debugLog += `RawAudio object: ${JSON.stringify(chunk.audio)}\n`;
            let pcm: Float32Array | null = null;
            // Extract PCM samples and sample rate from RawAudio
            if (chunk.audio && chunk.audio.audio && chunk.audio.sampling_rate) {
              pcm = chunk.audio.audio;
              sampleRate = chunk.audio.sampling_rate;
            }
            if (pcm) {
              // Encode this chunk to WAV
              const wavData = encodeWAV(pcm, sampleRate);
              const wavBlob = new Blob([wavData], { type: "audio/wav" });
              const url = URL.createObjectURL(wavBlob);
              // Queue playback: wait for previous chunk to finish
              lastAudioPromise = lastAudioPromise.then(() => {
                return new Promise<void>((resolve) => {
                  const audioElem = new Audio(url);
                  audioElem.onended = () => {
                    URL.revokeObjectURL(url);
                    resolve();
                  };
                  audioElem.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve();
                  };
                  audioElem.play();
                });
              });
            }
            i++;
          }
        } catch (err) {
          errorDuringStream = err;
          debugLog += `STREAM ERROR: ${err?.message || err}\n`;
          console.error("Kokoro stream error:", err);
        }
      })();
      // Feed tokens into the stream
      for (const token of tokens) {
        splitter.push(token);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      splitter.close();
      await streamPromise;
      setAudioObj(debugLog);
      setAudioProps([]);
      if (errorDuringStream) throw errorDuringStream;
      // No need to concatenate chunks; each chunk is played in real time.
      setAudioUrl(null);
      if (errorDuringStream) throw errorDuringStream;
      // If no chunks were played, show error
      if (i === 0) {
        setError("No audio chunks received from Kokoro stream. Check console and debug log below.");
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", padding: 20, border: "1px solid #ccc", borderRadius: 12 }}>
      <h2>Kokoro TTS Test Page</h2>
      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 12 }}>
          <input
            type="radio"
            name="backend"
            value="wasm"
            checked={backend === "wasm"}
            onChange={() => setBackend("wasm")}
          />
          WASM
        </label>
        <label>
          <input
            type="radio"
            name="backend"
            value="webgpu"
            checked={backend === "webgpu"}
            onChange={() => setBackend("webgpu")}
          />
          WebGPU
        </label>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        style={{ width: "100%", marginBottom: 12 }}
      />
      <button onClick={handleGenerate} disabled={loading} style={{ padding: "8px 16px", fontSize: 16 }}>
        {loading ? "Generating..." : "Generate Speech"}
      </button>
      {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}
      {audioUrl && (
        <div style={{ marginTop: 20 }}>
          <audio controls src={audioUrl} />
        </div>
      )}
      {audioObj && (
        <pre style={{ fontSize: 12, marginTop: 16, background: "#f9f9f9", padding: 8 }}>
          {JSON.stringify(audioProps, null, 2)}
        </pre>
      )}
    </div>
  );
}
