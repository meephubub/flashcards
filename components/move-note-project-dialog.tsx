"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { Loader2, ChevronsUpDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface MoveNoteProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  noteId: string | null | undefined
}

export default function MoveNoteProjectDialog({ open, onOpenChange, noteId }: MoveNoteProjectDialogProps) {
  const [project, setProject] = useState("")
  const [projects, setProjects] = useState<string[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setProject("")
      setLoading(false)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    const loadProjects = async () => {
      if (!open) return
      setLoadingProjects(true)
      try {
        const { data, error } = await supabase
          .from("notes")
          .select("project")
          .not("project", "is", null)
          .neq("project", "")
          .order("project", { ascending: true })
        if (error) throw new Error(error.message)
        const uniq = Array.from(new Set((data || []).map((r: any) => String(r.project))))
        setProjects(uniq)
      } catch (e) {
        console.error("Failed to load projects", e)
      } finally {
        setLoadingProjects(false)
      }
    }
    void loadProjects()
  }, [open])

  const onSubmit = async () => {
    if (!noteId) return
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase
        .from("notes")
        .update({ project: (project || '').trim() })
        .eq("id", noteId)
      if (error) throw new Error(error.message)
      onOpenChange(false)
    } catch (e: any) {
      setError(e?.message || "Failed to move note")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move note to project</DialogTitle>
          <DialogDescription>
            Change the project for the currently selected note.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">Project</label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                disabled={loadingProjects}
              >
                <span className="truncate">{project ? project : (loadingProjects ? 'Loading…' : 'Select a project')}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" align="start">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Projects</DropdownMenuLabel>
              {projects.map((p) => (
                <DropdownMenuItem key={p} className="gap-2 p-2" onClick={() => setProject(p)}>
                  {p}
                </DropdownMenuItem>
              ))}
              {projects.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem className="gap-2 p-2" onClick={() => setProject("")}>Clear (no project)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {project && (
            <p className="text-xs text-muted-foreground">Selected: {project}</p>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={onSubmit} disabled={loading || !noteId}>
            {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving</>) : 'Move'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
