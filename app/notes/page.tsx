'use client'

import { AppSidebar } from "@/components/notes/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import React, { useEffect, useMemo, useState } from "react"
import { distance as levenshteinDistance } from 'fastest-levenshtein'
import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/lib/supabase"
import { useAuth } from "@/context/auth-context"
import { useNoteContextStore } from "@/hooks/use-note-context"
import { useNoteDialogStore } from "@/hooks/use-note-dialog"
import { NoteCreateDialog } from "@/components/note-create-dialog"
import { NoteDeleteDialog } from "@/components/note-delete-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle as ShadDialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"
import { Textarea } from "@/components/ui/textarea"

// react-markdown plugins
import remarkGfm from "remark-gfm"
import remarkMath from 'remark-math'
import remarkDirective from 'remark-directive'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Skeleton } from "@/components/ui/skeleton"
import { makeGroqRequest } from "@/lib/groq"
import ExamFromNotesPage from "@/app/exam-from-notes/page"
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Bounds, useGLTF } from '@react-three/drei'
import { STLLoader } from 'three-stdlib'

export default function Page() {
  const { user } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [teamOptions, setTeamOptions] = useState<string[]>([])
  const [loadingTeams, setLoadingTeams] = useState<boolean>(false)
  const [teamsError, setTeamsError] = useState<string | null>(null)

  const currentNoteId = useNoteContextStore((s) => s.currentNoteId)
  const setCurrentNoteId = useNoteContextStore((s) => s.setCurrentNoteId)
  const setDeleteNoteById = useNoteContextStore((s) => s.setDeleteNoteById)
  const setOpenSelectNoteDialog = useNoteContextStore((s) => s.setOpenSelectNoteDialog)
  const setStartEditCurrentNote = useNoteContextStore((s) => s.setStartEditCurrentNote)
  const setGetCurrentNoteForExam = useNoteContextStore((s) => s.setGetCurrentNoteForExam)
  const showExamInNotes = useNoteContextStore((s) => s.showExamInNotes)
  const setShowExamInNotes = useNoteContextStore((s) => s.setShowExamInNotes)
  const setUpdateCurrentNoteContent = useNoteContextStore((s) => s.setUpdateCurrentNoteContent)

  // ActionSearchBar "Create note" integration
  const createOpen = useNoteDialogStore((s) => s.open)
  const setCreateOpen = useNoteDialogStore((s) => s.setOpen)
  const [noteTitle, setNoteTitle] = useState<string>("")
  const [noteCategory, setNoteCategory] = useState<string>("")
  const [noteUpdatedAt, setNoteUpdatedAt] = useState<string>("")
  const [noteContent, setNoteContent] = useState<string>("")
  const [noteProject, setNoteProject] = useState<string>("")
  const [loadingNote, setLoadingNote] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  // Expose current note data to ActionSearchBar for exam generation
  useEffect(() => {
    // Provide a stable function that returns current note title/content when a note is selected
    setGetCurrentNoteForExam(() => {
      if (!currentNoteId) return null
      return { title: noteTitle || "Untitled Note", content: noteContent || "" }
    })
    return () => setGetCurrentNoteForExam(undefined)
    // Depend on values that affect the returned data
  }, [setGetCurrentNoteForExam, currentNoteId, noteTitle, noteContent])

  // Register an updater so external components (e.g., ActionSearchBar) can push refreshed content
  useEffect(() => {
    setUpdateCurrentNoteContent(() => (content: string) => {
      // Update local state immediately for a seamless refresh
      setNoteContent(content)
      // Best-effort update timestamp locally for UI freshness
      try { setNoteUpdatedAt(new Date().toISOString()) } catch {}
    })
    return () => setUpdateCurrentNoteContent(undefined)
  }, [setUpdateCurrentNoteContent])

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false)
  const [draftContent, setDraftContent] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [aiFormatting, setAiFormatting] = useState(false)
  const [aiFormatError, setAiFormatError] = useState<string | null>(null)
  const [uploadingModel, setUploadingModel] = useState(false)
  const [uploadModelError, setUploadModelError] = useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const editorRef = React.useRef<HTMLTextAreaElement | null>(null)

  // Reset embedded exam mode when switching notes or unmounting
  useEffect(() => {
    return () => {
      try { setShowExamInNotes(false) } catch {}
    }
  }, [setShowExamInNotes])

  useEffect(() => {
    // When changing the selected note, leave exam mode
    try { setShowExamInNotes(false) } catch {}
  }, [currentNoteId, setShowExamInNotes])

  // Minimal select-note dialog state
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [selectLoading, setSelectLoading] = useState(false)
  const [selectError, setSelectError] = useState<string | null>(null)
  const [userNotes, setUserNotes] = useState<Pick<Note, "id" | "title" | "updated_at" | "category">[]>([])

  // Search state for overlay selector in empty state
  const [search, setSearch] = useState('')
  const filteredNotes = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return userNotes
    return userNotes.filter(n => (n.title || 'Untitled').toLowerCase().includes(q) || (n.category || '').toLowerCase().includes(q))
  }, [search, userNotes])

  // Lazy-load notes for the empty-state overlay if not already fetched
  useEffect(() => {
    if (!user?.id) return
    if (userNotes.length > 0) return
    let cancelled = false
    ;(async () => {
      setSelectLoading(true)
      setSelectError(null)
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, updated_at, category")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50)
      if (!cancelled) {
        if (error) setSelectError(error.message)
        else setUserNotes((data as any) ?? [])
        setSelectLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [supabase, user?.id, userNotes.length])

  // Delete confirmation dialog state/handlers (slide-to-delete)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title?: string } | null>(null)

  const openDeleteDialogFor = async (id: string) => {
    if (!id) return
    let title: string | undefined = undefined
    // If it's the current note, we already have title in state
    if (id === currentNoteId && noteTitle) title = noteTitle
    else if (user?.id) {
      const { data } = await supabase
        .from("notes")
        .select("title")
        .eq("id", id)
        .eq("user_id", user.id)
        .single()
      title = (data as any)?.title
    }
    setPendingDelete({ id, title })
    setDeleteError(null)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!pendingDelete?.id || !user?.id) return
    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", pendingDelete.id)
      .eq("user_id", user.id)
    if (error) {
      setDeleteError(error.message)
    } else {
      // Clear selection if we deleted the current one
      if (currentNoteId === pendingDelete.id) setCurrentNoteId(null)
      setIsDeleteOpen(false)
      setPendingDelete(null)
    }
    setDeleting(false)
  }

  useEffect(() => {
    let isMounted = true
    const fetchProjects = async () => {
      if (!user?.id) return
      setLoadingTeams(true)
      setTeamsError(null)
      const { data, error } = await supabase
        .from("notes")
        .select("project")
        .eq("user_id", user.id)
        .order("project", { ascending: true })
      if (!isMounted) return
      if (error) {
        setTeamsError(error.message)
        setLoadingTeams(false)
        return
      }
      const rows = (data as { project: string | null }[] | null) ?? []
      const seen = new Set<string>()
      const unique: string[] = []
      for (const r of rows) {
        const v = (r.project ?? "").trim()
        if (v && !seen.has(v)) {
          seen.add(v)
          unique.push(v)
        }
      }
      setTeamOptions(unique)
      setLoadingTeams(false)
    }
    fetchProjects()
    return () => {
      isMounted = false
    }
  }, [supabase, user?.id])

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!currentNoteId || !user?.id) {
        setNoteContent("")
        setNoteTitle("")
        setNoteCategory("")
        setNoteUpdatedAt("")
        setNoteProject("")
        return
      }
      setLoadingNote(true)
      setNoteError(null)
      const { data, error } = await supabase
        .from("notes")
        .select("title, content, category, updated_at, project")
        .eq("id", currentNoteId)
        .eq("user_id", user.id)
        .single()
      if (!mounted) return
      if (error) {
        setNoteError(error.message)
        setLoadingNote(false)
        return
      }
      setNoteTitle((data?.title as string) || "Untitled")
      setNoteCategory((data?.category as string) || "")
      setNoteUpdatedAt((data?.updated_at as string) || "")
      setNoteContent((data?.content as string) || "")
      setNoteProject((data?.project as string) || "")
      setLoadingNote(false)
    }
    run()
    return () => {
      mounted = false
    }
  }, [currentNoteId, supabase, user?.id])

  // When note changes, reset editing/draft state
  useEffect(() => {
    setIsEditing(false)
    setDraftContent(noteContent || "")
    setSaveError(null)
  }, [currentNoteId, noteContent])

  // Expose an action for ActionSearchBar to trigger editing
  useEffect(() => {
    setStartEditCurrentNote(() => {
      if (!currentNoteId) return
      setIsEditing(true)
      setDraftContent(noteContent || "")
    })
    return () => setStartEditCurrentNote(undefined)
  }, [setStartEditCurrentNote, currentNoteId, noteContent])

  // Save handler
  const saveDraft = React.useCallback(async () => {
    if (!user?.id || !currentNoteId) return
    if (saving) return
    setSaving(true)
    setSaveError(null)
    const { data, error } = await supabase
      .from("notes")
      .update({ content: draftContent })
      .eq("id", currentNoteId)
      .eq("user_id", user.id)
      .select("updated_at, content")
      .single()
    if (error) {
      setSaveError(error.message)
    } else {
      // Commit to view state
      setNoteContent((data?.content as string) ?? draftContent)
      setNoteUpdatedAt((data?.updated_at as string) || "")
      setIsEditing(false)
    }
    setSaving(false)
  }, [currentNoteId, draftContent, supabase, user?.id, saving])

  // Format with AI
  const formatWithAI = React.useCallback(async () => {
    if (!draftContent.trim()) return
    if (aiFormatting) return
    setAiFormatting(true)
    setAiFormatError(null)
    try {
      const guidelines = `You are a Markdown formatter for personal notes.

Goals:
- Improve structure and readability while preserving meaning.
- Use clear headings (H1-H3), bullet/numbered lists, and subheadings as needed.
- Convert ad-hoc separators into proper markdown (lists, headings, blockquotes).
- Keep existing URLs and image markdown as-is; if you see raw image URLs, convert to ![img](URL).
- Use fenced code blocks for code snippets with language hints when obvious.
- Keep content concise; do not invent content.
- Output valid GitHub-flavored Markdown only.`

      const systemMessage = "You are a helpful Markdown editor."
      const prompt = `${guidelines}\n\n---\n\nHere is the raw note content to format:\n\n${draftContent}`
      const result = await makeGroqRequest(prompt, false, systemMessage)
      if (typeof result === 'string' && result.trim()) {
        setDraftContent(result)
      } else if (result && typeof (result as any).text === 'string') {
        setDraftContent((result as any).text)
      } else {
        setAiFormatError('AI returned no content')
      }
    } catch (e: any) {
      setAiFormatError(e?.message || 'Failed to format with AI')
    } finally {
      setAiFormatting(false)
    }
  }, [draftContent, aiFormatting])

  // Editor: convert pasted image URLs to markdown image syntax
  const onEditorPaste = React.useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = (e.clipboardData?.getData('text/plain') || '').trim()
    // Basic image URL detector
    const isImageUrl = /^https?:\/\/\S+\.(png|jpe?g|gif|webp|bmp|svg)(\?\S*)?$/i.test(text)
    if (!isImageUrl) return
    e.preventDefault()
    const el = e.currentTarget
    const start = el.selectionStart ?? draftContent.length
    const end = el.selectionEnd ?? start
    const before = draftContent.slice(0, start)
    const after = draftContent.slice(end)
    const insertion = `![img](${text})`
    const next = `${before}${insertion}${after}`
    setDraftContent(next)
    // Restore caret just after the inserted markdown
    const caret = start + insertion.length
    setTimeout(() => {
      try {
        el.focus()
        el.setSelectionRange(caret, caret)
      } catch {}
    }, 0)
  }, [draftContent])
  // Extend paste handler to also embed YouTube links as directives
  const _prevOnEditorPaste = onEditorPaste
  const onEditorPasteExtended = React.useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = (e.clipboardData?.getData('text/plain') || '').trim()
    // If previous handler already handled images, let it run first
    // but we need to duplicate minimal logic to detect YouTube links before early return
    const YT_RE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=[^\s&]+|youtu\.be\/[^\s?&#]+|youtube\.com\/shorts\/[^\s?&#]+|youtube\.com\/embed\/[^\s?&#]+)/i
    if (YT_RE.test(text)) {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart ?? draftContent.length
      const end = el.selectionEnd ?? start
      const before = draftContent.slice(0, start)
      const after = draftContent.slice(end)
      const insertion = `\n\n:::youtube{url="${text}"}\n:::\n\n`
      const next = `${before}${insertion}${after}`
      setDraftContent(next)
      const caret = start + insertion.length
      setTimeout(() => {
        try {
          el.focus()
          el.setSelectionRange(caret, caret)
        } catch {}
      }, 0)
      return
    }
    // Fallback to original paste handler (handles image URL conversion)
    _prevOnEditorPaste(e)
  }, [draftContent, _prevOnEditorPaste])

  // Editor: Ctrl+I on selected link -> wrap as markdown image
  const onEditorKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isCtrlI = (e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')
    if (!isCtrlI) return
    const el = e.currentTarget
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    if (start === end) return
    const selected = draftContent.slice(start, end).trim()
    const isImageUrl = /^https?:\/\/\S+\.(png|jpe?g|gif|webp|bmp|svg)(\?\S*)?$/i.test(selected)
    if (!isImageUrl) return
    e.preventDefault()
    const before = draftContent.slice(0, start)
    const after = draftContent.slice(end)
    const insertion = `![img](${selected})`
    const next = `${before}${insertion}${after}`
    setDraftContent(next)
    const caret = (before.length + insertion.length)
    setTimeout(() => {
      try {
        el.focus()
        el.setSelectionRange(caret, caret)
      } catch {}
    }, 0)
  }, [draftContent])

  // Keyboard: Ctrl+E toggles edit; if already editing, save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault()
        if (!currentNoteId) return
        if (isEditing) void saveDraft()
        else setIsEditing(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEditing, saveDraft, currentNoteId])

  // Upload a 3D model to Supabase Storage and insert a Markdown directive at the caret
  const onPickModel = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploadModelError(null)
    setUploadingModel(true)
    try {
      // Restrict to common formats
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !['glb','gltf','stl'].includes(ext)) {
        throw new Error('Unsupported model type. Use .glb, .gltf or .stl')
      }
      // Send to server route that uses SUPABASE_SERVICE_ROLE_KEY
      const form = new FormData()
      form.set('file', file)
      form.set('user_id', user.id)
      const res = await fetch('/api/upload-cad', { method: 'POST', body: form })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `Upload failed (${res.status})`)
      }
      const payload = await res.json().catch(() => ({})) as { url?: string }
      const publicUrl = payload.url
      if (!publicUrl) throw new Error('Upload failed: missing URL')
      // Insert directive using remark-directive attribute syntax (attributes inside braces)
      const insertion = `\n\n:::model{src="${publicUrl}" scale="1" autoRotate="true"}\n:::\n\n`
      const el = editorRef.current
      if (el) {
        const start = el.selectionStart ?? draftContent.length
        const end = el.selectionEnd ?? start
        const before = draftContent.slice(0, start)
        const after = draftContent.slice(end)
        const next = `${before}${insertion}${after}`
        setDraftContent(next)
        const caret = start + insertion.length
        setTimeout(() => {
          try { el.focus(); el.setSelectionRange(caret, caret) } catch {}
        }, 0)
      } else {
        setDraftContent((prev) => prev + insertion)
      }
    } catch (err: any) {
      setUploadModelError(err?.message || 'Failed to upload model')
    } finally {
      setUploadingModel(false)
      // reset value so the same file can be picked again
      try { if (e.target) e.target.value = '' } catch {}
    }
  }, [draftContent, user?.id])

  // Provide delete handler for ActionSearchBar (opens confirm dialog)
  useEffect(() => {
    // Register a function that opens confirmation dialog
    setDeleteNoteById((id: string) => {
      void openDeleteDialogFor(id)
    })
    return () => {
      // Cleanup to avoid stale closures when leaving the page
      setDeleteNoteById(undefined)
    }
  }, [setDeleteNoteById, supabase, user?.id, setCurrentNoteId, currentNoteId, noteTitle])

  // Provide openSelectNoteDialog for ActionSearchBar (when no note selected)
  useEffect(() => {
    setOpenSelectNoteDialog(() => {
      // open minimal selector and fetch notes lazily
      setIsSelectOpen(true)
      void (async () => {
        if (!user?.id) return
        setSelectLoading(true)
        setSelectError(null)
        const { data, error } = await supabase
          .from("notes")
          .select("id, title, updated_at, category")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(50)
        if (error) {
          setSelectError(error.message)
        } else {
          setUserNotes((data as any) ?? [])
        }
        setSelectLoading(false)
      })()
    })
    return () => setOpenSelectNoteDialog(undefined)
  }, [setOpenSelectNoteDialog, supabase, user?.id])

  // Create note submission wired to NoteCreateDialog and palette
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const handleCreateNote = async ({ title, category, content, project }: { title: string; category?: string; content?: string; project?: string }) => {
    if (!user?.id) return
    setCreating(true)
    setCreateError(null)
    const { data, error } = await supabase
      .from("notes")
      .insert([{ title, category: category ?? "", content: content ?? "", project: project ?? "", user_id: user.id }])
      .select("id")
      .single()
    if (error) {
      setCreateError(error.message)
    } else {
      const newId = (data as { id: string } | null)?.id
      if (newId) setCurrentNoteId(newId)
      setCreateOpen(false)
    }
    setCreating(false)
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    {noteProject || "Notes"}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{noteTitle || "Untitled"}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="bg-background min-h-[100vh] flex-1 rounded-xl md:min-h-min p-6 md:p-10">
            {/* Create Note Dialog (for palette "Create note") */}
            <NoteCreateDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              onSubmit={handleCreateNote}
              projects={teamOptions}
              isSubmitting={creating}
              error={createError}
            />

            {/* Delete confirmation dialog with slide-to-delete */}
            <NoteDeleteDialog
              open={isDeleteOpen}
              onOpenChange={(o) => {
                setIsDeleteOpen(o)
                if (!o) setPendingDelete(null)
              }}
              noteTitle={pendingDelete?.title}
              onConfirm={confirmDelete}
              isDeleting={deleting}
              error={deleteError}
            />

            {/* Select Note Dialog (for palette when no note is selected) */}
            <Dialog open={isSelectOpen} onOpenChange={(o) => setIsSelectOpen(o)}>
              <DialogContent className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 max-w-md rounded-xl shadow-2xl p-0">
                <div className="p-6 sm:p-8">
                  <DialogHeader className="mb-4">
                    <ShadDialogTitle className="text-xl font-bold">Select a note</ShadDialogTitle>
                    <DialogDescription className="text-neutral-500 dark:text-neutral-400">
                      Choose a note to preview or manage.
                    </DialogDescription>
                  </DialogHeader>
                  {selectError && (
                    <div className="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-md mb-3">
                      {selectError}
                    </div>
                  )}
                  <div className="max-h-72 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-800">
                    {selectLoading ? (
                      <div className="p-4 text-sm text-neutral-500">Loading…</div>
                    ) : userNotes.length === 0 ? (
                      <div className="p-4 text-sm text-neutral-500">No notes yet.</div>
                    ) : (
                      userNotes.map((n) => (
                        <button
                          key={n.id}
                          className="w-full text-left p-3 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                          onClick={() => {
                            setCurrentNoteId(n.id)
                            setIsSelectOpen(false)
                          }}
                        >
                          <div className="font-medium">{n.title || "Untitled"}</div>
                          <div className="text-xs text-neutral-500">
                            {n.category ? `${n.category} • ` : ""}
                            {new Date(n.updated_at as any).toLocaleDateString()}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button variant="outline" onClick={() => setIsSelectOpen(false)}
                      className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900">
                      Close
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {noteError && (
              <p className="text-sm text-red-600">{noteError}</p>
            )}
            {!currentNoteId && !loadingNote && (
              <div className="mx-auto max-w-3xl">
                <div className="mb-6 text-center">
                  <h2 className="text-xl font-semibold mb-1">Select a note</h2>
                  <p className="text-sm text-muted-foreground">Choose a note to preview its content.</p>
                </div>
                <div className="mx-auto w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-lg">
                  <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search notes..."
                      className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
                      aria-label="Search notes"
                    />
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
                    {selectLoading ? (
                      <div className="p-3 text-sm text-neutral-500">Loading…</div>
                    ) : filteredNotes.length === 0 ? (
                      <div className="p-3 text-sm text-neutral-500">{search.trim() === '' ? 'No notes yet.' : 'No matching notes.'}</div>
                    ) : (
                      filteredNotes.map((n) => (
                        <button
                          key={n.id}
                          className="w-full text-left p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                          onClick={() => setCurrentNoteId(n.id)}
                        >
                          <div className="font-medium truncate">{n.title || 'Untitled'}</div>
                          <div className="text-xs text-neutral-500 truncate">
                            {n.category ? `${n.category} • ` : ''}
                            {n.updated_at ? new Date(n.updated_at as any).toLocaleDateString() : ''}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            {currentNoteId && (
              <article className="mx-auto max-w-3xl">
                <header className="mb-8">
                  <h1 className="text-3xl font-bold tracking-tight mb-2">{noteTitle}</h1>
                  {(noteCategory || noteUpdatedAt) && (
                    <p className="text-sm text-muted-foreground">
                      {noteCategory && <span>Category: {noteCategory}</span>}
                      {noteCategory && noteUpdatedAt && <span> • </span>}
                      {noteUpdatedAt && (
                        <span>
                          Updated {new Date(noteUpdatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  )}
                </header>
                {loadingNote ? (
                  <NoteSkeleton />
                ) : isEditing ? (
                  <div>
                    {(saveError || aiFormatError || uploadModelError) && (
                      <div className="mb-3 text-sm text-red-600">{saveError ?? aiFormatError ?? uploadModelError}</div>
                    )}
                    <div className="mb-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => void saveDraft()}
                        disabled={saving}
                      >
                        {saving ? 'Saving…' : 'Save (Ctrl+E)'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void formatWithAI()}
                        disabled={aiFormatting}
                      >
                        {aiFormatting ? 'Formatting…' : 'Format with AI'}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".glb,.gltf,.stl"
                        className="hidden"
                        onChange={onPickModel}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingModel}
                      >
                        {uploadingModel ? 'Uploading…' : 'Insert 3D model'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditing(false)
                          setDraftContent(noteContent || "")
                          setSaveError(null)
                          setAiFormatError(null)
                          setUploadModelError(null)
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </div>
                    <Textarea
                      ref={editorRef as any}
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      onKeyDown={onEditorKeyDown}
                      onPaste={onEditorPasteExtended}
                      placeholder="Write your note in Markdown…"
                      className="min-h-[220px] w-full resize-y bg-transparent font-mono text-sm"
                    />
                  </div>
                ) : (
                  <div className="group/reader">
                    {showExamInNotes ? (
                      <div>
                        <div className="mb-4 flex items-center justify-between">
                          <Button variant="outline" size="sm" onClick={() => setShowExamInNotes(false)}>
                            Back to note
                          </Button>
                        </div>
                        <ExamFromNotesPage />
                      </div>
                    ) : (
                      <MarkdownContent content={noteContent} />
                    )}
                  </div>
                )}
              </article>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function MarkdownContent({ content }: { content: string }) {
  // Utilities to modify mdast with parent tracking
  function visitWithParent(tree: any, visitor: (node: any, parent: any, index: number) => void) {
    function walk(node: any, parent: any) {
      const children = node && Array.isArray(node.children) ? node.children : []
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        visitor(child, node, i)
        walk(child, node)
      }
    }
    walk(tree, null)
  }

  // DOM-only Ctrl+D highlighter (temporary, not persisted)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrlD = (e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')
      if (!isCtrlD) return
      const root = containerRef.current
      if (!root) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return

      // Helper: find closest existing highlight span within root
      const closestHighlight = (node: Node | null): HTMLElement | null => {
        if (!node) return null
        let el: HTMLElement | null = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : (node.parentElement as HTMLElement | null)
        while (el && el !== root) {
          if (el.classList && el.classList.contains('dom-green-highlight')) return el
          el = el.parentElement
        }
        return null
      }

      // If caret is inside an existing highlight, toggle it off
      if (sel.isCollapsed) {
        const inside = closestHighlight(sel.anchorNode)
        if (inside) {
          e.preventDefault()
          const span = inside
          const lastChild = span.lastChild
          const parent = span.parentNode
          if (parent) {
            const frag = document.createDocumentFragment()
            while (span.firstChild) frag.appendChild(span.firstChild)
            parent.replaceChild(frag, span)
            sel.removeAllRanges()
            const after = document.createRange()
            if (lastChild && lastChild.parentNode) {
              after.setStartAfter(lastChild)
            } else {
              after.selectNodeContents(parent)
              after.collapse(false)
            }
            sel.addRange(after)
          }
        }
        return
      }

      const range = sel.getRangeAt(0)
      const containerNode = range.commonAncestorContainer
      // Only highlight if selection is within the markdown content container
      if (!root.contains(containerNode)) return
      e.preventDefault()

      const anchorHL = closestHighlight(sel.anchorNode)
      const focusHL = closestHighlight(sel.focusNode)

      // If both ends are inside the same highlight, unwrap it (toggle off)
      if (anchorHL && anchorHL === focusHL) {
        const span = anchorHL
        // Keep reference to last child to place caret after unwrapping
        const lastChild = span.lastChild
        const parent = span.parentNode
        if (parent) {
          const frag = document.createDocumentFragment()
          while (span.firstChild) frag.appendChild(span.firstChild)
          parent.replaceChild(frag, span)
          // Restore caret after the previously last child
          sel.removeAllRanges()
          const after = document.createRange()
          if (lastChild && lastChild.parentNode) {
            after.setStartAfter(lastChild)
          } else {
            // Fallback: place caret at end of parent
            after.selectNodeContents(parent)
            after.collapse(false)
          }
          sel.addRange(after)
        }
        return
      }

      // Otherwise, apply highlight normally
      try {
        const fragment = range.extractContents()
        const span = document.createElement('span')
        span.className = 'dom-green-highlight'
        span.style.backgroundColor = 'rgba(34,197,94,0.35)' // emerald-500 @ ~35%
        span.style.borderRadius = '4px'
        span.appendChild(fragment)
        range.insertNode(span)
        // Move caret to after the inserted span
        sel.removeAllRanges()
        const after = document.createRange()
        after.setStartAfter(span)
        after.collapse(true)
        sel.addRange(after)
      } catch {
        // Ignore selections that cannot be highlighted cleanly
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Mermaid rendering helpers
  const mermaidInitializedRef = React.useRef(false)
  const renderMermaidInto = React.useCallback(async (el: HTMLElement, code: string) => {
    try {
      const mod = await import('mermaid')
      const mermaid = (mod as any).default || (mod as any)
      if (!mermaidInitializedRef.current) {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'default' })
        mermaidInitializedRef.current = true
      }
      const id = 'mermaid-' + Math.random().toString(36).slice(2)
      const out = await mermaid.render(id, code)
      el.innerHTML = out.svg || out
    } catch (err: any) {
      el.innerHTML = `<pre style="color:#ef4444">Mermaid error: ${String(err?.message || err)}</pre>`
    }
  }, [])

  const MermaidDiagram: React.FC<{ code: string }> = ({ code }) => {
    const ref = React.useRef<HTMLDivElement | null>(null)
    React.useEffect(() => {
      const el = ref.current
      if (!el) return
      void renderMermaidInto(el, code)
    }, [code, renderMermaidInto])
    return (
      <div className="my-4 overflow-x-auto">
        <div ref={ref} className="min-w-[320px]" />
      </div>
    )
  }

  // Ensure unclosed mermaid fences don't swallow following content
  function fixUnclosedMermaidFences(src: string): string {
    const lines = src.split(/\r?\n/)
    const out: string[] = []
    let inMermaid = false
    for (const raw of lines) {
      const line = raw
      const t = line.trim()
      if (!inMermaid) {
        out.push(line)
        if (/^```\s*mermaid\s*$/i.test(t)) {
          inMermaid = true
        }
      } else {
        out.push(line)
        if (/^```\s*$/.test(t)) {
          inMermaid = false
        }
      }
    }
    if (inMermaid) {
      out.push('```')
    }
    return out.join('\n')
  }

  // Normalize legacy ':::model src="..."' (no braces) into ':::model{src="..."}' so remark-directive recognizes it
  function normalizeModelDirectives(src: string): string {
    if (!src) return src
    // Replace lines starting with :::model <attrs> until end of line, followed by closing :::
    // Example:
    // :::model src="URL" scale="1" autoRotate="true"
    // :::
    return src.replace(/(^|\n):::model\s+([^\n]+)\n:::/g, (_m, p1, attrs) => {
      const trimmed = String(attrs).trim()
      return `${p1}:::model{${trimmed}}\n:::`
    })
  }

  const safeContent = React.useMemo(() => normalizeModelDirectives(fixUnclosedMermaidFences(content || '')), [content])

  // Custom remark plugin to handle directives like :::center and info boxes :::info/:::warning/etc
  const directivePlugin = React.useCallback(function () {
    return (tree: any) => {
      visit(tree, (node: any) => {
        if (node && (node.type === 'containerDirective' || node.type === 'leafDirective')) {
          const name = node.name
          if (!name) return
          const data = node.data || (node.data = {})
          const hast = data.hProperties || (data.hProperties = {})

          // Center directive
          if (name === 'center') {
            data.hName = 'div'
            hast.className = (hast.className ? hast.className + ' ' : '') + 'text-center'
          }

          // Info boxes with color variants
          const boxMap: Record<string, string> = {
            info: 'border-blue-400 bg-blue-100 text-blue-900 dark:border-blue-600/50 dark:bg-blue-900 dark:text-blue-100',
            warning: 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-600/50 dark:bg-amber-900 dark:text-amber-100',
            success: 'border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-600/50 dark:bg-emerald-900 dark:text-emerald-100',
            error: 'border-red-400 bg-red-100 text-red-900 dark:border-red-600/50 dark:bg-red-900 dark:text-red-100',
            note: 'border-slate-400 bg-slate-100 text-slate-900 dark:border-slate-600/50 dark:bg-slate-900 dark:text-slate-100',
            tip: 'border-purple-400 bg-purple-100 text-purple-900 dark:border-purple-600/50 dark:bg-purple-900 dark:text-purple-100',
          }
          if (boxMap[name]) {
            data.hName = 'div'
            const base = 'my-4 rounded-lg border px-3 py-2 shadow-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0'
            hast.className = (hast.className ? hast.className + ' ' : '') + base + ' ' + boxMap[name]
            return
          }

          // Matching directive: :::matching{shuffle="true|false" title="..."}
          // Content: list items formatted as "Term :: Definition"
          if (name === 'matching') {
            data.hName = 'matching'
            if (node.attributes) Object.assign(hast, node.attributes)

            const nodeToText = (n: any): string => {
              if (!n) return ''
              if (typeof n.value === 'string') return n.value
              const parts: string[] = []
              const kids = Array.isArray(n.children) ? n.children : []
              for (const k of kids) parts.push(nodeToText(k))
              return parts.join('')
            }

            const pairs: Array<{ left: string; right: string }> = []
            const children = Array.isArray((node as any).children) ? (node as any).children : []
            for (const ch of children) {
              if (ch.type === 'list' && Array.isArray(ch.children)) {
                for (const li of ch.children) {
                  const raw = nodeToText(li).trim()
                  if (!raw) continue
                  const segs = raw.split(/\s+::\s+/)
                  if (segs.length >= 2) {
                    const left = segs[0]?.trim() || ''
                    const right = segs.slice(1).join(' :: ').trim()
                    if (left && right) pairs.push({ left, right })
                  }
                }
              } else if (ch.type === 'paragraph') {
                const raw = nodeToText(ch)
                const lines = raw.split(/\n+/)
                for (const line of lines) {
                  const segs = line.split(/\s+::\s+/)
                  if (segs.length >= 2) {
                    const left = segs[0]?.trim() || ''
                    const right = segs.slice(1).join(' :: ').trim()
                    if (left && right) pairs.push({ left, right })
                  }
                }
              }
            }

            ;(data as any).hProperties = {
              ...hast,
              pairs,
              pairsJson: JSON.stringify(pairs),
            }
            return
          }

          // YouTube directive: :::youtube url="..." [start="SECONDS"] [title="..."]
          if (name === 'youtube') {
            data.hName = 'youtube'
            if (node.attributes) {
              Object.assign(hast, node.attributes)
            }
            // Back-compat: attributes specified as text children without braces
            if ((!Object.keys(hast).length) && Array.isArray((node as any).children)) {
              const first = (node as any).children[0]
              const txt = typeof first?.value === 'string' ? first.value : ''
              if (txt) {
                const attrs: Record<string, string> = {}
                const re = /(\w+)="([^"]*)"/g
                let m: RegExpExecArray | null
                while ((m = re.exec(txt)) !== null) {
                  attrs[m[1]] = m[2]
                }
                Object.assign(hast, attrs)
              }
            }
            return
          }

          // MCQ directive: :::mcq{question="..." multi="true|false" shuffle="true|false"}
          // Content should include a task list where [x] marks correct answers, e.g.
          // - [ ] Option A
          // - [x] Option B
          if (name === 'mcq') {
            data.hName = 'mcq'
            if (node.attributes) Object.assign(hast, node.attributes)

            const nodeToText = (n: any): string => {
              if (!n) return ''
              if (typeof n.value === 'string') return n.value
              const parts: string[] = []
              const kids = Array.isArray(n.children) ? n.children : []
              for (const k of kids) parts.push(nodeToText(k))
              return parts.join('')
            }

            let question: string | undefined = (hast as any).question
            const options: Array<{ text: string; correct: boolean }> = []

            const children = Array.isArray((node as any).children) ? (node as any).children : []
            for (const ch of children) {
              if (!question && ch.type === 'paragraph') {
                const qtxt = nodeToText(ch).trim()
                if (qtxt) question = qtxt
              }
              if (ch.type === 'list' && Array.isArray(ch.children)) {
                for (const li of ch.children) {
                  if (!li) continue
                  const raw = nodeToText(li)
                  const correct = typeof li.checked === 'boolean' ? !!li.checked : /^\s*\[[xX]\]/.test(raw)
                  const txt = raw.replace(/^\s*\[[xX\s]\]\s*/, '').trim()
                  if (txt) options.push({ text: txt, correct })
                }
              }
            }

            ;(data as any).hProperties = {
              ...hast,
              question: question || '',
              options,
              optionsJson: JSON.stringify(options),
            }
            return
          }

          // 3D model directive: :::model src="..." [scale="1"] [autoRotate="true|false"]
          if (name === 'model') {
            data.hName = 'model3d'
            // pass through attributes
            if (node.attributes) {
              Object.assign(hast, node.attributes)
            }
            // Back-compat: if attributes were written on the same line without braces
            // e.g., :::model src="..." scale="1" -> remark-directive treats them as text children
            // Try to parse the first child text for key="value" pairs.
            if ((!hast.src || !Object.keys(hast).length) && Array.isArray((node as any).children)) {
              const first = (node as any).children[0]
              const txt = typeof first?.value === 'string' ? first.value : ''
              if (txt) {
                const attrs: Record<string, string> = {}
                const re = /(\w+)="([^"]*)"/g
                let m: RegExpExecArray | null
                while ((m = re.exec(txt)) !== null) {
                  attrs[m[1]] = m[2]
                }
                Object.assign(hast, attrs)
              }
            }
            return
          }
        }
      })
    }
  }, [])

  // Gap syntax plugin: transform (gap:answer) into <gap answer="..." /> hast nodes
  const gapPlugin = React.useCallback(function () {
    // Allow optional whitespace around colon and tolerate soft line breaks inside
    // Examples matched: (gap:Paris), (gap: Paris), (gap:\nParis)
    const GAP_RE = /\(gap\s*:\s*([\s\S]*?)\)/g
    return (tree: any) => {
      const toPlain = (n: any): string => {
        if (!n) return ''
        if (n.type === 'text' && typeof n.value === 'string') return n.value
        if (n.type === 'break') return '\n'
        const kids = Array.isArray(n.children) ? n.children : []
        let out = ''
        for (const k of kids) out += toPlain(k)
        return out
      }

      visitWithParent(tree, (node, parent, index) => {
        if (!parent || typeof node?.type !== 'string') return

        // Case 1: operate on paragraphs/headings as a whole to catch cross-node patterns
        if ((node.type === 'paragraph' || node.type === 'heading') && Array.isArray(node.children)) {
          const text = toPlain(node)
          if (!GAP_RE.test(text)) return
          GAP_RE.lastIndex = 0

          const parts: any[] = []
          let lastIndex = 0
          let m: RegExpExecArray | null
          while ((m = GAP_RE.exec(text)) !== null) {
            const start = m.index
            const end = GAP_RE.lastIndex
            const before = text.slice(lastIndex, start)
            if (before) parts.push({ type: 'text', value: before })
            const answer = (m[1] || '').replace(/\s+/g, ' ').trim()
            parts.push({ type: 'gap', data: { hName: 'gap', hProperties: { answer } } })
            lastIndex = end
          }
          const after = text.slice(lastIndex)
          if (after) parts.push({ type: 'text', value: after })
          // Replace the node's children with flattened parts
          node.children = parts
          return
        }

        // Case 2: fallback for single text nodes
        if (node.type !== 'text' || typeof node.value !== 'string') return
        const text: string = node.value
        if (!GAP_RE.test(text)) return
        GAP_RE.lastIndex = 0

        const parts: any[] = []
        let lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = GAP_RE.exec(text)) !== null) {
          const start = m.index
          const end = GAP_RE.lastIndex
          const before = text.slice(lastIndex, start)
          if (before) parts.push({ type: 'text', value: before })
          const answer = (m[1] || '').replace(/\s+/g, ' ').trim()
          parts.push({ type: 'gap', data: { hName: 'gap', hProperties: { answer } } })
          lastIndex = end
        }
        const after = text.slice(lastIndex)
        if (after) parts.push({ type: 'text', value: after })
        parent.children.splice(index, 1, ...parts)
      })
    }
  }, [])

  // Autolink YouTube plugin: transform a paragraph containing only a YouTube URL
  // into a <youtube url="..." /> node so it renders as an embed.
  const youtubeAutolinkPlugin = React.useCallback(function () {
    const YT_RE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=[^\s&]+|youtu\.be\/[^\s?&#]+|youtube\.com\/shorts\/[^\s?&#]+|youtube\.com\/embed\/[^\s?&#]+)/i
    return (tree: any) => {
      visitWithParent(tree, (node, parent, index) => {
        if (!parent || typeof node?.type !== 'string') return
        if (node.type !== 'paragraph') return
        const children = Array.isArray(node.children) ? node.children : []
        if (children.length !== 1) return
        const only = children[0]
        let url: string | null = null
        if (only.type === 'link' && typeof only.url === 'string' && YT_RE.test(only.url)) {
          url = only.url
        } else if (only.type === 'text' && typeof only.value === 'string') {
          const t = only.value.trim()
          if (YT_RE.test(t)) url = t
        }
        if (!url) return
        // Replace paragraph with a lightweight node that maps to a custom component
        parent.children.splice(index, 1, {
          type: 'youtube',
          data: {
            hName: 'youtube',
            hProperties: { url },
          },
        })
      })
    }
  }, [])

  return (
    <div ref={containerRef} className="prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath, remarkDirective, youtubeAutolinkPlugin, directivePlugin, gapPlugin]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Fill-the-gaps renderer for nodes created by gapPlugin
          gap: (props: any) => {
            const answer: string = (props as any)?.answer || ''
            const [value, setValue] = React.useState('')
            const [touched, setTouched] = React.useState(false)
            const [revealed, setRevealed] = React.useState(false)
            const [justFilled, setJustFilled] = React.useState(false)
            const pressTimer = React.useRef<number | null>(null)
            const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
            const valNorm = norm(value)
            const ansNorm = norm(answer)
            const dist = value ? levenshteinDistance(valNorm, ansNorm) : Infinity
            const autoCompleteIfClose = (v: string) => {
              const d = levenshteinDistance(norm(v), ansNorm)
              if (v && d <= 2) {
                setValue(answer)
                setTouched(true)
                setRevealed(true)
                setJustFilled(true)
                window.setTimeout(() => setJustFilled(false), 220)
                return true
              }
              return false
            }
            const bgByDist = () => {
              if (revealed) return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800'
              if (!value) return 'bg-transparent'
              if (dist <= 2) return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800'
              if (dist <= 5) return 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800'
              return 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
            }
            const onReveal = () => { setValue(answer); setTouched(true); setRevealed(true) }
            const onPointerDown = () => {
              try { if (pressTimer.current) window.clearTimeout(pressTimer.current) } catch {}
              pressTimer.current = window.setTimeout(onReveal, 600) as unknown as number
            }
            const clearTimer = () => { if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null } }
            return (
              <span className="inline-flex items-center align-baseline">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-colors transition-transform duration-200 border ${bgByDist()} ${justFilled ? 'scale-105' : 'scale-100'}`}
                  onPointerDown={onPointerDown}
                  onPointerUp={clearTimer}
                  onPointerLeave={clearTimer}
                  title="Long-press to reveal"
                >
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const v = e.target.value
                      setValue(v)
                      if (!autoCompleteIfClose(v)) {
                        // if user edits again after reveal, remove revealed state
                        if (revealed && norm(v) !== ansNorm) setRevealed(false)
                      }
                    }}
                    onBlur={() => {
                      setTouched(true)
                      if (!revealed) autoCompleteIfClose(value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setTouched(true)
                        if (!revealed) autoCompleteIfClose(value)
                      }
                    }}
                    placeholder="…"
                    size={Math.max(5, Math.min(24, (value || '').length || 5))}
                    className={`bg-transparent outline-none focus:outline-none border-b-2 border-transparent transition-colors duration-200 text-[0.95em] leading-5`}
                    aria-label="Fill the gap"
                  />
                </span>
              </span>
            )
          },

          // Matching question renderer
          matching: (props: any) => {
            type Pair = { left: string; right: string }
            let initialPairs: Pair[] = []
            const propPairs = (props as any)?.pairs
            const pairsJson = (props as any)?.pairsJson
            if (Array.isArray(propPairs)) initialPairs = propPairs as Pair[]
            else if (typeof pairsJson === 'string') { try { const p = JSON.parse(pairsJson); if (Array.isArray(p)) initialPairs = p as Pair[] } catch {} }

            const title: string = (props as any)?.title || ''
            const shuffleProp = String((props as any)?.shuffle ?? '').toLowerCase()
            const shouldShuffle = shuffleProp === 'true'

            const [left] = React.useState<string[]>(() => initialPairs.map(p => p.left))
            const [right, setRight] = React.useState<string[]>(() => {
              const arr = initialPairs.map(p => p.right)
              if (shouldShuffle) {
                for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]] }
              }
              return arr
            })
            const [selection, setSelection] = React.useState<{ l: number | null; r: number | null }>({ l: null, r: null })
            // Confirmed correct matches: leftIdx -> rightIdx
            const [confirmed, setConfirmed] = React.useState<Record<number, number>>({})
            // Track a transient wrong attempt to flash feedback
            const [wrong, setWrong] = React.useState<{ l: number | null; r: number | null }>({ l: null, r: null })
            const wrongTimer = React.useRef<number | null>(null)
            // Subtle pop animation when a correct match is made
            const [justMatched, setJustMatched] = React.useState<{ l: number | null; r: number | null }>({ l: null, r: null })

            const correctMap: Record<number, number> = {}
            for (let i = 0; i < initialPairs.length; i++) {
              const pair = initialPairs[i]
              const rIndex = right.indexOf(pair.right)
              if (rIndex >= 0) correctMap[i] = rIndex
            }

            const total = initialPairs.length
            const score = Object.keys(confirmed).length

            const reset = () => {
              setConfirmed({})
              setSelection({ l: null, r: null })
              setWrong({ l: null, r: null })
              if (wrongTimer.current) { window.clearTimeout(wrongTimer.current); wrongTimer.current = null }
              if (shouldShuffle) setRight(prev => [...prev].sort(() => Math.random() - 0.5))
            }

            const shuffle = () => {
              // Clear state, then reshuffle right side
              setConfirmed({})
              setSelection({ l: null, r: null })
              setWrong({ l: null, r: null })
              if (wrongTimer.current) { try { window.clearTimeout(wrongTimer.current) } catch {} ; wrongTimer.current = null }
              setRight(prev => {
                const arr = [...prev]
                for (let i = arr.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1))
                  ;[arr[i], arr[j]] = [arr[j], arr[i]]
                }
                return arr
              })
            }

            // Handle selection and immediate grading
            const pickLeft = (i: number) => {
              if (i in confirmed) return
              setSelection(s => ({ l: i, r: s.r }))
            }
            const pickRight = (i: number) => {
              // Block if this right is already matched
              const alreadyTaken = Object.values(confirmed).includes(i)
              if (alreadyTaken) return
              setSelection(s => ({ l: s.l, r: i }))
            }
            React.useEffect(() => {
              const l = selection.l, r = selection.r
              if (l == null || r == null) return
              // Grade immediately
              if (correctMap[l] === r) {
                setConfirmed(prev => ({ ...prev, [l]: r }))
                setSelection({ l: null, r: null })
                setWrong({ l: null, r: null })
                setJustMatched({ l, r })
                window.setTimeout(() => setJustMatched({ l: null, r: null }), 220)
              } else {
                setWrong({ l, r })
                if (wrongTimer.current) window.clearTimeout(wrongTimer.current)
                wrongTimer.current = window.setTimeout(() => setWrong({ l: null, r: null }), 450) as unknown as number
                setSelection({ l: null, r: null })
              }
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [selection.l, selection.r])

            return (
              <div className="my-4 rounded-xl border bg-white/60 dark:bg-neutral-950/40 backdrop-blur p-4 shadow-sm">
                {title && <div className="mb-3 text-[15px] font-semibold tracking-tight">{title}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    {left.map((txt, i) => {
                      const active = selection.l === i
                      const isMatched = i in confirmed
                      const isWrong = wrong.l === i
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={isMatched}
                          onClick={() => pickLeft(i)}
                          className={`w-full text-left px-3 py-2 rounded-md border transition-all transition-transform
                            ${isMatched ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/50'
                              : isWrong ? 'border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-950/50'
                              : active ? 'border-neutral-900 dark:border-neutral-200 bg-neutral-100 dark:bg-neutral-800'
                              : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50/70 dark:hover:bg-neutral-900'} ${justMatched.l === i ? 'scale-105' : 'scale-100'}`}
                        >
                          {txt}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-col gap-2">
                    {right.map((txt, i) => {
                      const active = selection.r === i
                      // Determine state from confirmed/wrong
                      const matchedLeft = Object.entries(confirmed).find(([l, ri]) => Number(ri) === i)
                      const isMatched = Boolean(matchedLeft)
                      const isWrong = wrong.r === i
                      const color = isMatched
                        ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/50'
                        : isWrong
                          ? 'border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-950/50'
                          : active
                            ? 'border-neutral-900 dark:border-neutral-200 bg-neutral-100 dark:bg-neutral-800'
                            : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50/70 dark:hover:bg-neutral-900'
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={isMatched}
                          onClick={() => pickRight(i)}
                          className={`w-full text-left px-3 py-2 rounded-md border transition-all transition-transform ${color} ${justMatched.r === i ? 'scale-105' : 'scale-100'}`}
                        >
                          {txt}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`text-sm ${score === total ? 'text-emerald-600' : 'text-neutral-600 dark:text-neutral-400'}`}>{score}/{total} matched</span>
                  <button type="button" onClick={shuffle} className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900">Shuffle</button>
                  <button type="button" onClick={reset} className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900">Reset</button>
                </div>
              </div>
            )
          },
          // Interactive Multiple Choice Question renderer
          mcq: (props: any) => {
            type Opt = { text: string; correct: boolean }
            const question: string = (props as any)?.question || ''
            let initialOptions: Opt[] = []
            const propOptions = (props as any)?.options
            const optionsJson = (props as any)?.optionsJson
            if (Array.isArray(propOptions)) {
              initialOptions = propOptions as Opt[]
            } else if (typeof optionsJson === 'string') {
              try {
                const parsed = JSON.parse(optionsJson)
                if (Array.isArray(parsed)) initialOptions = parsed as Opt[]
              } catch {}
            }
            const multiProp = String((props as any)?.multi ?? '').toLowerCase()
            const shuffleProp = String((props as any)?.shuffle ?? '').toLowerCase()
            const allowMulti = multiProp === 'true' || (multiProp === '' && initialOptions.filter(o => o.correct).length > 1)
            const shouldShuffle = shuffleProp === 'true'
            const singleMode = !allowMulti

            const [options, setOptions] = React.useState<Opt[]>(() => {
              if (!shouldShuffle) return initialOptions
              const arr = [...initialOptions]
              for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[arr[i], arr[j]] = [arr[j], arr[i]]
              }
              return arr
            })
            const [selected, setSelected] = React.useState<Set<number>>(new Set())
            const [checked, setChecked] = React.useState(false)
            const [justGradedIndex, setJustGradedIndex] = React.useState<number | null>(null)

            const toggle = (idx: number) => {
              if (checked && singleMode) return
              setSelected(prev => {
                const next = new Set(prev)
                if (allowMulti) {
                  if (next.has(idx)) next.delete(idx); else next.add(idx)
                } else {
                  next.clear(); next.add(idx)
                }
                return next
              })
              if (singleMode) {
                // Auto-grade immediately on click for single-choice
                setJustGradedIndex(idx)
                setChecked(true)
              }
            }

            const onCheck = () => setChecked(true)
            const onReset = () => { setSelected(new Set()); setChecked(false); setJustGradedIndex(null); if (shouldShuffle) setOptions(prev => [...prev].sort(() => Math.random() - 0.5)) }

            const totalCorrect = options.filter(o => o.correct).length
            const userCorrect = Array.from(selected).filter(i => options[i]?.correct).length
            const allMatched = checked && userCorrect === totalCorrect && selected.size === totalCorrect

            return (
              <div className="my-4 rounded-xl border bg-white/60 dark:bg-neutral-950/40 backdrop-blur p-4 shadow-sm">
                {question && <div className="mb-3 text-[15px] font-semibold tracking-tight">{question}</div>}
                <div className="flex flex-col gap-2">
                  {options.map((opt, i) => {
                    const isSel = selected.has(i)
                    const isCorrect = opt.correct
                    const graded = singleMode ? checked : checked
                    const state = graded ? (isCorrect ? 'correct' : (isSel ? 'wrong' : 'idle')) : (isSel ? 'active' : 'idle')
                    const base = 'group w-full text-left px-3 py-2 rounded-md border transition-all duration-200'
                    const styles: Record<string,string> = {
                      idle: 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50/70 dark:hover:bg-neutral-900 hover:shadow-sm hover:-translate-y-[1px]',
                      active: 'border-neutral-900 dark:border-neutral-200 bg-neutral-100 dark:bg-neutral-800 shadow-sm',
                      correct: 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-200',
                      wrong: 'border-red-400 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-950/50 dark:text-red-200',
                    }
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggle(i)}
                        className={`${base} ${styles[state]} ${!checked || allowMulti ? 'cursor-pointer' : 'cursor-default'} focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700`}
                        disabled={singleMode && checked}
                      >
                        <div className="flex items-center gap-2">
                          {allowMulti ? (
                            <span
                              className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[6px] border transition-all ${isSel ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black border-neutral-900 dark:border-neutral-200' : 'border-neutral-400 group-hover:border-neutral-600 dark:group-hover:border-neutral-400'}`}
                              aria-hidden
                            >
                              {isSel && (
                                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 10l3 3 7-7" />
                                </svg>
                              )}
                            </span>
                          ) : (
                            <span
                              className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${isSel ? 'border-neutral-900 dark:border-neutral-200' : 'border-neutral-400 group-hover:border-neutral-600 dark:group-hover:border-neutral-400'}`}
                              aria-hidden
                            >
                              <span className={`h-2.5 w-2.5 rounded-full transition-transform ${isSel ? 'scale-100 bg-neutral-900 dark:bg-neutral-100' : 'scale-0'}`} />
                            </span>
                          )}
                          <span className="leading-relaxed">{opt.text}</span>
                          {graded && isCorrect && (
                            <span className="ml-auto inline-flex items-center text-emerald-600 dark:text-emerald-400 text-sm opacity-0 animate-[fadeIn_.2s_ease-out_forwards]">✔</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
                {allowMulti ? (
                  <div className="mt-3 flex items-center gap-2">
                    {!checked ? (
                      <button
                        type="button"
                        onClick={onCheck}
                        className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
                        disabled={selected.size === 0}
                      >
                        Check
                      </button>
                    ) : (
                      <>
                        <span className={`text-sm ${allMatched ? 'text-emerald-600' : 'text-red-600'}`}>
                          {allMatched ? 'All correct!' : `You got ${userCorrect}/${totalCorrect} correct`}
                        </span>
                        <button
                          type="button"
                          onClick={onReset}
                          className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
                        >
                          Reset
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  checked && (
                    <div className="mt-3 text-sm">
                      {options[justGradedIndex ?? -1]?.correct ? (
                        <span className="text-emerald-600">Correct</span>
                      ) : (
                        <span className="text-red-600">Incorrect</span>
                      )}
                    </div>
                  )
                )}
              </div>
            )
          },
          // YouTube video renderer component
          youtube: (props: any) => {
            // Accept either a full URL or a videoId prop
            const url: string | undefined = (props as any)?.url
            const explicitId: string | undefined = (props as any)?.videoId || (props as any)?.id
            const startStr: string | undefined = (props as any)?.start || (props as any)?.t
            const title: string = (props as any)?.title || 'YouTube video'

            function parseStartSec(v?: string): number {
              if (!v) return 0
              // support "90", "1m30s", "2h3m4s"
              if (/^\d+$/.test(v)) return Number(v)
              const re = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i
              const m = v.match(re)
              if (!m) return 0
              const h = Number(m[1] || 0), mnt = Number(m[2] || 0), s = Number(m[3] || 0)
              return h * 3600 + mnt * 60 + s
            }

            function extractId(u?: string): { id: string | null; start: number } {
              let start = parseStartSec(startStr)
              if (!u && explicitId) return { id: explicitId, start }
              if (!u) return { id: null, start }
              try {
                const parsed = new URL(u)
                // time params
                if (!start) {
                  const t = parsed.searchParams.get('t') || parsed.searchParams.get('start')
                  start = parseStartSec(t || undefined)
                }
                const host = parsed.hostname.toLowerCase()
                if (host.includes('youtu.be')) {
                  const id = parsed.pathname.replace(/^\//, '').split('/')[0]
                  return { id: id || null, start }
                }
                if (host.includes('youtube.com')) {
                  if (parsed.pathname.startsWith('/watch')) {
                    const id = parsed.searchParams.get('v')
                    return { id, start }
                  }
                  if (parsed.pathname.startsWith('/shorts/')) {
                    const id = parsed.pathname.split('/')[2]
                    return { id, start }
                  }
                  if (parsed.pathname.startsWith('/embed/')) {
                    const id = parsed.pathname.split('/')[2]
                    return { id, start }
                  }
                }
              } catch {}
              return { id: null, start }
            }

            const { id, start } = extractId(url)
            if (!id) return <div className="text-sm text-red-600">Invalid YouTube URL</div>
            const src = `https://www.youtube-nocookie.com/embed/${id}?rel=0${start ? `&start=${start}` : ''}`

            return (
              <div className="my-4 w-full overflow-hidden rounded-md border bg-black/5 dark:bg-white/5">
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    src={src}
                    title={title}
                    className="absolute left-0 top-0 h-full w-full"
                    frameBorder={0}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            )
          },
          // 3D model renderer component
          model3d: (props: any) => {
            const src: string | undefined = (props as any)?.src
            const scaleStr: string | undefined = (props as any)?.scale
            const autoRotateStr: string | undefined = (props as any)?.autoRotate
            const scale = isNaN(Number(scaleStr)) ? 1 : Number(scaleStr)
            const autoRotate = String(autoRotateStr).toLowerCase() === 'true'

            if (!src) return <div className="text-sm text-red-600">Missing model src</div>

            const ext = src.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase()

            const GLTF: React.FC = () => {
              const { scene } = useGLTF(src) as any
              return <primitive object={scene} scale={scale} />
            }

            const STL: React.FC = () => {
              const geom = (window as any) ? undefined : undefined
              // useLoader cannot be used conditionally without a component split; we wrap per ext below
              return null
            }

            const STLMesh: React.FC = () => {
              const geom = (require('@react-three/fiber').useLoader as any)(STLLoader, src)
              return (
                <mesh geometry={geom} scale={scale} castShadow receiveShadow>
                  <meshStandardMaterial color="#bbbbbb" metalness={0.2} roughness={0.6} />
                </mesh>
              )
            }

            const ModelInner: React.FC = () => {
              if (ext === 'glb' || ext === 'gltf') return <GLTF />
              if (ext === 'stl') return <STLMesh />
              return <group />
            }

            return (
              <div className="my-4 w-full h-[360px] rounded-md border bg-neutral-50 dark:bg-neutral-900">
                <Canvas shadows camera={{ position: [2.5, 1.5, 2.5], fov: 45 }}>
                  <ambientLight intensity={0.6} />
                  <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
                  <React.Suspense fallback={null}>
                    <Bounds fit clip observe margin={1.2}>
                      <ModelInner />
                    </Bounds>
                  </React.Suspense>
                  <OrbitControls enableDamping makeDefault autoRotate={autoRotate} autoRotateSpeed={0.5} />
                </Canvas>
              </div>
            )
          },
          // Intercept <pre><code class="language-mermaid">...</code></pre> and render Mermaid without pre wrapper
          pre: (props: any) => {
            try {
              const child: any = Array.isArray(props.children) ? props.children[0] : props.children
              const className: string | undefined = child?.props?.className
              const isMermaid = typeof className === 'string' && /language-mermaid/.test(className)
              if (isMermaid) {
                const raw = child?.props?.children
                const codeText = Array.isArray(raw) ? String(raw.join('')) : String(raw ?? '')
                return <MermaidDiagram code={(codeText || '').trim()} />
              }
            } catch {}
            return <pre {...props} />
          },
          // Inline gap element renderer (Levenshtein-graded, long-press reveal)
          gap: ({ node, ...props }: any) => {
            const answer: string = (props as any)?.answer || (node as any)?.properties?.answer || ''
            const [value, setValue] = React.useState('')
            const [revealed, setRevealed] = React.useState(false)
            const [justFilled, setJustFilled] = React.useState(false)
            const pressTimer = React.useRef<number | null>(null)

            const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
            const valNorm = norm(value)
            const ansNorm = norm(answer)
            const dist = value ? levenshteinDistance(valNorm, ansNorm) : Infinity

            const autoCompleteIfClose = (v: string) => {
              const d = levenshteinDistance(norm(v), ansNorm)
              if (v && d <= 2) {
                setValue(answer)
                setRevealed(true)
                setJustFilled(true)
                window.setTimeout(() => setJustFilled(false), 220)
                return true
              }
              return false
            }

            const bgByDist = () => {
              if (revealed) return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800'
              if (!value) return 'bg-transparent border-neutral-300'
              if (dist <= 2) return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800'
              if (dist <= 5) return 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800'
              return 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
            }

            const onReveal = () => { setValue(answer); setRevealed(true) }
            const onPointerDown = () => {
              try { if (pressTimer.current) window.clearTimeout(pressTimer.current) } catch {}
              pressTimer.current = window.setTimeout(onReveal, 600) as unknown as number
            }
            const clearTimer = () => { if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null } }

            return (
              <span className="mx-1 inline-flex items-center align-baseline">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-colors transition-transform duration-200 border ${bgByDist()} ${justFilled ? 'scale-105' : 'scale-100'}`}
                  onPointerDown={onPointerDown}
                  onPointerUp={clearTimer}
                  onPointerLeave={clearTimer}
                  title="Long-press to reveal"
                >
                  <input
                    aria-label="Fill in the gap"
                    className={`bg-transparent outline-none focus:outline-none border-b-2 border-transparent text-sm leading-5 px-1`}
                    value={value}
                    onChange={(e) => {
                      const v = e.target.value
                      setValue(v)
                      if (!autoCompleteIfClose(v)) {
                        if (revealed && norm(v) !== ansNorm) setRevealed(false)
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { if (!revealed) autoCompleteIfClose(value) } }}
                    placeholder="…"
                    size={Math.max(5, Math.min(24, (value || '').length || 5))}
                  />
                </span>
              </span>
            )
          },
          h1: (props: any) => (
            <h1 className="mt-6 scroll-m-20 text-4xl font-bold tracking-tight" {...props} />
          ),
          h2: (props: any) => (
            <h2 className="mt-10 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0" {...props} />
          ),
          h3: (props: any) => (
            <h3 className="mt-8 scroll-m-20 text-2xl font-semibold tracking-tight" {...props} />
          ),
          h4: (props: any) => (
            <h4 className="mt-6 scroll-m-20 text-xl font-semibold tracking-tight" {...props} />
          ),
          table: (props: any) => (
            <div className="my-6 w-full overflow-x-auto">
              <table className="w-full text-left border-collapse [&_th]:border-b [&_td]:border-b [&_th]:px-3 [&_td]:px-3 [&_th]:py-2 [&_td]:py-2" {...props} />
            </div>
          ),
          img: (props: any) => {
            const src: string | undefined = props?.src
            const isDataUri = typeof src === 'string' && src.startsWith('data:')
            const ZoomableImg: React.FC<any> = (imgProps: any) => {
              const [open, setOpen] = React.useState(false)
              const [enter, setEnter] = React.useState(false)
              React.useEffect(() => {
                if (open) {
                  const id = setTimeout(() => setEnter(true), 0)
                  return () => clearTimeout(id)
                }
                setEnter(false)
              }, [open])

              const src: string | undefined = imgProps?.src
              const alt: string = imgProps?.alt || ''

              return (
                <>
                  {/* Inline (small) image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="my-4 block w-full max-w-[360px] rounded-md border cursor-zoom-in transition-all duration-300 ease-in-out"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onClick={() => setOpen(true)}
                    {...imgProps}
                    alt={alt}
                  />

                  {/* Lightbox overlay for full-size view */}
                  {open && (
                    <div
                      className={`fixed inset-0 z-50 bg-black/70 transition-opacity duration-200 ${enter ? 'opacity-100' : 'opacity-0'}`}
                      onClick={() => setOpen(false)}
                    >
                      <div className="flex h-full w-full items-center justify-center p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={alt}
                          className={`max-h-[90vh] max-w-[90vw] rounded-md shadow-2xl transition-transform duration-200 ${enter ? 'scale-100' : 'scale-95'}`}
                        />
                      </div>
                    </div>
                  )}
                </>
              )
            }
            return <ZoomableImg {...props} />
          },
          a: (props: any) => (
            <a className="underline decoration-muted-foreground underline-offset-4 hover:text-foreground" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          ul: (props: any) => (
            <ul className="my-4 ml-6 list-disc [&>li]:mt-2" {...props} />
          ),
          ol: (props: any) => (
            <ol className="my-4 ml-6 list-decimal [&>li]:mt-2" {...props} />
          ),
          blockquote: (props: any) => (
            <blockquote className="mt-6 border-l-2 pl-6 italic text-muted-foreground" {...props} />
          ),
          // Loosened typing to support 'inline' prop from react-markdown Code component
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code className={(className ? className + ' ' : '') + 'rounded bg-muted px-1.5 py-0.5 text-sm'} {...props}>
                  {children}
                </code>
              )
            }
            // Detect Mermaid blocks
            const langMatch = typeof className === 'string' ? className.match(/language-(\w+)/) : null
            const lang = langMatch?.[1]?.toLowerCase()
            const codeText = String(children ?? '').trim()
            if (lang === 'mermaid') {
              return <MermaidDiagram code={codeText} />
            }
            // Block code: single, minimal element (no outer wrapper), tight spacing
            return (
              <code
                className={(className ? className + ' ' : '') + 'inline-block my-0.1 max-w-full overflow-x-auto bg-neutral-900 text-neutral-50 px-2 py-1 whitespace-pre font-mono text-[13px] leading-6 align-top'}
                {...props}
              >
                {children}
              </code>
            )
          },
        } as any}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  )
}

// Utilities for remark plugin
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function visit(tree: any, visitor: (node: any) => void) {
  const walk = (node: any) => {
    visitor(node)
    const children = node.children || []
    for (const child of children) walk(child)
  }
  walk(tree)
}

function NoteSkeleton() {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-8">
        <Skeleton className="mb-2 h-9 w-2/3" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-10/12" />
        <Skeleton className="h-4 w-9/12" />
      </div>
      <div className="my-6">
        <Skeleton className="h-48 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </article>
  )
}
