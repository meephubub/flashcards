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

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false)
  const [draftContent, setDraftContent] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [aiFormatting, setAiFormatting] = useState(false)
  const [aiFormatError, setAiFormatError] = useState<string | null>(null)

  // Minimal select-note dialog state
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [selectLoading, setSelectLoading] = useState(false)
  const [selectError, setSelectError] = useState<string | null>(null)
  const [userNotes, setUserNotes] = useState<Pick<Note, "id" | "title" | "updated_at" | "category">[]>([])

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
  const handleCreateNote = async ({ title, category, content }: { title: string; category?: string; content?: string }) => {
    if (!user?.id) return
    setCreating(true)
    setCreateError(null)
    const { data, error } = await supabase
      .from("notes")
      .insert([{ title, category: category ?? "", content: content ?? "", user_id: user.id }])
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
                  <p className="text-sm text-muted-foreground">Choose a note from the sidebar to preview its content.</p>
                </div>
                <NoteSkeleton />
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
                    {(saveError || aiFormatError) && (
                      <div className="mb-3 text-sm text-red-600">{saveError ?? aiFormatError}</div>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditing(false)
                          setDraftContent(noteContent || "")
                          setSaveError(null)
                          setAiFormatError(null)
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </div>
                    <Textarea
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      onKeyDown={onEditorKeyDown}
                      onPaste={onEditorPaste}
                      placeholder="Write your note in Markdown…"
                      className="min-h-[220px] w-full resize-y bg-transparent font-mono text-sm"
                    />
                  </div>
                ) : (
                  <div className="group/reader">
                    <MarkdownContent content={noteContent} />
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
            return
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
        }
      })
    }
  }, [])

  // Gap syntax plugin: transform (gap:answer) into <gap answer="..." /> hast nodes
  const gapPlugin = React.useCallback(function () {
    const GAP_RE = /\(gap:([^\)]+)\)/g
    return (tree: any) => {
      visitWithParent(tree, (node, parent, index) => {
        if (!parent || typeof node?.type !== 'string') return
        // Only split text nodes
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
          const answer = (m[1] || '').trim()
          parts.push({
            type: 'gap',
            data: {
              hName: 'gap',
              hProperties: { answer },
            },
          })
          lastIndex = end
        }
        const after = text.slice(lastIndex)
        if (after) parts.push({ type: 'text', value: after })
        // Replace this child with expanded parts
        parent.children.splice(index, 1, ...parts)
      })
    }
  }, [])

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath, remarkDirective, directivePlugin, gapPlugin]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Inline gap element renderer
          gap: ({ node, ...props }: any) => {
            const answer: string = (props as any)?.answer || (node as any)?.properties?.answer || ''
            // Local state per instance
            const [value, setValue] = React.useState('')
            const [status, setStatus] = React.useState<'idle' | 'pending' | 'correct' | 'incorrect'>('idle')
            const answerEmbeddingRef = React.useRef<Float32Array | null>(null)
            const timerRef = React.useRef<number | null>(null)

            const grade = React.useCallback(async (input: string) => {
              const trimmed = input.trim()
              if (!trimmed) {
                setStatus('idle')
                return
              }
              setStatus('pending')
              try {
                const mod = await import('@/app/actions/xenova-similarity')
                const ref = answerEmbeddingRef
                if (!ref.current) {
                  ref.current = await mod.getSentenceEmbedding(answer)
                }
                // Optional spellcheck to reduce small typos
                const maybeCorrected = mod.spellcheckAnswer ? mod.spellcheckAnswer(trimmed, answer) : trimmed
                const userEmb = await mod.getSentenceEmbedding(maybeCorrected)
                const sim = mod.cosineSimilarity(ref.current, userEmb)
                if (sim >= 0.8 || maybeCorrected.toLowerCase() === answer.toLowerCase()) setStatus('correct')
                else setStatus('incorrect')
              } catch (e) {
                // Fallback to simple match
                setStatus(maybeEqual(trimmed, answer) ? 'correct' : 'incorrect')
              }
            }, [answer])

            const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              const v = e.target.value
              setValue(v)
              if (timerRef.current) window.clearTimeout(timerRef.current)
              timerRef.current = window.setTimeout(() => {
                void grade(v)
              }, 500)
            }

            React.useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current) }, [])

            function maybeEqual(a: string, b: string) {
              return a.trim().toLowerCase() === b.trim().toLowerCase()
            }

            return (
              <span className="mx-1 inline-flex items-center gap-1 align-baseline">
                <input
                  aria-label="Fill in the gap"
                  className={`inline-block w-32 bg-transparent border border-neutral-300 px-2 py-0.5 text-sm rounded focus:outline-none focus:ring-0 ${status === 'correct' ? 'border-black' : status === 'incorrect' ? 'border-neutral-500' : ''}`}
                  value={value}
                  onChange={onChange}
                />
                <span className="text-xs text-neutral-700 select-none">
                  {status === 'pending' ? '…' : status === 'correct' ? '✓' : status === 'incorrect' ? '✗' : ''}
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
        {content}
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
