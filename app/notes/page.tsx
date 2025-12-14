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
import { toast } from "sonner"
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
import { WysiwygEditor } from "@/components/notes/wysiwyg-editor"
import { isOnline, loadNoteContent, saveNoteContent } from "@/lib/offline"

// react-markdown plugins
import remarkGfm from "remark-gfm"
import remarkMath from 'remark-math'
import remarkDirective from 'remark-directive'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Skeleton } from "@/components/ui/skeleton"
import { makeGroqRequest, generateExamMarkdownFromNote, gradeAnswerWithGroq } from "@/lib/groq"
import ExamFromNotesPage from "@/app/exam-from-notes/page"
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Bounds, useGLTF } from '@react-three/drei'
import { STLLoader } from 'three-stdlib'
import { Loader2, X, Star } from 'lucide-react'

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
  const [isStarred, setIsStarred] = useState<boolean>(false)
  const [starSaving, setStarSaving] = useState<boolean>(false)
  const [starError, setStarError] = useState<string | null>(null)
  // Custodial wallet + ownership pill state
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [noteOwnedByYou, setNoteOwnedByYou] = useState<boolean | null>(null)
  const [noteVerifying, setNoteVerifying] = useState<boolean>(false)
  const [noteAlreadyMinted, setNoteAlreadyMinted] = useState<boolean>(false)

  // Highlight color state (for DOM-only highlights in reader)
  const [highlightColor, setHighlightColor] = useState<'green' | 'red' | 'blue'>('green')

  // Keep MarkdownContent in sync without re-rendering it (avoid wiping DOM highlights)
  useEffect(() => {
    try { window.dispatchEvent(new CustomEvent('notes-set-highlight-color', { detail: { color: highlightColor } })) } catch { }
  }, [highlightColor])

  useEffect(() => {
    const loadWallet = async () => {
      if (!user?.id) return
      try {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('address')
          .eq('user_id', user.id)
          .maybeSingle()
        setWalletAddress(wallet?.address || "")
      } catch {
        setWalletAddress("")
      }
    }
    void loadWallet()
  }, [supabase, user?.id])

  // Toggle star for current note
  const toggleStar = React.useCallback(async () => {
    if (!user?.id || !currentNoteId) return
    if (starSaving) return
    setStarError(null)
    setStarSaving(true)
    const next = !isStarred
    // Optimistic update
    setIsStarred(next)
    try {
      const { data, error } = await supabase
        .from("notes")
        .update({ is_starred: next })
        .eq("id", currentNoteId)
        .eq("user_id", user.id)
        .select("is_starred")
        .single()
      if (error) {
        throw error
      }
      setIsStarred(Boolean((data as any)?.is_starred))
    } catch (e: any) {
      // Revert on failure
      setIsStarred(!next)
      setStarError(e?.message || "Failed to update star state")
    } finally {
      setStarSaving(false)
    }
  }, [user?.id, currentNoteId, isStarred, starSaving, supabase])

  // Sync ?noteId (or ?id) query param to selected note (CSR-safe without Suspense)
  // Only set from URL when a param is present; do NOT clear selection when absent.
  useEffect(() => {
    const applyFromUrl = () => {
      try {
        const sp = new URLSearchParams(window.location.search)
        const qId = sp.get('noteId') ?? sp.get('id')
        if (qId && qId !== currentNoteId) {
          setCurrentNoteId(qId)
        }
      } catch { }
    }
    applyFromUrl()
    window.addEventListener('popstate', applyFromUrl)
    return () => window.removeEventListener('popstate', applyFromUrl)
  }, [setCurrentNoteId, currentNoteId])

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
      try { setNoteUpdatedAt(new Date().toISOString()) } catch { }
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
  // Editor mode: Markdown (textarea) vs WYSIWYG (contentEditable)
  const [useWysiwyg, setUseWysiwyg] = useState(false)

  // Dictionary side panel state
  const [dictOpen, setDictOpen] = useState(false)
  const [dictWord, setDictWord] = useState<string>("")
  const [dictLoading, setDictLoading] = useState(false)
  const [dictError, setDictError] = useState<string | null>(null)
  const [dictEntries, setDictEntries] = useState<Array<{ pos?: string; definition: string; example?: string }>>([])
  // UI: slight open animation + resizable width
  const [dictAnimOpen, setDictAnimOpen] = useState(false)
  const [dictWidth, setDictWidth] = useState<number>(416) // ~26rem
  const dictResizeRef = React.useRef<{ startX: number; startW: number } | null>(null)

  // Q&A side panel state
  const [qaOpen, setQaOpen] = useState(false)
  const [qaAnimOpen, setQaAnimOpen] = useState(false)
  const [qaWidth, setQaWidth] = useState<number>(416)
  const qaResizeRef = React.useRef<{ startX: number; startW: number } | null>(null)
  const [qaQuestion, setQaQuestion] = useState<string>("")
  const [qaLoading, setQaLoading] = useState(false)
  const [qaError, setQaError] = useState<string | null>(null)
  const [qaAnswerMd, setQaAnswerMd] = useState<string>("")
  const [qaSnippet, setQaSnippet] = useState<string>("")
  type QaItem = { id: string; q: string; a?: string; snippet?: string; ts: number }
  const [qaHistory, setQaHistory] = useState<QaItem[]>([])

  // Fill-the-Gap mode (Alt+G)
  const [fillGapsMode, setFillGapsMode] = useState(false)
  const [fillGapsDensity, setFillGapsDensity] = useState<number>(0.35) // 0..1

  // Load/save Q&A history per note
  useEffect(() => {
    const id = currentNoteId || 'none'
    try {
      const raw = localStorage.getItem(`qa_history_${id}`)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) setQaHistory(arr)
        else setQaHistory([])
      } else setQaHistory([])
    } catch { setQaHistory([]) }
  }, [currentNoteId])
  useEffect(() => {
    const id = currentNoteId || 'none'
    try { localStorage.setItem(`qa_history_${id}`, JSON.stringify(qaHistory)) } catch { }
  }, [qaHistory, currentNoteId])

  // Exam side tab state
  const [examOpen, setExamOpen] = useState(false)
  const [examLoading, setExamLoading] = useState(false)
  const [examError, setExamError] = useState<string | null>(null)
  const [examMarkdown, setExamMarkdown] = useState<string>("")
  const [examVersion, setExamVersion] = useState(0)
  // Cache exam markdown per note id to avoid unnecessary regeneration
  const [examCache, setExamCache] = useState<Record<string, string>>({})
  // Compute a lightweight hash of the note content to avoid stale cache
  const contentHash = React.useMemo(() => {
    const src = (noteContent || draftContent || '').slice(0, 100000) // cap to keep it fast
    let h = 0
    for (let i = 0; i < src.length; i++) {
      h = (h * 31 + src.charCodeAt(i)) >>> 0
    }
    return h.toString(16)
  }, [noteContent, draftContent])
  const cacheKey = React.useMemo(() => currentNoteId ? `${currentNoteId}:${contentHash}` : '', [currentNoteId, contentHash])

  // Trigger a subtle slide/fade-in on open
  useEffect(() => {
    if (dictOpen) {
      // allow next paint to apply transitions
      const id = requestAnimationFrame(() => setDictAnimOpen(true))
      return () => cancelAnimationFrame(id)
    } else {
      setDictAnimOpen(false)
    }
  }, [dictOpen])

  useEffect(() => {
    if (qaOpen) {
      const id = requestAnimationFrame(() => setQaAnimOpen(true))
      return () => cancelAnimationFrame(id)
    } else {
      setQaAnimOpen(false)
    }
  }, [qaOpen])

  // Resize handlers
  const onDictResizeMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    dictResizeRef.current = { startX: e.clientX, startW: dictWidth }
    const onMove = (ev: MouseEvent) => {
      const ref = dictResizeRef.current
      if (!ref) return
      const dx = ref.startX - ev.clientX // dragging left increases width
      const next = Math.min(640, Math.max(320, ref.startW + dx)) // clamp 20rem..40rem
      setDictWidth(next)
    }
    const onUp = () => {
      dictResizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [dictWidth])

  const onQaResizeMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    qaResizeRef.current = { startX: e.clientX, startW: qaWidth }
    const onMove = (ev: MouseEvent) => {
      const ref = qaResizeRef.current
      if (!ref) return
      const dx = ref.startX - ev.clientX
      const next = Math.min(640, Math.max(320, ref.startW + dx))
      setQaWidth(next)
    }
    const onUp = () => {
      qaResizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [qaWidth])

  // Pastel color style menu state
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const [styleMenuError, setStyleMenuError] = useState<string | null>(null)
  const pastelColors = React.useMemo(() => (
    [
      { id: 'rose', label: 'Rose' },
      { id: 'peach', label: 'Peach' },
      { id: 'amber', label: 'Amber' },
      { id: 'mint', label: 'Mint' },
      { id: 'sky', label: 'Sky' },
      { id: 'lavender', label: 'Lavender' },
      { id: 'gray', label: 'Gray' },
    ] as const
  ), [])
  const pastelHex: Record<string, string> = {
    rose: '#f6d1d6',
    peach: '#f7d7c3',
    amber: '#f2e1b0',
    mint: '#cfeee7',
    sky: '#cfe3fb',
    lavender: '#ddd3fb',
    gray: '#e2e5ea',
  }

  // Insert or wrap selection with our custom color directive syntax
  // Syntax options supported:
  // 1) Shorthand: :rose[Text]
  // 2) Explicit: :c[Text]{color="rose"}
  const applyColorToSelection = React.useCallback((color: string) => {
    const el = editorRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? start
    const before = draftContent.slice(0, start)
    const selected = draftContent.slice(start, end)
    const after = draftContent.slice(end)
    const content = selected || 'text'
    const insertion = `:${color}[${content}]`
    const next = `${before}${insertion}${after}`
    setDraftContent(next)
    // place caret after inserted
    const caret = before.length + insertion.length
    setTimeout(() => {
      try { el.focus(); el.setSelectionRange(caret, caret) } catch { }
    }, 0)
    setStyleMenuOpen(false)
  }, [draftContent])

  const wrapSelection = React.useCallback((wrapperStart: string, wrapperEnd: string = wrapperStart) => {
    const el = editorRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? start
    const before = draftContent.slice(0, start)
    const selected = draftContent.slice(start, end) || 'text'
    const after = draftContent.slice(end)
    const insertion = `${wrapperStart}${selected}${wrapperEnd}`
    const next = `${before}${insertion}${after}`
    setDraftContent(next)
    const caretStart = before.length + wrapperStart.length
    const caretEnd = caretStart + selected.length
    setTimeout(() => {
      try { el.focus(); el.setSelectionRange(caretStart, caretEnd) } catch { }
    }, 0)
    setStyleMenuOpen(false)
  }, [draftContent])

  // Reset embedded exam mode when switching notes or unmounting
  useEffect(() => {
    return () => {
      try { setShowExamInNotes(false) } catch { }
    }
  }, [setShowExamInNotes])

  useEffect(() => {
    // When changing the selected note, leave exam mode
    try { setShowExamInNotes(false) } catch { }
  }, [currentNoteId, setShowExamInNotes])

  // Generate exam from current note using Alt+T
  const generateExam = React.useCallback(async (force: boolean = false) => {
    if (!currentNoteId) return
    const content = noteContent || draftContent || ""
    if (!content.trim()) return
    setExamOpen(true)
    if (force) {
      // Clear any previous cache entry to avoid reuse after closing/reopening
      setExamCache(prev => {
        const next = { ...prev }
        if (cacheKey) delete next[cacheKey]
        return next
      })
    }
    // Serve from cache when available unless force regeneration requested
    if (!force && cacheKey && examCache[cacheKey]) {
      setExamMarkdown(examCache[cacheKey])
      return
    }
    setExamLoading(true)
    setExamError(null)
    try {
      const md = await generateExamMarkdownFromNote(content, noteTitle || "Untitled")
      setExamMarkdown(md)
      setExamVersion(v => v + 1)
      if (cacheKey) setExamCache(prev => ({ ...prev, [cacheKey]: md }))
    } catch (err: any) {
      setExamError(err?.message || 'Failed to generate exam')
    } finally {
      setExamLoading(false)
    }
  }, [currentNoteId, noteContent, draftContent, noteTitle, examCache, cacheKey])

  // Alt+D: open dictionary for current selection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.altKey) || (e.key !== 'd' && e.key !== 'D')) return
      const sel = window.getSelection()?.toString() || ''
      const match = sel.match(/[A-Za-z][A-Za-z'\-]*/)
      const word = (match?.[0] || '').toLowerCase()
      if (!word) return
      e.preventDefault()
      void openDictionary(word)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Open and fetch dictionary definitions
  const openDictionary = React.useCallback(async (word: string) => {
    setDictWord(word)
    setDictOpen(true)
    setDictLoading(true)
    setDictError(null)
    setDictEntries([])
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
      if (!res.ok) throw new Error('Lookup failed')
      const data = await res.json()
      const entries: Array<{ pos?: string; definition: string; example?: string }> = []
      if (Array.isArray(data)) {
        for (const entry of data) {
          const meanings = Array.isArray(entry?.meanings) ? entry.meanings : []
          for (const m of meanings) {
            const pos = typeof m?.partOfSpeech === 'string' ? m.partOfSpeech : undefined
            const defs = Array.isArray(m?.definitions) ? m.definitions : []
            for (const d of defs) {
              const def = typeof d?.definition === 'string' ? d.definition : ''
              if (!def) continue
              const ex = typeof d?.example === 'string' ? d.example : undefined
              entries.push({ pos, definition: def, example: ex })
            }
          }
        }
      }
      if (entries.length === 0) throw new Error('No definitions found')
      setDictEntries(entries.slice(0, 12))
    } catch (err: any) {
      setDictError(err?.message || 'Failed to fetch definition')
    } finally {
      setDictLoading(false)
    }
  }, [])

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
      ; (async () => {
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
        setIsStarred(false)
        return
      }
      setLoadingNote(true)
      setNoteError(null)
      if (!isOnline()) {
        const cached = await loadNoteContent(user.id, currentNoteId)
        if (!mounted) return
        if (cached) {
          setNoteTitle(cached.title || "Untitled")
          setNoteCategory("")
          setNoteUpdatedAt(cached.updated_at || "")
          setNoteContent(cached.content || "")
          setNoteProject("")
          setIsStarred(false)
          setLoadingNote(false)
          return
        }
      }
      const { data, error } = await supabase
        .from("notes")
        .select("title, content, category, updated_at, project, is_starred")
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
      setIsStarred(Boolean((data as any)?.is_starred))
      try { await saveNoteContent(user.id, { id: currentNoteId, title: (data?.title as string) || "", content: (data?.content as string) || "", updated_at: (data?.updated_at as string) || null }) } catch { }
      setLoadingNote(false)
    }
    run()
    return () => {
      mounted = false
    }
  }, [currentNoteId, supabase, user?.id])

  // Listen for global 'note-updated' events (broadcast by ActionSearchBar) and refresh if it concerns the current note
  useEffect(() => {
    const handler = async (ev: Event) => {
      const e = ev as CustomEvent<{ id?: string }>
      const id = (e?.detail && (e.detail as any).id) as string | undefined
      if (!id || id !== currentNoteId) return
      if (!user?.id) return
      const { data, error } = await supabase
        .from("notes")
        .select("title, content, category, updated_at, project, is_starred")
        .eq("id", id)
        .eq("user_id", user.id)
        .single()
      if (error) return
      setNoteTitle((data?.title as string) || "Untitled")
      setNoteCategory((data?.category as string) || "")
      setNoteUpdatedAt((data?.updated_at as string) || "")
      setNoteContent((data?.content as string) || "")
      setNoteProject((data?.project as string) || "")
      setIsStarred(Boolean((data as any)?.is_starred))
    }
    window.addEventListener('note-updated', handler as EventListener)
    return () => window.removeEventListener('note-updated', handler as EventListener)
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

  // Global Alt+V handler: verify current note
  useEffect(() => {
    const handler = async () => {
      try {
        const content = (noteContent || '').trim()
        if (!content) return
        setNoteVerifying(true)
        setNoteOwnedByYou(null)
        const fd = new FormData()
        fd.append('file', new File([content], `${(noteTitle || 'note').slice(0, 40)}.md`, { type: 'text/markdown' }))
        const vr = await fetch('/api/verify', { method: 'POST', body: fd })
        const j = await vr.json().catch(() => ({}))
        if (vr.status === 404 && j?.status === 'not_minted') {
          setNoteOwnedByYou(false)
        } else if (vr.ok) {
          const minter = (j?.tokenData?.user || j?.owner || '').toLowerCase()
          const owned = Boolean(walletAddress && minter && walletAddress.toLowerCase() === minter)
          setNoteOwnedByYou(owned)
        }
      } catch { }
      finally {
        setNoteVerifying(false)
      }
    }
    const onEvent = () => { void handler() }
    window.addEventListener('notes-verify-current', onEvent as EventListener)
    return () => window.removeEventListener('notes-verify-current', onEvent as EventListener)
  }, [noteContent, noteTitle, walletAddress])

  // Global Alt+M handler: mint current note with custodial wallet
  useEffect(() => {
    const handler = async () => {
      try {
        const content = (noteContent || '').trim()
        if (!content) return
        toast.message('Minting…')
        const fd = new FormData()
        fd.append('file', new File([content], `${(noteTitle || 'note').slice(0, 40)}.md`, { type: 'text/markdown' }))
        const address = walletAddress || ''
        if (address) fd.append('userAddress', address)
        if (noteAlreadyMinted) { toast.info('Already minted'); return }
        const res = await fetch('/api/mint', { method: 'POST', body: fd })
        const j = await res.json().catch(() => ({}))
        if (res.status === 409 || j?.status === 'already_minted') {
          setNoteAlreadyMinted(true)
          toast.info('Already minted')
          return
        }
        if (!res.ok) {
          toast.error((j && j.error) || 'Mint failed')
        } else {
          toast.success('Minted successfully')
        }
      } catch { }
    }
    const onEvent = () => { void handler() }
    window.addEventListener('notes-mint-current', onEvent as EventListener)
    return () => window.removeEventListener('notes-mint-current', onEvent as EventListener)
  }, [noteContent, noteTitle, walletAddress])

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
      setNoteContent((data?.content as string) ?? draftContent)
      setNoteUpdatedAt((data?.updated_at as string) || "")
      setIsEditing(false)
      try { await saveNoteContent(user.id, { id: currentNoteId, title: noteTitle || "", content: ((data?.content as string) ?? draftContent) || "", updated_at: (data?.updated_at as string) || null }) } catch { }
      try {
        const contentStr = (data?.content as string) ?? draftContent
        const fd = new FormData()
        fd.append('file', new File([contentStr], `${(noteTitle || 'note').slice(0, 40)}.md`, { type: 'text/markdown' }))
        const address = walletAddress || ''
        if (address) fd.append('userAddress', address)
        await fetch('/api/mint', { method: 'POST', body: fd }).then(r => r.json().catch(() => ({}))).catch(() => { })
      } catch { }
    }
    setSaving(false)
  }, [currentNoteId, draftContent, supabase, user?.id, saving, noteTitle, walletAddress])

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
      } catch { }
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
        } catch { }
      }, 0)
      return
    }
    // Fallback to original paste handler (handles image URL conversion)
    _prevOnEditorPaste(e)
  }, [draftContent])

  // Editor keydown: Ctrl+I wraps selected URL as image; Alt+C toggles style menu
  const onEditorKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + I: if selection is an image URL, wrap as markdown image
    const isCtrlI = (e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')
    if (isCtrlI) {
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
      const caret = before.length + insertion.length
      setTimeout(() => {
        try { el.focus(); el.setSelectionRange(caret, caret) } catch { }
      }, 0)
      return
    }

    // Ctrl/Cmd + D: wrap selection with == == for permanent highlight (no Shift)
    const isCtrlD = (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'd' || e.key === 'D')
    if (isCtrlD) {
      e.preventDefault()
      wrapSelection('==')
      return
    }

    // Ctrl/Cmd + S: save draft
    const isCtrlS = (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')
    if (isCtrlS) {
      e.preventDefault()
      void saveDraft()
      return
    }

    // Alt + C: toggle style menu
    if (e.altKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault()
      setStyleMenuOpen((v) => !v)
    }
  }, [draftContent])

  // Keyboard: Ctrl+E toggles edit; if already editing, save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Toggle edit mode or save
      if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault()
        if (!currentNoteId) return
        if (isEditing) void saveDraft()
        else setIsEditing(true)
        return
      }
      // Global Ctrl/Cmd+S to save while editing
      if (isEditing && (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        void saveDraft()
        return
      }
      // Quick open style menu with Alt+C when editing
      if (isEditing && e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        setStyleMenuOpen((v) => !v)
      }
      // Alt+T: generate test from current note, open right tab
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        void generateExam(true)
      }
      // Alt+G: toggle Fill-the-Gap mode on rendered note
      if (e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault()
        setFillGapsMode(v => !v)
      }
      // Ctrl+Q: toggle Q&A sidebar
      if ((e.ctrlKey || e.metaKey) && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault()
        const sel = window.getSelection()?.toString() || ''
        setQaOpen((v) => {
          const next = !v
          if (next) {
            const snippet = (sel || '').trim()
            if (snippet) setQaQuestion(snippet)
          }
          return next
        })
        // Close dictionary if Q&A opens to avoid overlap
        setDictOpen(false)
      }
      // Ctrl+Shift+D: cycle highlight color (green -> red -> blue)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        setHighlightColor((cur) => {
          const order: Array<'green' | 'red' | 'blue'> = ['green', 'red', 'blue']
          const idx = order.indexOf(cur || 'green')
          return order[(idx + 1) % order.length]
        })
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEditing, saveDraft, currentNoteId, generateExam])

  // Upload a 3D model to Supabase Storage and insert a Markdown directive at the caret
  const onPickModel = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploadModelError(null)
    setUploadingModel(true)
    try {
      // Restrict to common formats
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !['glb', 'gltf', 'stl'].includes(ext)) {
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
          try { el.focus(); el.setSelectionRange(caret, caret) } catch { }
        }, 0)
      } else {
        setDraftContent((prev) => prev + insertion)
      }
    } catch (err: any) {
      setUploadModelError(err?.message || 'Failed to upload model')
    } finally {
      setUploadingModel(false)
      // reset value so the same file can be picked again
      try { if (e.target) e.target.value = '' } catch { }
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
      // Mint created content (best-effort). Verify is on-demand.
      try {
        const createdContent = content ?? ''
        if (createdContent) {
          const fd = new FormData()
          fd.append('file', new File([createdContent], `${(title || 'note').slice(0, 40)}.md`, { type: 'text/markdown' }))
          const address = walletAddress || ''
          if (address) fd.append('userAddress', address)
          await fetch('/api/mint', { method: 'POST', body: fd }).then(r => r.json().catch(() => ({}))).catch(() => { })
        }
      } catch { }
    }
    setCreating(false)
  }

  // Inline skeleton used while a note is loading
  function InlineNoteSkeleton() {
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
      </article>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/40 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/notes">
                    {noteProject || "Notes"}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{noteTitle || "Untitled"}</BreadcrumbPage>
                </BreadcrumbItem>
                {currentNoteId && highlightColor !== 'green' && (
                  <BreadcrumbItem>
                    <span
                      className="ml-2 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium border"
                      title="Current highlight color"
                      style={{
                        backgroundColor: ({
                          green: 'rgba(34,197,94,0.12)',
                          red: 'rgba(244,63,94,0.12)',
                          blue: 'rgba(59,130,246,0.12)'
                        } as const)[highlightColor],
                        color: ({
                          green: 'rgb(5, 122, 85)',
                          red: 'rgb(190, 18, 60)',
                          blue: 'rgb(29, 78, 216)'
                        } as const)[highlightColor]
                      }}
                    >
                      HL: {highlightColor}
                    </span>
                  </BreadcrumbItem>
                )}
                {(noteVerifying || noteOwnedByYou !== null) && (
                  <BreadcrumbItem>
                    {noteVerifying ? (
                      <span className={"ml-2 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted/60 text-muted-foreground"}>
                        Verifying…
                      </span>
                    ) : (
                      <span className={`ml-2 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${noteOwnedByYou ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                        {noteOwnedByYou ? 'Owned' : 'Not owned'}
                      </span>
                    )}
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>

            {/* Editing: show save and char count in header */}
            {/* Editing: toolbar in header */}
            {isEditing && (
              <div className="flex items-center gap-1 pl-4 border-l border-border/40 ml-4 overflow-x-auto no-scrollbar scroll-smooth mask-linear-fade">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".glb,.gltf,.stl"
                  className="hidden"
                  onChange={onPickModel}
                />

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void formatWithAI()}
                  disabled={aiFormatting}
                  className="h-7 px-2 text-xs"
                >
                  {aiFormatting ? 'Doing AI…' : 'AI Format'}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingModel}
                  className="h-7 px-2 text-xs"
                >
                  {uploadingModel ? '…' : '3D'}
                </Button>

                <Button
                  size="sm"
                  variant={useWysiwyg ? "secondary" : "ghost"}
                  onClick={() => setUseWysiwyg(v => !v)}
                  className="h-7 px-2 text-xs"
                >
                  {useWysiwyg ? 'Rich' : 'Markdown'}
                </Button>

                {!useWysiwyg && (
                  <>
                    <div className="h-3 w-px bg-border/50 mx-1" />
                    {pastelColors.slice(0, 4).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => applyColorToSelection(c.id)}
                        title={c.label}
                        className="w-5 h-5 rounded-md text-[9px] font-medium hover:ring-1 ring-border/50 transition-shadow mx-0.5"
                        style={{
                          backgroundColor: pastelHex[c.id] || '#eee',
                          color: '#1f2937',
                        }}
                      >
                        {c.label.charAt(0)}
                      </button>
                    ))}
                    <div className="h-3 w-px bg-border/50 mx-1" />
                    <button type="button" className="w-5 h-5 rounded-md bg-muted hover:bg-muted/80 text-[10px] font-bold mx-0.5" onClick={() => wrapSelection('**')}>B</button>
                    <button type="button" className="w-5 h-5 rounded-md bg-muted hover:bg-muted/80 text-[10px] italic mx-0.5" onClick={() => wrapSelection('*')}>I</button>
                  </>
                )}

                <div className="h-4 w-px bg-border/40 mx-2" />

                <span className="text-xs text-muted-foreground hidden xl:inline w-20 text-right mr-2">{draftContent.length.toLocaleString()} chars</span>

                <Button size="sm" onClick={() => void saveDraft()} disabled={saving} className="h-8">
                  {saving ? 'Saving…' : 'Save'}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false)
                    setDraftContent(noteContent || "")
                    setSaveError(null)
                    setAiFormatError(null)
                    setUploadModelError(null)
                  }}
                  disabled={saving}
                  className="h-8 px-2 text-muted-foreground ml-1"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
          {/* Alt+V shortcut to verify current note */}
          <script dangerouslySetInnerHTML={{
            __html: `
            (function(){
              if (window.__alt_v_bound__) return; window.__alt_v_bound__ = true;
              window.addEventListener('keydown', function(e){
                try{
                  if (e.altKey && (e.key==='v' || e.key==='V')) {
                    e.preventDefault();
                    const ev = new CustomEvent('notes-verify-current');
                    window.dispatchEvent(ev);
                  }
                  if (e.altKey && (e.key==='m' || e.key==='M')) {
                    e.preventDefault();
                    const ev2 = new CustomEvent('notes-mint-current');
                    window.dispatchEvent(ev2);
                  }
                }catch(_){}
              });
            })();
          `}} />
        </header>
        <div className="flex flex-1 flex-col">
          <div className={`bg-background min-h-[calc(100vh-4rem)] p-8 md:p-12 transition-[padding-right] duration-200 ${(dictOpen || qaOpen) ? 'pr-[28rem]' : ''}`}>
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
            {currentNoteId && !examOpen && (
              <article className="mx-auto max-w-5xl px-4">
                <header className="mb-8">
                  <div className="mb-2 flex items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight flex-1">{noteTitle}</h1>
                    {currentNoteId && (
                      <button
                        type="button"
                        onClick={() => void toggleStar()}
                        disabled={starSaving}
                        title={isStarred ? 'Unstar' : 'Star'}
                        aria-label={isStarred ? 'Unstar note' : 'Star note'}
                        className={`inline-flex items-center justify-center h-8 w-8 rounded-md border transition-colors ${isStarred ? 'text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900' : 'text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900'}`}
                      >
                        <Star className="h-4 w-4" fill={isStarred ? 'currentColor' : 'none'} />
                      </button>
                    )}
                  </div>
                  {starError && (
                    <div className="-mt-1 mb-2 text-xs text-red-600">{starError}</div>
                  )}
                  {fillGapsMode && (
                    <div className="text-xs flex flex-col sm:flex-row sm:items-center gap-2 text-emerald-700 dark:text-emerald-300 mb-1">
                      <span className="rounded-md border border-emerald-300/60 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-900/20 px-2 py-0.5">Fill-the-Gap mode ON (Alt+G)</span>
                      <div className="inline-flex items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-400">
                        <span>Density</span>
                        <div className="inline-flex overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                          {([0.025, 0.05, 0.1, 0.25, 0.4] as number[]).map((v, idx, arr) => {
                            const active = Math.abs(fillGapsDensity - v) < 0.02
                            const base = "px-2 py-1 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600"
                            return (
                              <button
                                key={v}
                                type="button"
                                className={`${base} text-[11px] ${active ? 'bg-emerald-600 text-white dark:bg-emerald-500' : 'bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900'} ${idx < arr.length - 1 ? 'border-r border-neutral-200 dark:border-neutral-800' : ''}`}
                                onClick={() => setFillGapsDensity(v)}
                                title={`${Math.round(v * 100)}%`}
                                aria-pressed={active}
                              >
                                {Math.round(v * 100)}%
                              </button>
                            )
                          })}
                          {(() => {
                            const presets = [0.025, 0.05, 0.1, 0.25, 0.4]
                            const isPreset = presets.some(v => Math.abs(fillGapsDensity - v) < 0.02)
                            const otherActive = !isPreset
                            const base = "px-2 py-1 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600"
                            return (
                              <button
                                type="button"
                                className={`${base} text-[11px] ${otherActive ? 'bg-emerald-600 text-white dark:bg-emerald-500' : 'bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900'} border-l border-neutral-200 dark:border-neutral-800`}
                                onClick={() => {
                                  try {
                                    const current = Math.round(fillGapsDensity * 100)
                                    const input = window.prompt('Custom density (0–100%)', String(current))
                                    if (input == null) return
                                    const n = Number(input)
                                    if (!Number.isFinite(n)) return
                                    const clamped = Math.max(0, Math.min(100, n))
                                    setFillGapsDensity(clamped / 100)
                                  } catch { }
                                }}
                                title="Custom density"
                                aria-pressed={otherActive}
                              >
                                Other
                              </button>
                            )
                          })()}
                        </div>
                        <span className="tabular-nums w-10 text-right">{Math.round(fillGapsDensity * 100)}%</span>
                      </div>
                    </div>
                  )}
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
                  <InlineNoteSkeleton />
                ) : isEditing ? (
                  <div className="relative">
                    {/* Floating toolbar moved to header */}

                    {/* Error display */}
                    {(saveError || aiFormatError || uploadModelError || styleMenuError) && (
                      <div className="mb-4 text-sm text-red-600">{saveError ?? aiFormatError ?? uploadModelError ?? styleMenuError}</div>
                    )}

                    {/* Full-screen editor */}
                    {!useWysiwyg ? (
                      <div className="grid min-h-[calc(100vh-200px)]">
                        <div className="col-start-1 row-start-1 whitespace-pre-wrap font-mono text-sm invisible pointer-events-none" aria-hidden="true" style={{ lineHeight: '32px' }}>
                          {draftContent + '\u200b'}
                        </div>
                        <Textarea
                          ref={editorRef as any}
                          value={draftContent}
                          onChange={(e) => setDraftContent(e.target.value)}
                          onKeyDown={onEditorKeyDown}
                          onPaste={onEditorPasteExtended}
                          placeholder="Write your note in Markdown…"
                          autoFocus
                          className="col-start-1 row-start-1 w-full h-full resize-none bg-transparent font-mono text-sm border-none focus-visible:ring-0 px-0 py-0 overflow-hidden"
                          style={{
                            lineHeight: '32px',
                          }}
                        />
                      </div>
                    ) : (
                      <WysiwygEditor
                        value={draftContent}
                        onChange={setDraftContent}
                        placeholder="Write with formatting…"
                        className="min-h-[calc(100vh-200px)]"
                      />
                    )}
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
                      <MemoMarkdownContent content={noteContent} fillGaps={fillGapsMode} density={fillGapsDensity} seed={cacheKey} />
                    )}
                  </div>
                )}
              </article>
            )}
            {currentNoteId && examOpen && (
              <div className="flex flex-row gap-4">
                {/* Left: Note pane */}
                <div className={`w-1/2`}>
                  <article className="mx-auto max-w-3xl">
                    <header className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h1 className="text-2xl font-bold tracking-tight flex-1">{noteTitle}</h1>
                          {currentNoteId && (
                            <button
                              type="button"
                              onClick={() => void toggleStar()}
                              disabled={starSaving}
                              title={isStarred ? 'Unstar' : 'Star'}
                              aria-label={isStarred ? 'Unstar note' : 'Star note'}
                              className={`inline-flex items-center justify-center h-8 w-8 rounded-md border transition-colors ${isStarred ? 'text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900' : 'text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900'}`}
                            >
                              <Star className="h-4 w-4" fill={isStarred ? 'currentColor' : 'none'} />
                            </button>
                          )}
                        </div>
                        {(noteCategory || noteUpdatedAt) && (
                          <p className="text-xs text-muted-foreground">
                            {noteCategory && <span>Category: {noteCategory}</span>}
                            {noteCategory && noteUpdatedAt && <span> • </span>}
                            {noteUpdatedAt && (
                              <span>
                                Updated {new Date(noteUpdatedAt).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </header>
                    {loadingNote ? (
                      <InlineNoteSkeleton />
                    ) : (
                      <div className="group/reader">
                        <MarkdownContent content={noteContent} fillGaps={fillGapsMode} density={fillGapsDensity} seed={cacheKey} />
                      </div>
                    )}
                  </article>
                </div>

                {/* Vertical divider */}
                <div className="w-px self-stretch bg-neutral-200 dark:bg-neutral-800" />
                {/* Right: Exam tab */}
                <div className="w-1/2">
                  <div className="mx-auto max-w-3xl">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Exam</span>
                        <span className="text-xs text-neutral-500">(Alt+T to regenerate)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => void generateExam(true)} disabled={examLoading}>
                          {examLoading ? 'Generating…' : 'Regenerate'}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setExamOpen(false)}>
                          Close
                        </Button>
                      </div>
                    </div>
                    {examError && (
                      <div className="mb-3 text-sm text-red-600">{examError}</div>
                    )}
                    <div className="group/reader">
                      {examLoading ? (
                        <InlineNoteSkeleton />
                      ) : (
                        <MemoMarkdownContent key={examVersion} content={examMarkdown} fillGaps={false} seed={cacheKey} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Fixed Dictionary Side Panel */}
        {dictOpen && (
          <div className="fixed top-0 right-0 h-full z-40" style={{ width: dictWidth }}>
            {/* Subtle page backdrop for depth */}
            <div
              className={
                `absolute inset-0 pointer-events-none bg-gradient-to-l from-black/10 to-transparent dark:from-black/30 
               transition-opacity duration-200 ease-out ${dictAnimOpen ? 'opacity-100' : 'opacity-0'}`
              }
            />
            {/* Panel */}
            <div
              className={
                `absolute right-0 top-0 h-full flex flex-col p-4 md:p-5 
               backdrop-blur-md bg-white/70 dark:bg-neutral-900/70 
               border-l border-neutral-200/60 dark:border-neutral-800/60 
               shadow-xl ring-1 ring-black/5 dark:ring-white/5 rounded-l-2xl 
               transition-transform transition-opacity duration-200 ease-out 
               ${dictAnimOpen ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'}`
              }
              style={{ width: dictWidth }}
            >
              {/* Resize handle */}
              <div
                onMouseDown={onDictResizeMouseDown}
                title="Resize"
                className="absolute left-0 top-0 h-full w-1.5 -translate-x-full cursor-ew-resize 
                         bg-transparent hover:bg-neutral-500/10 active:bg-neutral-500/20"
              />
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Dictionary</div>
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" aria-hidden="true" />
                </div>
                <button
                  type="button"
                  onClick={() => setDictOpen(false)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md 
                           border border-neutral-200/70 dark:border-neutral-800/70 
                           hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60 
                           transition-colors"
                  aria-label="Close dictionary"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Word */}
              <div className="mb-3 md:mb-4">
                <div className="text-xl md:text-2xl font-semibold leading-tight tracking-tight">{dictWord || '—'}</div>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-auto pr-1 md:pr-2 space-y-3 md:space-y-3.5 ">
                {dictLoading && (
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Looking up…</div>
                )}
                {dictError && (
                  <div className="text-sm text-red-600/90 dark:text-red-400/90">{dictError}</div>
                )}
                {!dictLoading && !dictError && dictEntries.length > 0 && (
                  <ol className="list-decimal pl-5 space-y-2.5">
                    {dictEntries.map((d, idx) => (
                      <li key={idx} className="text-sm">
                        <div className="leading-6">
                          <span className="font-medium">{d.definition}</span>
                          {d.pos && <span className="ml-2 text-xs text-neutral-500 italic">{d.pos}</span>}
                        </div>
                        {d.example && (
                          <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">“{d.example}”</div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                {!dictLoading && !dictError && dictEntries.length === 0 && dictWord && (
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">No definitions found.</div>
                )}
                {!dictLoading && !dictError && !dictEntries.length && !dictWord && (
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">Select a word and press Alt+D.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fixed Q&A Side Panel */}
        {qaOpen && (
          <div className="fixed top-0 right-0 h-full z-40" style={{ width: qaWidth }}>
            <div
              className={
                `absolute inset-0 pointer-events-none bg-gradient-to-l from-black/10 to-transparent dark:from-black/30 
               transition-opacity duration-200 ease-out ${qaAnimOpen ? 'opacity-100' : 'opacity-0'}`
              }
            />
            <div
              className={
                `absolute right-0 top-0 h-full flex flex-col p-4 md:p-5 
               backdrop-blur-md bg-white/70 dark:bg-neutral-900/70 
               border-l border-neutral-200/60 dark:border-neutral-800/60 
               shadow-xl ring-1 ring-black/5 dark:ring-white/5 rounded-l-2xl 
               transition-transform transition-opacity duration-200 ease-out 
               ${qaAnimOpen ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'}`
              }
              style={{ width: qaWidth }}
            >
              <div
                onMouseDown={onQaResizeMouseDown}
                title="Resize"
                className="absolute left-0 top-0 h-full w-1.5 -translate-x-full cursor-ew-resize 
                         bg-transparent hover:bg-neutral-500/10 active:bg-neutral-500/20"
              />
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Ask Note</div>
                  <div className="h-1.5 w-1.5 rounded-full bg-sky-500/70" aria-hidden="true" />
                </div>
                <button
                  type="button"
                  onClick={() => setQaOpen(false)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md 
                           border border-neutral-200/70 dark:border-neutral-800/70 
                           hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60 
                           transition-colors"
                  aria-label="Close Q&A"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* History area */}
              <div className="flex-1 overflow-auto pr-1 md:pr-2 space-y-3">
                {qaHistory.length === 0 && (
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">Ask something about this note. We’ll answer concisely and jump to the relevant section.</div>
                )}
                {qaHistory.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="mt-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 text-[10px]">Q</div>
                      <div className="flex-1 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/60 px-3 py-2 text-sm shadow-sm">
                        {item.q}
                      </div>
                    </div>
                    {item.a ? (
                      <div className="ml-7 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/50 px-3 py-2 shadow-sm">
                        <div className="prose prose-neutral dark:prose-invert max-w-none text-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks, remarkDirective]} rehypePlugins={[rehypeKatex]}>
                            {item.a}
                          </ReactMarkdown>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {item.snippet && (
                            <Button size="sm" variant="outline" onClick={() => { try { window.dispatchEvent(new CustomEvent('qa-scroll-to', { detail: { snippet: item.snippet } })) } catch { } }}>Jump to context</Button>
                          )}
                          <span className="text-[10px] text-neutral-500">{new Date(item.ts).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="ml-7 text-sm text-neutral-500 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Answering…</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Input at bottom */}
              <div className="pt-3 mt-2 border-t border-neutral-200/70 dark:border-neutral-800/70">
                <div className="flex items-end gap-2">
                  <textarea
                    value={qaQuestion}
                    onChange={(e) => setQaQuestion(e.target.value)}
                    placeholder="Ask a question about this note… (Ctrl+Q to toggle)"
                    className="flex-1 max-h-40 min-h-[56px] rounded-md border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700 resize-y"
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      const question = qaQuestion.trim()
                      if (!question) return
                      setQaQuestion('')
                      setQaError(null)
                      // Append pending item to history
                      const pending: QaItem = { id: Math.random().toString(36).slice(2), q: question, ts: Date.now() }
                      setQaHistory(prev => [...prev, pending])
                      setQaLoading(true)
                      try {
                        const system = "You are a helpful study assistant. Given a note and a user question, answer concisely and return JSON with an 'answer' (Markdown) and 'snippet' (exact quote from the note to scroll to)."
                        const prompt = `NOTE TITLE: ${noteTitle || 'Untitled'}\n\nNOTE CONTENT:\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n${noteContent}\n\n---\nQUESTION: ${question}\n\nRespond ONLY in JSON with keys: answer (string, markdown allowed), snippet (string, exact text copied from the note that best anchors the answer).`
                        const raw = await makeGroqRequest(prompt, true, system)
                        let parsed: any = null
                        try { parsed = JSON.parse(raw) } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]) } catch { } } }
                        const answer = (parsed && typeof parsed.answer === 'string') ? parsed.answer : String(raw || '').trim()
                        const snippet = (parsed && typeof parsed.snippet === 'string') ? parsed.snippet : ''
                        setQaAnswerMd(answer)
                        setQaSnippet(snippet)
                        setQaHistory(prev => prev.map(it => it.id === pending.id ? { ...it, a: answer, snippet } : it))
                        if (snippet) { try { window.dispatchEvent(new CustomEvent('qa-scroll-to', { detail: { snippet } })) } catch { } }
                      } catch (err: any) {
                        setQaError(err?.message || 'Failed to get answer')
                        // Mark as error in history
                        setQaHistory(prev => prev.map(it => it.id === pending.id ? { ...it, a: `Sorry, an error occurred: ${err?.message || 'Unknown error'}` } : it))
                      } finally {
                        setQaLoading(false)
                      }
                    }}
                    disabled={qaLoading}
                  >
                    {qaLoading ? 'Sending…' : 'Ask'}
                  </Button>
                </div>
                {qaError && <div className="mt-2 text-xs text-red-600">{qaError}</div>}
              </div>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

// Prevent re-render of MarkdownContent unless its meaningful props change
const MemoMarkdownContent = React.memo(
  MarkdownContent,
  (prev, next) => (
    prev.content === next.content &&
    prev.fillGaps === next.fillGaps &&
    prev.density === next.density &&
    prev.seed === next.seed
  )
)

function MarkdownContent({ content, fillGaps, density, seed }: { content: string; fillGaps?: boolean; density?: number; seed?: string }) {
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

  // DOM-only highlighter (temporary, not persisted)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const currentHLRef = React.useRef<'green' | 'red' | 'blue'>('green')

  // Listen for color changes from Page without causing re-renders
  React.useEffect(() => {
    const onSet = (ev: Event) => {
      try {
        const e = ev as CustomEvent<{ color?: 'green' | 'red' | 'blue' }>
        const c = e?.detail?.color
        if (c === 'green' || c === 'red' || c === 'blue') currentHLRef.current = c
      } catch { }
    }
    window.addEventListener('notes-set-highlight-color', onSet as EventListener)
    return () => window.removeEventListener('notes-set-highlight-color', onSet as EventListener)
  }, [])

  // Q&A: scroll and highlight a snippet within the rendered markdown
  React.useEffect(() => {
    const root = containerRef.current
    if (!root) return

    // Utility: escape regex special chars
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Helper to find first text node occurrence of "needle" within root
    const findTextOccurrence = (needle: string): { node: Text; start: number; end: number } | null => {
      if (!needle) return null
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
      let n: Node | null
      const lowerNeedle = needle.toLowerCase()
      while ((n = walker.nextNode())) {
        const t = (n as Text).data || ''
        const idx = t.toLowerCase().indexOf(lowerNeedle)
        if (idx !== -1) return { node: n as Text, start: idx, end: idx + needle.length }
      }
      return null
    }

    // Create a transient highlight span for a given range
    const colorToStyle = (color: 'green' | 'red' | 'blue') => {
      if (color === 'red') return { bg: 'rgba(244,63,94,0.35)', cls: 'dom-red-highlight' } // rose-500 @35%
      if (color === 'blue') return { bg: 'rgba(59,130,246,0.35)', cls: 'dom-blue-highlight' } // sky-500 @35%
      return { bg: 'rgba(34,197,94,0.35)', cls: 'dom-green-highlight' } // emerald-500 @35%
    }

    const highlightRange = (range: Range, color: 'green' | 'red' | 'blue') => {
      try {
        const span = document.createElement('span')
        span.className = 'qa-highlight'
        span.style.backgroundColor = colorToStyle(color).bg
        span.style.borderRadius = '4px'
        range.surroundContents(span)
        // Scroll into view
        span.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Remove after delay, unwrap to preserve layout
        window.setTimeout(() => {
          try {
            const parent = span.parentNode
            if (!parent) return
            const frag = document.createDocumentFragment()
            while (span.firstChild) frag.appendChild(span.firstChild)
            parent.replaceChild(frag, span)
          } catch { }
        }, 1800)
      } catch {
        // In case of invalid range (spans multiple nodes), fallback: just scroll the startContainer into view
        try { (range.startContainer as Element)?.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch { }
      }
    }

    const onScrollTo = (ev: Event) => {
      const e = ev as CustomEvent<{ snippet?: string }>
      const snippet = (e?.detail?.snippet || '').trim()
      if (!snippet) return

      // 1) Try exact match
      let found = findTextOccurrence(snippet)
      // 2) If not found, try a relaxed match: longest 64-char window from snippet that exists
      if (!found && snippet.length > 24) {
        const segLen = Math.min(64, snippet.length)
        for (let len = segLen; len >= 24 && !found; len -= 8) {
          for (let i = 0; i + len <= snippet.length; i += 8) {
            const seg = snippet.slice(i, i + len)
            const f = findTextOccurrence(seg)
            if (f) { found = f; break }
          }
        }
      }
      // 3) As a last resort, try matching any line from the snippet
      if (!found) {
        const lines = snippet.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
        for (const line of lines) {
          const f = findTextOccurrence(line)
          if (f) { found = f; break }
        }
      }
      if (!found) return

      const range = document.createRange()
      range.setStart(found.node, Math.max(0, found.start))
      range.setEnd(found.node, Math.min(found.node.data.length, found.end))
      highlightRange(range, 'blue')
    }

    window.addEventListener('qa-scroll-to', onScrollTo as EventListener)
    return () => window.removeEventListener('qa-scroll-to', onScrollTo as EventListener)
  }, [])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrlD = (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'd' || e.key === 'D')
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
          if (el.classList && (el.classList.contains('dom-green-highlight') || el.classList.contains('dom-red-highlight') || el.classList.contains('dom-blue-highlight'))) return el
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

      // Otherwise, apply highlight normally using current color
      try {
        const fragment = range.extractContents()
        const span = document.createElement('span')
        const color = currentHLRef.current
        span.className = color === 'red' ? 'dom-red-highlight' : color === 'blue' ? 'dom-blue-highlight' : 'dom-green-highlight'
        span.style.backgroundColor = color === 'red' ? 'rgba(244,63,94,0.35)' : color === 'blue' ? 'rgba(59,130,246,0.35)' : 'rgba(34,197,94,0.35)'
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
    const onCustom = (ev: Event) => {
      const e = ev as CustomEvent<{ color?: 'green' | 'red' | 'blue' }>
      const color = e?.detail?.color || currentHLRef.current
      const root = containerRef.current
      if (!root) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return

      const range = sel.getRangeAt(0)
      const containerNode = range.commonAncestorContainer
      if (!root.contains(containerNode)) return
      // Apply highlight with provided color
      try {
        const fragment = range.extractContents()
        const span = document.createElement('span')
        span.className = color === 'red' ? 'dom-red-highlight' : color === 'blue' ? 'dom-blue-highlight' : 'dom-green-highlight'
        span.style.backgroundColor = color === 'red' ? 'rgba(244,63,94,0.35)' : color === 'blue' ? 'rgba(59,130,246,0.35)' : 'rgba(34,197,94,0.35)'
        span.style.borderRadius = '4px'
        span.appendChild(fragment)
        range.insertNode(span)
        sel.removeAllRanges()
        const after = document.createRange()
        after.setStartAfter(span)
        after.collapse(true)
        sel.addRange(after)
      } catch { }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('notes-highlight-selection', onCustom as EventListener)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('notes-highlight-selection', onCustom as EventListener)
    }
  }, [])

  // No-op: color cycling is handled at Page; this component only listens via events to avoid re-renders

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
      if (!ref.current) return
      void renderMermaidInto(ref.current, code)
    }, [code, renderMermaidInto])
    return <div ref={ref} className="my-4" />
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

  // Normalize stray single-line container written directives to leaf form
  function normalizeWrittenDirectives(src: string): string {
    if (!src) return src
    let out = src
    // Convert lines that start with :::written{...} (no closing :::) to :written{...}
    out = out.replace(/^:::written\s*\{([^}]*)\}\s*$/gm, (_m, attrs) => `:written{${attrs}}`)
    // Ensure leaf directives are properly formatted with newlines for better parsing
    out = out.replace(/(:written\{[^}]*\})/g, '\n$1\n')
    return out.trim()
  }

  const safeContent = React.useMemo(
    () => {
      // Handle the case where written directives might not be parsed correctly
      let processed = content || ''

      // Check if the content contains written directives that aren't being processed
      if (processed.includes(':written{') && !processed.includes('<written')) {
        // If we have leaf directives but they're not being processed, try to normalize them
        processed = normalizeWrittenDirectives(processed)
      }

      return processed
    },
    [content]
  )

  // Seeded PRNG (xorshift32)
  const makeRng = React.useCallback((seedStr: string | undefined) => {
    let h = 2166136261 >>> 0
    const s = String(seedStr || '')
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    if (h === 0) h = 0x9e3779b9
    let x = h >>> 0
    return () => {
      // xorshift32
      x ^= x << 13; x >>>= 0
      x ^= x >> 17; x >>>= 0
      x ^= x << 5; x >>>= 0
      return (x >>> 0) / 4294967296
    }
  }, [])

  // Remark plugin: randomly replace words with <gap answer="word" /> nodes
  const randomGapperPlugin = React.useCallback(function () {
    // 35% replacement by default, skip very short words
    const rng = makeRng(seed || (typeof safeContent === 'string' ? safeContent.slice(0, 2048) : ''))
    const p = Math.max(0, Math.min(1, typeof density === 'number' ? density : 0.35))
    const shouldGap = () => rng() < p
    const WORD_RE = /([A-Za-z][A-Za-z'\-]*)/g
    return (tree: any) => {
      visitWithParent(tree, (node, parent, index) => {
        if (!parent || typeof node?.type !== 'string') return
        // Skip headings, code blocks, inline code, links, images, tables
        const skipTypes = new Set(['code', 'inlineCode', 'link', 'image', 'table', 'thematicBreak'])
        // We'll still strip == == inside headings, but never create gaps there
        if (skipTypes.has(node.type) || skipTypes.has(parent.type)) return
        if (node.type !== 'text' || typeof node.value !== 'string') return
        const text: string = node.value
        if (!text.trim()) return
        // Split into highlight and normal segments by ==...== boundaries (non-nested heuristic)
        const segments = text.split(/(==[^=]+==)/g)
        const outParts: any[] = []
        for (const seg of segments) {
          if (!seg) continue
          const isHL = /^==[^=]+==$/.test(seg)
          const inner = isHL ? seg.slice(2, -2) : seg
          // Tokenize words within this segment
          let last = 0
          let m: RegExpExecArray | null
          WORD_RE.lastIndex = 0
          while ((m = WORD_RE.exec(inner)) !== null) {
            const start = m.index
            const end = WORD_RE.lastIndex
            if (start > last) outParts.push({ type: 'text', value: inner.slice(last, start) })
            const w = m[1]
            const clean = w.replace(/^["'\-]+|["'\-]+$/g, '')
            const eligible = clean.length >= 4 && /[A-Za-z]/.test(clean)
            if (eligible) {
              // Bias selection toward highlighted segments
              const prob = isHL ? Math.min(0.95, p * 2) : p
              const pick = rng() < prob
              if (pick && parent.type !== 'heading') {
                outParts.push({ type: 'gap', data: { hName: 'gap', hProperties: { answer: w } } })
              } else {
                outParts.push({ type: 'text', value: w })
              }
            } else {
              outParts.push({ type: 'text', value: w })
            }
            last = end
          }
          if (last < inner.length) outParts.push({ type: 'text', value: inner.slice(last) })
          // Note: we intentionally do NOT re-add == wrappers to strip highlight formatting in this mode
        }
        if (outParts.length > 0) parent.children.splice(index, 1, ...outParts)
      })
    }
  }, [makeRng, seed, safeContent, density])

  // Rehype plugin: convert ==text== in plain text nodes to <mark>text</mark>
  const rehypeHighlightEquals = React.useCallback(function () {
    const wrapTextWithMarks = (node: any, parent: any, index: number) => {
      const value: string = node.value || ''
      const parts: any[] = []
      let last = 0
      const re = /==([^=]+)==/g
      let m: RegExpExecArray | null
      while ((m = re.exec(value)) !== null) {
        const start = m.index
        const end = re.lastIndex
        if (start > last) parts.push({ type: 'text', value: value.slice(last, start) })
        parts.push({ type: 'element', tagName: 'mark', properties: {}, children: [{ type: 'text', value: m[1] }] })
        last = end
      }
      if (last < value.length) parts.push({ type: 'text', value: value.slice(last) })
      if (parts.length > 0) {
        parent.children.splice(index, 1, ...parts)
      }
    }

    const walk = (node: any, parent: any) => {
      if (!node || typeof node !== 'object') return
      const type = node.type
      if (type === 'text' && parent && Array.isArray(parent.children)) {
        wrapTextWithMarks(node, parent, parent.children.indexOf(node))
        return
      }
      const children = Array.isArray((node as any).children) ? (node as any).children : []
      for (const child of [...children]) walk(child, node)
    }

    return (tree: any) => walk(tree, null)
  }, [])

  // Custom remark plugin to handle directives like :::center and info boxes :::info/:::warning/etc
  const directivePlugin = React.useCallback(function () {
    return (tree: any) => {
      visit(tree, (node: any) => {
        if (node && (node.type === 'containerDirective' || node.type === 'leafDirective' || node.type === 'textDirective')) {
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

            ; (data as any).hProperties = {
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

            ; (data as any).hProperties = {
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

          // Written question directive: pass raw attributes string to the component
          if (name === 'written') {
            data.hName = 'written'
            // remark-directive puts the content between { and } in the first child text node
            if (Array.isArray((node as any).children) && (node as any).children.length > 0) {
              const first = (node as any).children[0]
              const rawAttrs = typeof first?.value === 'string' ? first.value : ''
              if (rawAttrs) {
                hast.attrs = rawAttrs
              }
            }
            // Clear children to prevent rendering the raw attribute string
            if (Array.isArray((node as any).children)) {
              ; (node as any).children = []
            }
            return
          }
        }
      })
    }
  }, [])

  // Gap syntax plugin: transform (gap:answer) into <gap answer="..." /> hast nodes
  // Tolerant parsing: optional colon and any whitespace/newlines between tokens, e.g., (gap\nanswer)
  const gapPlugin = React.useCallback(function () {
    // Allow optional colon and whitespace/newlines between (gap and answer) up to the next ')'
    // Examples matched: (gap:Paris), (gap: Paris), (gap\nParis), (gap   Paris)
    const GAP_RE = /\(gap\s*:?[\s]*([^)]*?)\)/g
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

  // Plugin to handle written directives that might not be processed by remark-directive
  const writtenDirectiveFallbackPlugin = React.useCallback(function () {
    const WRITTEN_RE = /:written\{([^}]*)\}/g
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

        // Check if this is a paragraph containing a written directive
        if (node.type === 'paragraph' && Array.isArray(node.children)) {
          const text = toPlain(node)
          if (WRITTEN_RE.test(text)) {
            WRITTEN_RE.lastIndex = 0

            const parts: any[] = []
            let lastIndex = 0
            let m: RegExpExecArray | null
            while ((m = WRITTEN_RE.exec(text)) !== null) {
              const start = m.index
              const end = WRITTEN_RE.lastIndex
              const before = text.slice(lastIndex, start)
              if (before) parts.push({ type: 'text', value: before })

              // Parse attributes from the directive
              const attrsText = m[1]
              const attrs: Record<string, string> = {}
              // More robust parsing for complex attribute values
              try {
                // Find question attribute
                const questionStart = attrsText.indexOf('question="')
                if (questionStart !== -1) {
                  const questionEnd = attrsText.indexOf('"', questionStart + 10) // Start after 'question="'
                  if (questionEnd !== -1) {
                    attrs.question = attrsText.slice(questionStart + 10, questionEnd)
                  }
                }

                // Find expected attribute
                const expectedStart = attrsText.indexOf('expected="')
                if (expectedStart !== -1) {
                  const expectedEnd = attrsText.indexOf('"', expectedStart + 10) // Start after 'expected="'
                  if (expectedEnd !== -1) {
                    attrs.expected = attrsText.slice(expectedStart + 10, expectedEnd)
                  }
                }

                console.log('Fallback plugin parsing:', { attrsText, attrs })
              } catch (error) {
                console.error('Error parsing written directive attributes in fallback:', error)
              }

              parts.push({
                type: 'written',
                data: {
                  hName: 'written',
                  hProperties: attrs
                }
              })
              lastIndex = end
            }
            const after = text.slice(lastIndex)
            if (after) parts.push({ type: 'text', value: after })

            // Replace the node's children with the processed parts
            if (parts.length > 0) {
              node.children = parts
            }
          }
        }
      })
    }
  }, [])

  return (
    <div ref={containerRef} className="prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          remarkBreaks,
          remarkMath,
          remarkDirective,
          youtubeAutolinkPlugin,
          writtenDirectiveFallbackPlugin,
          // When fillGaps is enabled, run the random gapper before directive and gap parsing
          ...(fillGaps ? [randomGapperPlugin] as any[] : []),
          directivePlugin,
          gapPlugin,
        ]}
        rehypePlugins={[rehypeKatex, rehypeHighlightEquals]}
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
              try { if (pressTimer.current) window.clearTimeout(pressTimer.current) } catch { }
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
            else if (typeof pairsJson === 'string') { try { const p = JSON.parse(pairsJson); if (Array.isArray(p)) initialPairs = p as Pair[] } catch { } }

            const title: string = (props as any)?.title || ''
            const shuffleProp = String((props as any)?.shuffle ?? '').toLowerCase()
            const shouldShuffle = shuffleProp === 'true'

            const [left] = React.useState<string[]>(() => initialPairs.map(p => p.left))
            const [right, setRight] = React.useState<string[]>(() => {
              const arr = initialPairs.map(p => p.right)
              if (shouldShuffle) {
                for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]] }
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
              if (wrongTimer.current) { try { window.clearTimeout(wrongTimer.current) } catch { }; wrongTimer.current = null }
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
              } catch { }
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
                    const styles: Record<string, string> = {
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
          // Written question renderer with AI grading
          written: (props: any) => {
            const rawAttrs: string = (props as any)?.attrs || ''
            let q = ''
            let expected = ''

            // Parse attributes from the raw string passed by the plugin
            if (rawAttrs) {
              try {
                const questionMatch = rawAttrs.match(/question="([\s\S]*?)"(?=\s+expected=|$)/)
                const expectedMatch = rawAttrs.match(/expected="([\s\S]*?)"/)
                if (questionMatch) q = questionMatch[1]
                if (expectedMatch) expected = expectedMatch[1]
              } catch (e) {
                console.error('Error parsing written attributes in component:', e)
              }
            }

            console.log('Written component parsed:', { rawAttrs, q, expected })

            const [answer, setAnswer] = React.useState('')
            const [grading, setGrading] = React.useState(false)
            const [result, setResult] = React.useState<null | { score: number; feedback: string; isCorrect: boolean; explanation?: string }>(null)
            const [error, setError] = React.useState<string | null>(null)
            const [showExpected, setShowExpected] = React.useState(false)
            const textRef = React.useRef<HTMLTextAreaElement | null>(null)

            const wordCount = React.useMemo(() => {
              const s = answer.trim()
              if (!s) return 0
              return s.split(/\s+/).filter(Boolean).length
            }, [answer])

            const onGrade = async () => {
              if (!q) return
              setGrading(true)
              setError(null)
              try {
                const r = await gradeAnswerWithGroq('written', q, expected || '(no model answer provided)', answer, { adaptiveScoring: true })
                setResult({ score: r.score, feedback: r.feedback, isCorrect: r.isCorrect, explanation: r.explanation })
              } catch (e: any) {
                setError(e?.message || 'Failed to grade answer')
              } finally {
                setGrading(false)
              }
            }

            const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              // Ctrl/Cmd+Enter to grade
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                if (answer.trim()) void onGrade()
              }
            }

            return (
              <div className="my-4 rounded-xl border bg-white/60 dark:bg-neutral-950/40 backdrop-blur p-4 shadow-sm">
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 inline-flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 bg-white/70 dark:bg-neutral-900/40">
                        Written question
                      </span>
                    </div>
                    {q && (
                      <h3 className="m-0 text-[17px] leading-snug font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 break-words">
                        {q}
                      </h3>
                    )}
                  </div>
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExpected(v => !v)}
                    className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    {showExpected ? 'Hide model answer' : 'Show model answer'}
                  </button>
                </div>
                {showExpected && expected && (
                  <div className="mb-3 text-xs text-neutral-700 dark:text-neutral-300 border rounded-md p-2 bg-white/70 dark:bg-neutral-900/40">
                    {expected}
                  </div>
                )}
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Write your answer..."
                  onKeyDown={onKeyDown}
                  ref={textRef}
                  className="w-full min-h-[120px] rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-700"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={onGrade} disabled={grading || !answer.trim()} className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900">
                    {grading ? 'Grading…' : 'Grade'}
                  </button>
                  <span className="text-xs text-neutral-500">{wordCount} words</span>
                  {result && (
                    <span className={`text-sm ${result.isCorrect ? 'text-emerald-600' : 'text-amber-600'}`}>Score: {result.score}</span>
                  )}
                </div>
                {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
                {result && (
                  <div className="mt-2 text-sm">
                    <div className="font-medium mb-1">Feedback</div>
                    <div className="whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">{result.feedback}</div>
                    {result.explanation && (
                      <div className="mt-2 text-neutral-600 dark:text-neutral-400">{result.explanation}</div>
                    )}
                  </div>
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
              } catch { }
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
            } catch { }
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
              try { if (pressTimer.current) window.clearTimeout(pressTimer.current) } catch { }
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
                      // Shortcut: typing '???' reveals the answer immediately
                      if (v.trim() === '???') {
                        setValue(answer)
                        setRevealed(true)
                        setJustFilled(true)
                        window.setTimeout(() => setJustFilled(false), 220)
                        return
                      }
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
      <style jsx global>{`
        /* Match DOM green highlight for persisted ==text== */
        .prose mark { background-color: rgba(34,197,94,0.35); border-radius: 4px; padding: 0 0.1em; }
      `}</style>
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
