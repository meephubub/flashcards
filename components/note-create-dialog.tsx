"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { CategoryCombobox } from "@/components/ui/CategoryCombobox"

export interface NoteCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { title: string; category?: string; content?: string; project?: string }) => Promise<void> | void
  projects?: string[]
  isSubmitting?: boolean
  error?: string | null
}

export function NoteCreateDialog({ open, onOpenChange, onSubmit, projects = [], isSubmitting = false, error = null }: NoteCreateDialogProps) {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [content, setContent] = useState("")
  const [project, setProject] = useState("")
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) {
      setTitle("")
      setCategory("")
      setContent("")
      setProject("")
      setTouched(false)
    }
  }, [open])

  const disabled = isSubmitting || title.trim().length === 0

  const handleSubmit = async () => {
    setTouched(true)
    if (disabled) return
    await onSubmit({
      title: title.trim(),
      category: category.trim() || undefined,
      content: content.trim() || undefined,
      project: project.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 max-w-md rounded-xl shadow-2xl p-0">
        <div className="p-6 sm:p-8">
          <DialogHeader className="mb-6">
            <ShadDialogTitle className="text-2xl font-bold tracking-tight">New Note</ShadDialogTitle>
            <DialogDescription className="text-neutral-500 dark:text-neutral-400 mt-1">
              Create a new note. Keep it simple and focused.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled"
                className="bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
              />
              {touched && title.trim().length === 0 && (
                <p className="text-xs text-red-500">Title is required.</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Project (optional)</label>
              <CategoryCombobox
                categories={projects}
                value={project}
                onChange={setProject}
                placeholder="Select project..."
                inputPlaceholder="Search or create..."
                emptyPlaceholder="No project found."
                theme="light"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Category (optional)</label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. biology"
                className="bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Content (optional)</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write something..."
                className="min-h-[120px] bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={disabled}
              className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100"
            >
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
