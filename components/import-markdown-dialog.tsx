"use client"

import type React from "react"
import { useState, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ImportFormat = "markdown" | "tab" | "csv"

interface ImportMarkdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORMAT_CONFIG: Record<ImportFormat, { label: string; accept: string; hint: string }> = {
  markdown: {
    label: "Markdown",
    accept: ".md,text/markdown",
    hint: "# Deck → ## Question → Answer",
  },
  tab: {
    label: "Tab",
    accept: ".txt,text/plain",
    hint: "Question[tab]Answer",
  },
  csv: {
    label: "CSV",
    accept: ".csv,text/csv",
    hint: "Question,Answer",
  },
}

export function ImportMarkdownDialog({ open, onOpenChange }: ImportMarkdownDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [importFormat, setImportFormat] = useState<ImportFormat>("markdown")
  const [directInput, setDirectInput] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setDirectInput("")
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      setDirectInput("")
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleImport = async () => {
    if (!file && !directInput.trim()) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      if (file) {
        formData.append("file", file)
      } else {
        const textFile = new File([directInput], "import.txt", { type: "text/plain" })
        formData.append("file", textFile)
      }
      formData.append("format", importFormat)

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to import")
      }

      resetState()
      onOpenChange(false)
    } catch (error) {
      console.error("Import failed:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const resetState = () => {
    if (fileInputRef.current) fileInputRef.current.value = ""
    setFile(null)
    setDirectInput("")
  }

  const clearFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = ""
    setFile(null)
  }

  const hasContent = file || directInput.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-medium">Import flashcards</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Format selector */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {(Object.keys(FORMAT_CONFIG) as ImportFormat[]).map((format) => (
              <button
                key={format}
                onClick={() => setImportFormat(format)}
                className={cn(
                  "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors",
                  importFormat === format
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {FORMAT_CONFIG[format].label}
              </button>
            ))}
          </div>

          {/* File drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !file && fileInputRef.current?.click()}
            className={cn(
              "relative border border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
              isDragging && "border-foreground/50 bg-muted/50",
              file ? "border-foreground/20 bg-muted/30" : "border-border hover:border-foreground/30 hover:bg-muted/30"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={FORMAT_CONFIG[importFormat].accept}
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium truncate">{file.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearFile()
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Drop file here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {FORMAT_CONFIG[importFormat].hint}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or paste content</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Text input */}
          <Textarea
            placeholder="Paste your content here..."
            value={directInput}
            onChange={(e) => {
              setDirectInput(e.target.value)
              if (e.target.value && file) clearFile()
            }}
            className="min-h-[120px] font-mono text-sm resize-none"
          />

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleImport}
              disabled={!hasContent || isUploading}
            >
              {isUploading ? (
                <>
                  <Spinner className="mr-2" />
                  Importing...
                </>
              ) : (
                "Import"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
