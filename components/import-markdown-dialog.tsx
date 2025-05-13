"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useDecks } from "@/context/deck-context"
import { AlertCircle, FileText, Upload } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MarkdownTemplate } from "@/components/markdown-template"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

interface ImportMarkdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportMarkdownDialog({ open, onOpenChange }: ImportMarkdownDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [previewText, setPreviewText] = useState<string>("")
  const [importFormat, setImportFormat] = useState<"markdown" | "tab" | "csv">("markdown")
  const [directInput, setDirectInput] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { refreshDecks } = useDecks()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)

      // Preview the file content
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setPreviewText(content.substring(0, 500) + (content.length > 500 ? "..." : ""))
      }
      reader.readAsText(selectedFile)
    }
  }

  const handleImport = async () => {
    if (!file && !directInput.trim()) {
      toast({
        title: "No content provided",
        description: "Please either select a file or enter text to import.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      if (file) {
        formData.append("file", file)
      } else {
        // Create a text file from direct input
        const textFile = new File([directInput], "import.txt", { type: "text/plain" })
        formData.append("file", textFile)
      }
      formData.append("format", importFormat)

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to import flashcards")
      }

      // Refresh decks to show the newly imported deck
      await refreshDecks()

      toast({
        title: "Import successful",
        description: data.message,
      })

      // Reset and close dialog
      setFile(null)
      setPreviewText("")
      setDirectInput("")
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import flashcards",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    setFile(null)
    setPreviewText("")
    setDirectInput("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Import Flashcards</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="markdown" onValueChange={(value) => setImportFormat(value as "markdown" | "tab" | "csv")}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
            <TabsTrigger value="tab">Tab-Delimited</TabsTrigger>
            <TabsTrigger value="csv">CSV</TabsTrigger>
          </TabsList>

          <TabsContent value="markdown" className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-2">
                <div>
                  Your markdown file should use <code className="text-xs bg-muted px-1 py-0.5 rounded"># Title</code> for
                  deck name, and <code className="text-xs bg-muted px-1 py-0.5 rounded">## Question</code> followed by the
                  answer for each card.
                </div>
                <div className="flex justify-end">
                  <MarkdownTemplate />
                </div>
              </AlertDescription>
            </Alert>

            <div className="grid w-full items-center gap-1.5">
              <label htmlFor="markdown-file" className="text-sm font-medium">
                Select Markdown File
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="markdown-file"
                  type="file"
                  accept=".md,text/markdown"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  {file ? file.name : "Choose file"}
                </Button>
                {file && (
                  <Button type="button" variant="ghost" size="sm" onClick={resetFileInput}>
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Accepted file types: .md</p>
            </div>

            <div className="grid w-full items-center gap-1.5">
              <label htmlFor="direct-input" className="text-sm font-medium">
                Or Enter Text Directly
              </label>
              <Textarea
                id="direct-input"
                placeholder="Paste your markdown content here..."
                value={directInput}
                onChange={(e) => setDirectInput(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
          </TabsContent>

          <TabsContent value="tab" className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-2">
                <div>
                  Your tab-delimited file should have two columns: question and answer, separated by tabs. The first line
                  can be used for the deck name and description.
                </div>
                <div className="text-xs font-mono bg-muted p-2 rounded">
                  Deck Name{"\t"}Description{"\n"}
                  Question 1{"\t"}Answer 1{"\n"}
                  Question 2{"\t"}Answer 2
                </div>
              </AlertDescription>
            </Alert>

            <div className="grid w-full items-center gap-1.5">
              <label htmlFor="tab-file" className="text-sm font-medium">
                Select Tab-Delimited File
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="tab-file"
                  type="file"
                  accept=".txt,text/plain"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  {file ? file.name : "Choose file"}
                </Button>
                {file && (
                  <Button type="button" variant="ghost" size="sm" onClick={resetFileInput}>
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Accepted file types: .txt</p>
            </div>

            <div className="grid w-full items-center gap-1.5">
              <label htmlFor="direct-input-tab" className="text-sm font-medium">
                Or Enter Text Directly
              </label>
              <Textarea
                id="direct-input-tab"
                placeholder="Paste your tab-delimited content here..."
                value={directInput}
                onChange={(e) => setDirectInput(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
          </TabsContent>

          <TabsContent value="csv" className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-2">
                <div>
                  Your CSV file should have two columns: question and answer, separated by commas. The first line
                  can be used for the deck name and description.
                </div>
                <div className="text-xs font-mono bg-muted p-2 rounded">
                  Deck Name,Description{"\n"}
                  Question 1,Answer 1{"\n"}
                  Question 2,Answer 2
                </div>
              </AlertDescription>
            </Alert>

            <div className="grid w-full items-center gap-1.5">
              <label htmlFor="csv-file" className="text-sm font-medium">
                Select CSV File
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  {file ? file.name : "Choose file"}
                </Button>
                {file && (
                  <Button type="button" variant="ghost" size="sm" onClick={resetFileInput}>
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Accepted file types: .csv</p>
            </div>

            <div className="grid w-full items-center gap-1.5">
              <label htmlFor="direct-input-csv" className="text-sm font-medium">
                Or Enter Text Directly
              </label>
              <Textarea
                id="direct-input-csv"
                placeholder="Paste your CSV content here..."
                value={directInput}
                onChange={(e) => setDirectInput(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
          </TabsContent>
        </Tabs>

        {previewText && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Preview:</h3>
            <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">
              {previewText}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={(!file && !directInput.trim()) || isUploading}>
            {isUploading ? (
              <>
                <Upload className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
