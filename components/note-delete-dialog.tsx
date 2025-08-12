"use client"

import React, { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

export interface NoteDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  noteTitle?: string
  onConfirm: () => Promise<void> | void
  isDeleting?: boolean
  error?: string | null
}

export function NoteDeleteDialog({
  open,
  onOpenChange,
  noteTitle,
  onConfirm,
  isDeleting = false,
  error = null,
}: NoteDeleteDialogProps) {
  const [progress, setProgress] = useState<number>(0)
  const [dragging, setDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [handleLeftPx, setHandleLeftPx] = useState(0)

  // Reset slider when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setProgress(0)
      setHandleLeftPx(0)
    } else {
      // measure track to place handle accurately on reopen
      requestAnimationFrame(() => {
        const el = trackRef.current
        if (!el) return
        const W = el.getBoundingClientRect().width
        const R = 20 // handle radius (h-10 w-10)
        const range = Math.max(1, W - 2 * R)
        const left = (progress / 100) * range
        setHandleLeftPx(left)
      })
    }
  }, [open])

  // Drag handlers
  const clamp = (v: number) => Math.max(0, Math.min(100, v))
  const calcFromClientX = (clientX: number): { pct: number; leftPx: number } => {
    const el = trackRef.current
    if (!el) return { pct: 0, leftPx: 0 }
    const rect = el.getBoundingClientRect()
    const R = 20 // handle radius (h-10 w-10)
    const W = rect.width
    const minX = rect.left + R
    const maxX = rect.left + W - R
    const clampedX = Math.max(minX, Math.min(maxX, clientX))
    const range = Math.max(1, W - 2 * R)
    const leftPx = clampedX - rect.left - R
    const pct = clamp(((clampedX - (rect.left + R)) / range) * 100)
    return { pct, leftPx }
  }
  const startDrag = (e: React.PointerEvent) => {
    if (isDeleting) return
    setDragging(true)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const { pct, leftPx } = calcFromClientX(e.clientX)
    setProgress(pct)
    setHandleLeftPx(leftPx)
  }
  const onDrag = (e: React.PointerEvent) => {
    if (!dragging || isDeleting) return
    const { pct, leftPx } = calcFromClientX(e.clientX)
    setProgress(pct)
    setHandleLeftPx(leftPx)
  }
  const endDrag = () => {
    if (isDeleting) return
    setDragging(false)
    if (progress >= 100) onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 max-w-md rounded-xl shadow-2xl p-0">
        <div className="p-6 sm:p-8">
          <DialogHeader className="mb-6">
            <ShadDialogTitle className="text-2xl font-bold tracking-tight">Delete Note</ShadDialogTitle>
            <DialogDescription className="text-neutral-500 dark:text-neutral-400 mt-1">
              {noteTitle ? (
                <>
                  Are you sure you want to delete "{noteTitle}"? This action cannot be undone.
                </>
              ) : (
                <>Are you sure you want to delete this note? This action cannot be undone.</>
              )}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Slide to delete (custom) */}
          <div className="mt-2">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Slide to permanently delete</p>
            <div
              ref={trackRef}
              className="relative h-12 select-none rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 overflow-hidden shadow-inner"
              onPointerMove={onDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {/* Progress fill */}
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700"
                style={{ width: `${progress}%`, transition: dragging ? "none" : "width 160ms cubic-bezier(.2,.7,.3,1)" }}
              />
              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className={[
                    "text-sm font-medium tracking-wide transition-colors",
                    progress >= 100
                      ? "text-white"
                      : "text-neutral-700 dark:text-neutral-300",
                  ].join(" ")}
                >
                  {progress >= 100 ? "Release to delete" : "Slide to delete"}
                </span>
              </div>
              {/* Handle */}
              <button
                type="button"
                aria-label="Slide to delete"
                disabled={isDeleting}
                className="absolute top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-md border border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-neutral-950/90 backdrop-blur text-red-600 grid place-items-center active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ left: `${handleLeftPx}px` }}
                onPointerDown={startDrag}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">{Math.round(progress)}%</div>
          </div>

          <DialogFooter className="mt-2 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900"
            >
              Cancel
            </Button>
            {/* Optional explicit button as an accessibility fallback */}
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting || progress < 100}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
