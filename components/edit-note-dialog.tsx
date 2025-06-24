"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CategoryCombobox } from "@/components/ui/CategoryCombobox"
import type { Note } from "@/lib/supabase"
import { Select, SelectTrigger, SelectValue, SelectItem, SelectContent } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { generateImage, type ImageModel } from "../lib/generate-image"
import { formatNoteWithGroq } from "../lib/groq"

interface EditNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  noteToEdit: Note | null
  onUpdateNote: (note: Note) => Promise<string | void>
  availableCategories: string[]
  theme?: "dark" | "light"
  isLoading: boolean
}

export function EditNoteDialog({
  open,
  onOpenChange,
  noteToEdit,
  onUpdateNote,
  availableCategories,
  theme = "dark",
  isLoading,
}: EditNoteDialogProps) {
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedImageModel, setSelectedImageModel] = useState<ImageModel>("flux")
  const [isGeneratingImages, setIsGeneratingImages] = useState(false)
  const [isFormatting, setIsFormatting] = useState(false)

  useEffect(() => {
    setEditingNote(noteToEdit)
  }, [noteToEdit])

  const extractImageTags = (content: string): string[] => {
    const matches = content.match(/!\(img\)\[(.*?)\]/g) || []
    return matches
      .map((tag) => {
        const match = tag.match(/!\(img\)\[(.*?)\]/)
        return match ? match[1] : ""
      })
      .filter(Boolean)
  }

  const generateImageFromTag = async (prompt: string): Promise<string> => {
    try {
      // Check if the selected model is one of the advanced models that need custom handling
      const advancedModels = ["dall-e-3", "sdxl-1.0", "sdxl-l", "sdxl-turbo", "sd-3.5-large", "flux-pro", "flux-dev", "flux-schnell", "flux-canny", "midjourney"];
      
      if (advancedModels.includes(selectedImageModel)) {
        // Use custom image generation for advanced models
        const response = await fetch("https://flashcards-api-mhmd.onrender.com/v1/images/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt,
            model: selectedImageModel,
            response_format: "url"
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
        }

        const result = await response.json();
        const generatedImageUrl = result.url || result.data?.[0]?.url;
        if (!generatedImageUrl) {
          throw new Error("No image URL found in response");
        }
        
        return generatedImageUrl;
      } else {
        // Use the original generateImage function for basic models
        const result = await generateImage(prompt, selectedImageModel as any)
        if (result.data && result.data.length > 0) {
          return `data:image/png;base64,${result.data[0].b64_json}`
        }
        throw new Error("No image data received")
      }
    } catch (error) {
      console.error("Error generating image:", error)
      throw error
    }
  }

  const handleGenerateImagesFromTags = async () => {
    if (!editingNote) return;
    setIsGeneratingImages(true)
    try {
      const imageTags = extractImageTags(editingNote.content)
      let updatedContent = editingNote.content

      for (const tag of imageTags) {
        try {
          const imageData = await generateImageFromTag(tag)
          const originalTag = `!(img)[${tag}]`
          const markdownImage = `![${tag}](${imageData})`
          updatedContent = updatedContent.replace(originalTag, markdownImage)
        } catch (err) {
          console.error(`Failed to generate image for tag: ${tag}`, err)
        }
      }
      setEditingNote(prev => prev ? { ...prev, content: updatedContent } : null)
      toast({
        title: "Success",
        description: "Generated images for all image tags",
      })
    } catch (err) {
      console.error("Error generating images:", err)
      toast({
        title: "Error",
        description: "Failed to generate some images",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingImages(false)
    }
  }

  const handleFormatWithAI = async () => {
    if (!editingNote) return;
    setIsFormatting(true);
    try {
      const result = await formatNoteWithGroq(editingNote.content);
      setEditingNote(prev => prev ? { ...prev, title: result.title, content: result.content } : null);
      toast({
        title: "Note formatted",
        description: "The note has been formatted with AI.",
      });
    } catch (err) {
      console.error("Error formatting note with AI:", err);
      toast({
        title: "Error",
        description: "Failed to format note with AI.",
        variant: "destructive",
      });
    } finally {
      setIsFormatting(false);
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    setErrorMessage(null);

    if (!editingNote.title || !editingNote.content) {
      setErrorMessage("Title and content are required.");
      return;
    }
    if (!editingNote.category.trim()) {
      setErrorMessage("Category is required.");
      return;
    }

    const error = await onUpdateNote(editingNote);

    if (error) {
      setErrorMessage(error);
    } else {
      onOpenChange(false);
    }
  }, [editingNote, onUpdateNote, onOpenChange]);

  if (!editingNote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          `${theme === "light"
            ? "bg-white border-neutral-200 text-neutral-900"
            : "bg-neutral-900 border-neutral-800 text-neutral-100"} max-w-2xl rounded-xl shadow-2xl p-0 sm:p-0`
        }
      >
        <div className={theme === "light" ? "p-6 sm:p-8 bg-white" : "p-6 sm:p-8 bg-neutral-900"}>
          <DialogHeader className="mb-6">
            <ShadDialogTitle className={theme === "light" ? "text-2xl font-bold text-neutral-900" : "text-2xl font-bold text-neutral-100"}>Edit Note</ShadDialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Input
                placeholder="Note Title"
                value={editingNote.title || ""}
                onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                className={theme === "light"
                  ? "bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-neutral-400"
                  : "bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500"}
              />
            </div>
            
            <div className="flex flex-col gap-4">
              <Textarea
                value={editingNote.content || ""}
                onChange={(e) => {
                  const newValue = e.target.value
                  setEditingNote({ ...editingNote, content: newValue })
                }}
                placeholder="Edit your note here..."
                className={theme === "light" ? "min-h-[300px] bg-white text-neutral-900 border-neutral-200" : "min-h-[300px] bg-neutral-900 text-neutral-100 border-neutral-700"}
              />
              <div className="flex gap-2">
                <Select
                  value={selectedImageModel}
                  onValueChange={(value: ImageModel) => setSelectedImageModel(value)}
                >
                  <SelectTrigger className={theme === "light" ? "w-[180px] bg-white border-neutral-200 text-neutral-900" : "w-[180px] bg-neutral-900 border-neutral-700 text-neutral-100"}>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flux">Flux</SelectItem>
                    <SelectItem value="turbo">Turbo</SelectItem>
                    <SelectItem value="gptimage">GPT Image</SelectItem>
                    <SelectItem value="together">Together AI</SelectItem>
                    <SelectItem value="dall-e-3">Dall-E 3</SelectItem>
                    <SelectItem value="sdxl-1.0">SDXL 1.0</SelectItem>
                    <SelectItem value="sdxl-l">SDXL L</SelectItem>
                    <SelectItem value="sdxl-turbo">SDXL Turbo</SelectItem>
                    <SelectItem value="sd-3.5-large">SD 3.5 Large</SelectItem>
                    <SelectItem value="flux-pro">Flux Pro</SelectItem>
                    <SelectItem value="flux-dev">Flux Dev</SelectItem>
                    <SelectItem value="flux-schnell">Flux Schnell</SelectItem>
                    <SelectItem value="flux-canny">Flux Canny</SelectItem>
                    <SelectItem value="midjourney">Midjourney</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateImagesFromTags}
                  disabled={isGeneratingImages || !editingNote}
                >
                  {isGeneratingImages ? "Generating Images..." : "Generate Images from Tags"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFormatWithAI}
                  disabled={isFormatting || !editingNote}
                >
                  {isFormatting ? "Formatting..." : "Format with AI"}
                </Button>
              </div>
            </div>
            
            <div>
              <CategoryCombobox
                categories={availableCategories}
                value={editingNote.category || ""}
                onChange={(value) => setEditingNote({ ...editingNote, category: value })}
                placeholder="Select or create category..."
                inputPlaceholder="Search/Create category..."
                emptyPlaceholder="Type to create new category."
                theme={theme}
              />
            </div>

            {errorMessage && (
              <div className={theme === "light" ? "text-red-600 text-sm p-3 bg-red-100 border border-red-300 rounded-md" : "text-red-400 text-sm p-3 bg-red-900/40 border border-red-700/60 rounded-md"}>
                {errorMessage}
              </div>
            )}
            <div className="flex justify-end space-x-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className={theme === "light"
                  ? "bg-white border border-neutral-200 text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900"
                  : "bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className={theme === "light"
                  ? "bg-neutral-900 hover:bg-neutral-800 text-neutral-100 font-semibold py-2.5 rounded-lg shadow-md transition-colors duration-150 focus:ring-2 focus:ring-neutral-600 focus:ring-offset-2 focus:ring-offset-neutral-100 border border-neutral-200"
                  : "bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-semibold py-2.5 rounded-lg shadow-md transition-colors duration-150 focus:ring-2 focus:ring-neutral-600 dark:focus:ring-neutral-600 focus:ring-offset-2 focus:ring-offset-neutral-100 dark:focus:ring-offset-neutral-900 border border-neutral-200 dark:border-neutral-700"}
              >
                {isLoading ? "Updating Note..." : "Update Note"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
} 