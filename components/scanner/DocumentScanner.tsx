"use client"

import React, { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Loader2, Camera, Trash2, Save, FileImage, FileText } from "lucide-react"

interface DocumentScannerProps {
  onClose: () => void
  onSaveJpeg: (blob: Blob) => Promise<void> | void
  onSavePdf: (blob: Blob) => Promise<void> | void
}

export default function DocumentScanner({ onClose, onSaveJpeg, onSavePdf }: DocumentScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [streamReady, setStreamReady] = useState(false)
  const [pages, setPages] = useState<string[]>([])
  const [autoCrop, setAutoCrop] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let currentStream: MediaStream | null = null
    const start = async () => {
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream
          await videoRef.current.play().catch(() => {})
          setStreamReady(true)
        }
      } catch (e) {
        console.error("Camera init failed", e)
      }
    }
    void start()
    return () => {
      try {
        currentStream?.getTracks().forEach(t => t.stop())
      } catch {}
    }
  }, [])

  const capture = async () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    const canvas = canvasRef.current || document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)

    let dataUrl = canvas.toDataURL("image/jpeg", 0.92)

    if (autoCrop) {
      try {
        const cropped = await tryAutoCrop(dataUrl)
        if (cropped) dataUrl = cropped
      } catch (e) {
        console.warn("Auto-crop failed, using original frame", e)
      }
    }

    setPages(prev => [...prev, dataUrl])
  }

  const removePage = (idx: number) => {
    setPages(prev => prev.filter((_, i) => i !== idx))
  }

  const saveAsJpeg = async () => {
    if (pages.length === 0) return
    setBusy(true)
    try {
      const res = await fetch(pages[0])
      const blob = await res.blob()
      await onSaveJpeg(blob)
      onClose()
    } catch (e) {
      console.error("Save JPEG failed", e)
    } finally {
      setBusy(false)
    }
  }

  const saveAsPdf = async () => {
    if (pages.length === 0) return
    setBusy(true)
    try {
      // Lazy import to avoid bundling/types if not installed yet
      const pdfLib: any = await import(/* webpackIgnore: true */ "pdf-lib").catch(() => null)
      if (!pdfLib) {
        throw new Error("pdf-lib not installed. Install with pnpm add pdf-lib")
      }
      const { PDFDocument, StandardFonts } = pdfLib
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      for (const url of pages) {
        const imgBytes = await (await fetch(url)).arrayBuffer()
        let img
        if (url.startsWith("data:image/png")) {
          img = await pdfDoc.embedPng(imgBytes)
        } else {
          img = await pdfDoc.embedJpg(imgBytes)
        }
        const page = pdfDoc.addPage([img.width, img.height])
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
      }
      const bytes = await pdfDoc.save()
      await onSavePdf(new Blob([bytes], { type: "application/pdf" }))
      onClose()
    } catch (e) {
      console.error("Save PDF failed", e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch id="autocrop" checked={autoCrop} onCheckedChange={setAutoCrop} />
          <Label htmlFor="autocrop">Auto crop</Label>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="relative aspect-video bg-black">
          {!streamReady && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Starting camera…</span>
            </div>
          )}
          <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <Button onClick={() => void capture()}>
          <Camera className="h-4 w-4 mr-2" />
          Capture page
        </Button>
        <Button variant="secondary" onClick={() => setPages([])} disabled={pages.length === 0}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear pages
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => void saveAsJpeg()} disabled={busy || pages.length === 0}>
            <FileImage className="h-4 w-4 mr-2" />
            Save as JPEG
          </Button>
          <Button onClick={() => void saveAsPdf()} disabled={busy || pages.length === 0}>
            <FileText className="h-4 w-4 mr-2" />
            Save as PDF
          </Button>
        </div>
      </div>

      {pages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {pages.map((p, i) => (
            <div key={i} className="relative group border rounded-md overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`page-${i+1}`} className="w-full h-32 object-cover" />
              <button
                className="absolute top-1 right-1 hidden group-hover:block rounded bg-black/60 p-1"
                onClick={() => removePage(i)}
                aria-label="Remove page"
              >
                <Trash2 className="h-4 w-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

async function tryAutoCrop(dataUrl: string): Promise<string | null> {
  try {
    // If OpenCV.js is available on window, attempt edge detection + perspective fix
    const anyWin = window as any
    if (anyWin.cv && anyWin.cv.Mat) {
      return await opencvAutoCrop(dataUrl)
    }
  } catch (e) {
    console.warn("OpenCV autocrop failed", e)
  }
  // Fallback: return original (no-op)
  return null
}

async function opencvAutoCrop(dataUrl: string): Promise<string | null> {
  const anyWin = window as any
  const cv = anyWin.cv
  const imgEl = await loadImage(dataUrl)
  const src = cv.imread(imgEl)
  try {
    const gray = new cv.Mat()
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0)
    const blur = new cv.Mat()
    cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0, 0, cv.BORDER_DEFAULT)
    const edges = new cv.Mat()
    cv.Canny(blur, edges, 50, 150)

    // Find contours
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

    let maxArea = 0
    let approxPoly: any = null
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i)
      const peri = cv.arcLength(cnt, true)
      const approx = new cv.Mat()
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true)
      if (approx.rows === 4) {
        const area = cv.contourArea(approx)
        if (area > maxArea) {
          maxArea = area
          if (approxPoly) approxPoly.delete()
          approxPoly = approx
        } else {
          approx.delete()
        }
      } else {
        approx.delete()
      }
    }

    if (!approxPoly) {
      return null
    }

    // Extract points
    const pts = [] as Array<{x:number;y:number}>
    for (let i = 0; i < 4; i++) {
      pts.push({ x: approxPoly.intAt(i,0), y: approxPoly.intAt(i,1) })
    }
    // Order points top-left, top-right, bottom-right, bottom-left
    const ordered = orderQuad(pts)

    // Destination size: width = max of top/bottom, height = max of left/right
    const w = Math.max(dist(ordered[0], ordered[1]), dist(ordered[2], ordered[3]))
    const h = Math.max(dist(ordered[0], ordered[3]), dist(ordered[1], ordered[2]))

    const dst = cv.Mat.zeros(h, w, cv.CV_8UC4)
    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, new Float32Array([
      ordered[0].x, ordered[0].y,
      ordered[1].x, ordered[1].y,
      ordered[2].x, ordered[2].y,
      ordered[3].x, ordered[3].y,
    ]))
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, new Float32Array([
      0, 0,
      w, 0,
      w, h,
      0, h,
    ]))
    const M = cv.getPerspectiveTransform(srcTri, dstTri)
    cv.warpPerspective(src, dst, M, new cv.Size(w, h))

    const outCanvas = document.createElement("canvas")
    outCanvas.width = w
    outCanvas.height = h
    cv.imshow(outCanvas, dst)
    const outUrl = outCanvas.toDataURL("image/jpeg", 0.92)

    // cleanup
    src.delete(); gray.delete(); blur.delete(); edges.delete(); contours.delete(); hierarchy.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete(); approxPoly.delete()

    return outUrl
  } catch (e) {
    console.error("OpenCV processing failed", e)
    return null
  } finally {
    try { src.delete() } catch {}
  }
}

function orderQuad(pts: Array<{x:number;y:number}>): Array<{x:number;y:number}> {
  // sort by y, then x
  const sorted = [...pts].sort((a,b) => a.y - b.y || a.x - b.x)
  const [p0, p1, p2, p3] = sorted
  // determine left/right among top two and bottom two
  const topLeft = p0.x < p1.x ? p0 : p1
  const topRight = p0.x < p1.x ? p1 : p0
  const bottomLeft = p2.x < p3.x ? p2 : p3
  const bottomRight = p2.x < p3.x ? p3 : p2
  return [topLeft, topRight, bottomRight, bottomLeft]
}

function dist(a: {x:number;y:number}, b: {x:number;y:number}) {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
