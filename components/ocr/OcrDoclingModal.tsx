"use client"

import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import DocklingClient from "@/components/ocr/DocklingClient"

export interface OcrDoclingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string | null
  onMarkdown: (markdown: string) => void
}

export default function OcrDoclingModal({ open, onOpenChange, imageUrl, onMarkdown }: OcrDoclingModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>Convert to Markdown (OCR)</DialogTitle>
        </DialogHeader>
        <div className="w-full h-full border rounded-md overflow-hidden">
          <DocklingClient imageUrl={imageUrl || undefined} onMarkdown={(md) => { onMarkdown(md); onOpenChange(false) }} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
