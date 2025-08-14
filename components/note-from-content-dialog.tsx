"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Loader2, Upload, Wand2 } from "lucide-react"
import { formatNoteWithGroq } from "@/lib/groq"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useNoteContextStore } from "@/hooks/use-note-context"

interface NoteFromContentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function NoteFromContentDialog({ open, onOpenChange }: NoteFromContentDialogProps) {
  const [pasted, setPasted] = useState("")
  const [title, setTitle] = useState("")
  const [project, setProject] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const router = useRouter()
  const { setCurrentNoteId } = useNoteContextStore() as { setCurrentNoteId?: (id: string) => void }

  const fileNames = useMemo(() => files.map(f => f.name).join(", "), [files])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = Array.from(e.target.files || [])
    setFiles(f)
  }

  const reset = () => {
    setPasted("")
    setTitle("")
    setProject("")
    setFiles([])
    setLoading(false)
    setError(null)
    setProgress(null)
  }

  const close = () => {
    onOpenChange(false)
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setProgress("Extracting text…")
    try {
      // 1) Extract text from files if any
      let extracted = ""
      if (files.length > 0) {
        const fd = new FormData()
        for (const f of files) fd.append("files", f)
        const res = await fetch("/api/extract-text", { method: "POST", body: fd })
        if (!res.ok) throw new Error((await res.json()).error || "Failed to extract text")
        const j = await res.json()
        extracted = j.text || ""
      }

      const combined = [pasted, extracted].filter(Boolean).join("\n\n")
      if (!combined.trim()) {
        throw new Error("Please paste content or upload files")
      }

      // 2) Format via Groq
      setProgress("Formatting with AI…")
      const generated = await formatNoteWithGroq(combined)

      // 3) Insert into Supabase
      setProgress("Saving note…")
      const { data: userRes } = await supabase.auth.getUser()
      const userId = userRes?.user?.id
      if (!userId) throw new Error("Not signed in")

      const finalTitle = (title && title.trim()) ? title.trim() : (generated.title || "New Note")
      const finalProject = (project && project.trim()) ? project.trim() : ""

      const { data, error } = await supabase
        .from("notes")
        .insert([{ title: finalTitle, category: "", content: generated.content || combined, project: finalProject, user_id: userId }])
        .select("id")
        .single()
      if (error) throw new Error(error.message)

      const newId = (data as { id?: string } | null)?.id
      if (newId && typeof setCurrentNoteId === "function") setCurrentNoteId(newId)

      // Navigate to notes page
      router.push("/notes")
      close()
      reset()
    } catch (e: any) {
      console.error(e)
      setError(e?.message || "Failed to create note")
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create note from content</DialogTitle>
          <DialogDescription>
            Paste any text or upload files. We'll extract the text, format a Markdown note with AI, and save it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title (optional)</label>
              <Input
                placeholder="Choose a title or leave empty to use AI"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Project (optional)</label>
              <Input
                placeholder="Project name"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
            </div>
          </div>

          <label className="text-sm font-medium">Pasted content</label>
          <Textarea
            placeholder="Paste content here…"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={8}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Upload files (PDF, DOCX, TXT/MD, HTML)</label>
          <Input type="file" multiple onChange={onFileChange} />
          {fileNames && <p className="text-xs text-muted-foreground">Selected: {fileNames}</p>}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {progress && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {progress}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={close} disabled={loading}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" /> Create note
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
