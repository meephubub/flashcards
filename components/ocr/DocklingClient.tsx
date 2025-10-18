"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"

export interface DocklingClientProps {
  imageUrl?: string | null
  onMarkdown: (md: string) => void
}

export default function DocklingClient({ imageUrl, onMarkdown }: DocklingClientProps) {
  const [loadingModel, setLoadingModel] = useState(false)
  const [canRun, setCanRun] = useState(false)
  const [html, setHtml] = useState<string>("")
  const [markdown, setMarkdown] = useState<string>("")
  const [imgSrc, setImgSrc] = useState<string>("")
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [backend, setBackend] = useState<"webgpu" | "wasm" | null>(null)
  const [tryingFallback, setTryingFallback] = useState<boolean>(false)
  const [running, setRunning] = useState<boolean>(false)
  const [preset, setPreset] = useState<"fast" | "quality">("fast")
  const [streamChars, setStreamChars] = useState<number>(0)
  const cancelFlagRef = useRef<boolean>(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const processorRef = useRef<any>(null)
  const modelRef = useRef<any>(null)
  const progressMapRef = useRef<Record<string, { loaded: number; total: number }>>({})
  const [progressPercent, setProgressPercent] = useState<number>(0)

  const ensureModel = useCallback(async () => {
    if (processorRef.current && modelRef.current) return
    setLoadingModel(true)
    setProgressPercent(0)
    progressMapRef.current = {}
    const transformersUrl = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5"
    try {
      const { AutoProcessor, AutoModelForVision2Seq }: any = await (0, eval)(`import("${transformersUrl}")`)
      const model_id = "onnx-community/granite-docling-258M-ONNX"
      const processor = await AutoProcessor.from_pretrained(model_id)

      const wantWebGPU = typeof (globalThis as any).navigator !== 'undefined' && !!(navigator as any).gpu
      if (wantWebGPU) {
        try {
          const model = await AutoModelForVision2Seq.from_pretrained(model_id, {
            dtype: { embed_tokens: "fp16", vision_encoder: "fp32", decoder_model_merged: "fp32" },
            device: "webgpu",
            progress_callback: (data: any) => {
              try {
                if (data?.status === "progress" && typeof data.loaded === 'number' && typeof data.total === 'number') {
                  const fileKey = String(data.file || Math.random())
                  progressMapRef.current[fileKey] = { loaded: data.loaded, total: data.total }
                  const entries = Object.values(progressMapRef.current)
                  if (entries.length > 0) {
                    const sumLoaded = entries.reduce((s, v) => s + (v.loaded || 0), 0)
                    const sumTotal = entries.reduce((s, v) => s + (v.total || 0), 0)
                    const pct = sumTotal > 0 ? Math.round((sumLoaded / sumTotal) * 100) : 0
                    setProgressPercent(pct)
                  }
                }
              } catch {}
            },
          })
          processorRef.current = processor
          modelRef.current = model
          setBackend("webgpu")
          setProgressPercent(100)
        } catch (gpuErr: any) {
          // WebGPU failed (e.g., dxil.dll issue). Try WASM fallback.
          setErrorMsg(String(gpuErr?.message || gpuErr) || "Failed to initialize WebGPU backend.")
          setTryingFallback(true)
          const model = await AutoModelForVision2Seq.from_pretrained(model_id, {
            dtype: { embed_tokens: "fp16", vision_encoder: "fp32", decoder_model_merged: "fp32" },
            device: "wasm",
          })
          processorRef.current = processor
          modelRef.current = model
          setBackend("wasm")
        }
      } else {
        // No WebGPU in this browser, use WASM directly
        const model = await AutoModelForVision2Seq.from_pretrained(model_id, {
          dtype: { embed_tokens: "fp16", vision_encoder: "fp32", decoder_model_merged: "fp32" },
          device: "wasm",
        })
        processorRef.current = processor
        modelRef.current = model
        setBackend("wasm")
      }
    } catch (e) {
      // fallthrough
      console.error('Model load failed', e)
      setErrorMsg(String((e as any)?.message || e) || 'Unknown error while loading model')
    } finally {
      // Always hide loading bar to prevent stuck 100%
      setLoadingModel(false)
      // Clear progress shortly after to reset UI
      setTimeout(() => { setProgressPercent(0); progressMapRef.current = {} }, 300)
      setTryingFallback(false)
    }
  }, [])

  const loadImage = useCallback((src: string) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      setImgSrc(src)
      setCanRun(true)
    }
    img.onerror = () => {
      setCanRun(false)
    }
    img.src = src
    imgRef.current = img
  }, [])

  useEffect(() => {
    let revokeUrl: string | null = null
    const run = async () => {
      if (!imageUrl) return
      try {
        ensureModel().catch(() => {})
        const res = await fetch(imageUrl)
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
        const blob = await res.blob()
        const obj = URL.createObjectURL(blob)
        revokeUrl = obj
        loadImage(obj)
      } catch (e: any) {
        setErrorMsg(String(e?.message || e) || 'Failed to load image for OCR')
      }
    }
    run()
    return () => { if (revokeUrl) URL.revokeObjectURL(revokeUrl) }
  }, [imageUrl, ensureModel, loadImage])

  const onChooseFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      loadImage(String(reader.result || ""))
    }
    reader.readAsDataURL(f)
  }, [loadImage])

  const runOcr = useCallback(async () => {
    if (!imgRef.current) { setErrorMsg('Please select an image first.'); return }
    setErrorMsg('')
    setRunning(true)
    setStreamChars(0)
    cancelFlagRef.current = false
    try {
      await ensureModel()
      if (!processorRef.current || !modelRef.current) {
        throw new Error('Model is not ready. Please retry.')
      }

      const transformersUrl = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5"
      const { RawImage, TextStreamer }: any = await (0, eval)(`import("${transformersUrl}")`)

      const parserUrl = `${location.origin}/dockling/parser.js`
      const { doclingToHtml }: any = await (0, eval)(`import("${parserUrl}")`)

      const canvas = canvasRef.current || document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      let w = (imgRef.current.naturalWidth || imgRef.current.width)
      let h = (imgRef.current.naturalHeight || imgRef.current.height)
      // Downscale for speed depending on preset
      const maxSide = preset === 'fast' ? 1600 : 2800
      const scale = Math.min(1, maxSide / Math.max(w, h))
      if (scale < 1) { w = Math.round(w * scale); h = Math.round(h * scale) }
      canvas.width = w
      canvas.height = h
      ctx?.drawImage(imgRef.current, 0, 0, w, h)

      const raw = RawImage.fromCanvas(canvas)
      const messages = [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: 'Convert this page to docling.' }] }]
      const text = processorRef.current.apply_chat_template(messages, { add_generation_prompt: true })
      const inputs = await processorRef.current(text, [raw], { do_image_splitting: preset !== 'fast' })

      let full = ''
      await modelRef.current.generate({
        ...inputs,
        max_new_tokens: preset === 'fast' ? 1024 : 3072,
        streamer: new TextStreamer(processorRef.current.tokenizer, {
          skip_prompt: true,
          skip_special_tokens: false,
          callback_function: (t: string) => {
            if (cancelFlagRef.current) return
            full += t
            setStreamChars((c) => c + t.length)
          },
        })
      })
      full = full.replace(/<\|end_of_text\|>$/, '')
      const htmlOut = doclingToHtml(full)
      setHtml(htmlOut)

      const turndownUrl = 'https://cdn.jsdelivr.net/npm/turndown@7.2.0/dist/turndown.es.js'
      const TurndownService: any = (await (0, eval)(`import("${turndownUrl}")`)).default
      const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
      const doc = new DOMParser().parseFromString(htmlOut, 'text/html')
      const body = doc.querySelector('body')
      const md = turndown.turndown(body || htmlOut)
      setMarkdown(md)
    } catch (e: any) {
      setErrorMsg(String(e?.message || e) || 'Failed to run OCR')
    } finally {
      setRunning(false)
    }
  }, [ensureModel])

  const sendMarkdown = useCallback(() => {
    if (!markdown) return
    onMarkdown(markdown)
  }, [markdown, onMarkdown])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b p-2">
        <strong>Granite Docling OCR</strong>
        <span className="text-sm text-muted-foreground">Load an image to convert to HTML, then Markdown.</span>
        {backend && (
          <span className="ml-2 text-xs text-muted-foreground">backend: {backend}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as any)}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Preset" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fast">Fast</SelectItem>
              <SelectItem value="quality">Quality</SelectItem>
            </SelectContent>
          </Select>
          <Input ref={fileRef} type="file" accept="image/*" onChange={onChooseFile} className="w-56"/>
          <Button onClick={() => runOcr()} disabled={loadingModel || running || !canRun}>
            {loadingModel ? 'Loading model…' : (running ? 'Processing…' : 'Run OCR')}
          </Button>
          {running && (
            <Button variant="outline" onClick={() => { cancelFlagRef.current = true; setRunning(false) }}>Stop</Button>
          )}
          <Button onClick={sendMarkdown} disabled={!markdown}>Send Markdown</Button>
        </div>
      </div>
      {loadingModel && progressPercent < 100 && (
        <div className="border-b p-2">
          <div className="flex items-center gap-2 text-sm mb-1">
            <span>Loading model…</span>
            <span className="ml-auto tabular-nums">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} />
        </div>
      )}
      {!!errorMsg && (
        <div className="border-b p-3 text-sm">
          <div className="font-medium mb-1">Model backend error</div>
          <div className="text-red-600 dark:text-red-400 whitespace-pre-wrap break-words mb-2">{errorMsg}</div>
          <div className="text-muted-foreground mb-2">
            If you see dxil.dll / WebGPU errors on Windows:
          </div>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground mb-2">
            <li>Update your GPU drivers (NVIDIA/AMD/Intel).</li>
            <li>Enable WebGPU in chrome://flags or edge://flags and restart.</li>
            <li>Install Windows “Graphics Tools” optional feature (adds DXIL compiler).</li>
            <li>If WebGPU is unavailable, the app automatically falls back to WASM (slower).</li>
          </ul>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setErrorMsg(""); void ensureModel() }} disabled={loadingModel}>Retry</Button>
            {backend !== 'wasm' && (
              <Button variant="secondary" onClick={async () => {
                try {
                  setLoadingModel(true)
                  const { AutoProcessor, AutoModelForVision2Seq }: any = await (0, eval)(`import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5")`)
                  const model_id = "onnx-community/granite-docling-258M-ONNX"
                  const model = await AutoModelForVision2Seq.from_pretrained(model_id, { device: 'wasm' })
                  // reuse existing processor if present, otherwise load
                  if (!processorRef.current) {
                    processorRef.current = await AutoProcessor.from_pretrained(model_id)
                  }
                  modelRef.current = model
                  setBackend('wasm')
                  setErrorMsg('')
                } catch (e) {
                  setErrorMsg(String((e as any)?.message || e) || 'Fallback to WASM failed')
                } finally {
                  setLoadingModel(false)
                }
              }} disabled={loadingModel || tryingFallback}>Force CPU/WASM</Button>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 flex-1 overflow-hidden">
        <div className="border rounded-md overflow-auto">
          <div className="p-2 font-medium border-b">Image</div>
          <div className="p-2">
            {imgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgSrc} alt="ocr" className="max-w-full h-auto" />
            ) : (
              <div className="text-sm text-muted-foreground">No image loaded</div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 overflow-hidden">
          <div className="border rounded-md overflow-hidden flex-1">
            <div className="p-2 font-medium border-b">HTML</div>
            <iframe title="html-preview" className="w-full h-full" srcDoc={html} />
          </div>
          <div className="border rounded-md overflow-hidden flex-1">
            <div className="p-2 font-medium border-b">Markdown {running && streamChars > 0 ? <span className="text-xs text-muted-foreground">({streamChars} chars)</span> : null}</div>
            <textarea className="w-full h-full p-2 text-sm" value={markdown} onChange={(e) => setMarkdown(e.target.value)} />
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
