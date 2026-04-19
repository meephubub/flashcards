"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "./ui/button"
import { X, Square, Trash2, Save } from "lucide-react"

interface Rect {
  x: number
  y: number
  w: number
  h: number
  id: string
}

interface DiagramEditorProps {
  imageUrl: string
  initialRects?: Rect[]
  onSave: (rects: Rect[]) => void
  onClose: () => void
}

export function DiagramEditor({ imageUrl, initialRects = [], onSave, onClose }: DiagramEditorProps) {
  const [rects, setRects] = useState<Rect[]>(initialRects)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentRect, setCurrentRect] = useState<Rect | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const img = new Image()
    img.src = imageUrl
    img.onload = () => {
      if (imgRef.current) {
        imgRef.current.src = imageUrl
        draw()
      }
    }
  }, [imageUrl, rects, currentRect])

  const draw = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    const img = imgRef.current
    if (!canvas || !ctx || !img) return

    canvas.width = img.width
    canvas.height = img.height

    ctx.drawImage(img, 0, 0)

    // Draw existing rects
    ctx.strokeStyle = "#3b82f6"
    ctx.lineWidth = 4
    ctx.fillStyle = "rgba(59, 130, 246, 0.3)"

    rects.forEach((rect) => {
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    })

    // Draw current rect
    if (currentRect) {
      ctx.strokeStyle = "#ef4444"
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setIsDrawing(true)
    setStartPos({ x, y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setCurrentRect({
      x: Math.min(x, startPos.x),
      y: Math.min(y, startPos.y),
      w: Math.abs(x - startPos.x),
      h: Math.abs(y - startPos.y),
      id: Math.random().toString(36).substr(2, 9)
    })
    draw()
  }

  const handleMouseUp = () => {
    if (isDrawing && currentRect && currentRect.w > 5 && currentRect.h > 5) {
      setRects([...rects, currentRect])
    }
    setIsDrawing(false)
    setCurrentRect(null)
    draw()
  }

  const deleteRect = (id: string) => {
    setRects(rects.filter(r => r.id !== id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-8">
      <div className="relative max-w-5xl w-full bg-zinc-950 rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-full">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <h2 className="text-white font-medium">Diagram Occlusion Editor</h2>
            <div className="flex gap-1">
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider">Draw Mode</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-white">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button size="sm" onClick={() => onSave(rects)} className="bg-white text-black hover:bg-zinc-200 rounded-full px-6">
              <Save className="h-4 w-4 mr-2" />
              Save Occlusions
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 flex justify-center items-start bg-grid-white/[0.02]">
          <div className="relative cursor-crosshair shadow-2xl">
            <img ref={imgRef} className="hidden" />
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="rounded-lg ring-1 ring-white/20"
            />
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-zinc-900/50">
          <div className="flex flex-wrap gap-2">
            {rects.map((rect, i) => (
              <div key={rect.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white">
                <Square className="h-3 w-3 text-blue-400" />
                <span>Box {i + 1}</span>
                <button onClick={() => deleteRect(rect.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {rects.length === 0 && (
              <p className="text-sm text-zinc-500">Click and drag on the image to hide parts of the diagram.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
