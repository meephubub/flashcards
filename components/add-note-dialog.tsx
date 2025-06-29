"use client"

import React, { useState, useCallback } from "react"
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
import { SparklesIcon } from "lucide-react"
import { CategoryCombobox } from "@/components/ui/CategoryCombobox"
import type { Note } from "@/lib/supabase"
import { Select, SelectTrigger, SelectValue, SelectItem, SelectContent } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { generateImage, type ImageModel } from "../lib/generate-image"

interface AddNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableCategories: string[]
  theme?: "dark" | "light"
  handleAddNote: (note: Omit<Note, "id" | "created_at" | "updated_at" | "user_id" | "flashcards">) => Promise<string | void>
  isLoading: boolean
}

export function AddNoteDialog({
  open,
  onOpenChange,
  availableCategories,
  theme,
  handleAddNote,
  isLoading,
}: AddNoteDialogProps) {
  const [newNote, setNewNote] = useState({
    title: "",
    content: "",
    category: "",
  })
  const [generationTopic, setGenerationTopic] = useState<string>("")
  const [isGeneratingNote, setIsGeneratingNote] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedImageModel, setSelectedImageModel] = useState<ImageModel>("flux")
  const [isGeneratingImages, setIsGeneratingImages] = useState(false)

  const handleGenerateNote = async () => {
    if (!generationTopic.trim()) {
      setErrorMessage("Please enter a topic to generate the note.")
      return
    }
    setIsGeneratingNote(true)
    setErrorMessage(null)
    try {
      const response = await fetch("/api/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: generationTopic }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || "Failed to generate note from API.")
      }

      const data = await response.json()
      setNewNote({ title: data.title, content: data.content, category: newNote.category || "" })
      setGenerationTopic("") // Clear topic input after generation
      setErrorMessage(null)
    } catch (error: any) {
      console.error("Error generating note via API:", error)
      setErrorMessage(error.message || "An unexpected error occurred while generating the note.")
    } finally {
      setIsGeneratingNote(false)
    }
  }

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
        const response = await fetch("https://flashcards-api-1.onrender.comw/v1/images/generate", {
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
    setIsGeneratingImages(true)
    try {
      const imageTags = extractImageTags(newNote.content)
      let updatedContent = newNote.content

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
      setNewNote((prev) => ({ ...prev, content: updatedContent }))
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

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newNote.title || !newNote.content) {
      setErrorMessage("Title and content are required.");
      return;
    }
    if (!newNote.category.trim()) {
      setErrorMessage("Category is required. Please select or create one.");
      return;
    }

    const error = await handleAddNote({
      title: newNote.title,
      content: newNote.content,
      category: newNote.category,
    });

    if (error) {
        setErrorMessage(error);
    } else {
        setNewNote({ title: "", content: "", category: "" }); // Reset form
        onOpenChange(false);
    }
  }, [handleAddNote, newNote, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-2xl rounded-xl shadow-2xl p-0 sm:p-0 ${
          theme === "dark"
            ? "bg-neutral-900 border-neutral-800 text-neutral-100"
            : "bg-white border-gray-200 text-gray-900"
        }`}
      >
        <div className="p-6 sm:p-8">
          <DialogHeader className="mb-6">
            <ShadDialogTitle
              className={`text-2xl font-bold ${theme === "dark" ? "text-neutral-100" : "text-gray-900"}`}
            >
              Add New Note
            </ShadDialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div
              className={`space-y-4 mb-6 p-4 border rounded-lg ${
                theme === "dark" ? "border-neutral-700 bg-neutral-800/50" : "border-gray-200 bg-gray-50"
              }`}
            >
              <p className={`text-sm font-medium ${theme === "dark" ? "text-neutral-300" : "text-gray-700"}`}>
                Generate with AI ✨
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter a topic for AI note generation..."
                  value={generationTopic}
                  onChange={(e) => setGenerationTopic(e.target.value)}
                  className={`flex-grow ${
                    theme === "dark"
                      ? "bg-neutral-700 border-neutral-600 text-neutral-100 placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-neutral-500"
                      : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-gray-400 focus:ring-gray-400"
                  }`}
                  disabled={isGeneratingNote}
                />
                <Button
                  onClick={handleGenerateNote}
                  disabled={isGeneratingNote || !generationTopic.trim()}
                  className={`font-semibold transition-all duration-150 whitespace-nowrap ${
                    theme === "dark"
                      ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-100 focus:ring-2 focus:ring-neutral-600 focus:ring-offset-2 focus:ring-offset-neutral-900 border border-neutral-700"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-900 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:ring-offset-white border border-gray-300"
                  }`}
                >
                  {isGeneratingNote ? (
                    <>
                      <SparklesIcon className="h-4 w-4 mr-2 animate-pulse" /> Generating...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-4 w-4 mr-2" /> Generate Note
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Input
                placeholder="Note Title"
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                className={`${
                  theme === "dark"
                    ? "bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500"
                    : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-gray-400 focus:ring-gray-400"
                }`}
              />
            </div>
            <div className="flex flex-col gap-4">
              <Textarea
                value={newNote.content}
                onChange={(e) => {
                  const newValue = e.target.value
                  setNewNote((prev) => ({ ...prev, content: newValue }))
                }}
                placeholder="Write your note here..."
                className="min-h-[300px]"
              />
              <div className="flex gap-2">
                <Select
                  value={selectedImageModel}
                  onValueChange={(value: ImageModel) => setSelectedImageModel(value)}
                >
                  <SelectTrigger className="w-[180px]">
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
                  disabled={isGeneratingImages}
                >
                  {isGeneratingImages ? "Generating Images..." : "Generate Images from Tags"}
                </Button>
              </div>
            </div>
            <div>
              <CategoryCombobox
                categories={availableCategories}
                value={newNote.category}
                onChange={(value) => setNewNote({ ...newNote, category: value })}
                placeholder="Select or create category..."
                inputPlaceholder="Search/Create category..."
                emptyPlaceholder="Type to create new category."
                theme={theme}
              />
            </div>

            {errorMessage && (
              <div
                className={`p-3 rounded-lg ${
                  theme === "dark"
                    ? "bg-red-900/30 border border-red-700/60 text-red-200"
                    : "bg-red-100 border border-red-300 text-red-800"
                }`}
              >
                {errorMessage}
              </div>
            )}
            <DialogFooter className="flex justify-between mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className={`${
                  theme === "dark"
                    ? "bg-transparent border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
                    : "bg-transparent border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all duration-150"
              >
                {isLoading ? "Adding..." : "Add Note"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
} 