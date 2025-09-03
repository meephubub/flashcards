"use client"

import { useState, useEffect, isValidElement, cloneElement } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Send, BarChart2, Globe, Video, PlaneTakeoff, AudioLines, PlusCircle, Trash2, Copy, Check, HelpCircle, X, Image as ImageIcon, Download, Pencil, GitMerge, ListTodo } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import useDebounce from "@/hooks/use-debounce"
import { useNoteDialogStore } from "@/hooks/use-note-dialog"
import { useNoteContextStore } from "@/hooks/use-note-context"
import { useEnvironmentStore } from "@/hooks/use-environment"
import { makeGroqRequest } from "@/lib/groq"
import { generateImage as generateSlowImageApi, type ImageModel } from "@/lib/generate-image"
import { Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import NoteFromContentDialog from "@/components/note-from-content-dialog"
import MoveNoteProjectDialog from "@/components/move-note-project-dialog"
import { supabase } from "@/lib/supabase"
import { Progress } from "@/components/ui/progress"

interface Action {
  id: string
  label: string
  icon?: React.ReactNode
  description?: string
  short?: string
  end?: string
  href?: string
  run?: () => void
  // If true, keep the palette open after run(). We'll manage closing manually.
  keepOpen?: boolean
  // Category for grouping/filtering in the left rail
  category?:
    | "basic"
    | "ai"
    | "notes"
    | "decks"
    | "models"
    | "nav"
    | "device"
    | "todos"
  // Higher appears earlier when searching (in addition to matching score)
  priority?: number
}

interface SearchResult {
  actions: Action[]
}

// Simple and safe arithmetic evaluator supporting +, -, *, /, ^, parentheses, and decimals
function evalArithmetic(expr: string): number | null {
  try {
    const tokens: (number | string)[] = []
    // Tokenize
    const s = expr.replace(/\s+/g, "")
    let i = 0
    while (i < s.length) {
      const ch = s[i]
      if (/[0-9.]/.test(ch)) {
        let j = i + 1
        while (j < s.length && /[0-9.]/.test(s[j])) j++
        const num = parseFloat(s.slice(i, j))
        if (Number.isNaN(num)) return null
        tokens.push(num)
        i = j
        continue
      }
      if (/[+\-*/^()]/.test(ch)) {
        // handle unary minus: if '-' and (start or previous is operator or '('), treat as 0 - x
        if (
          ch === '-' &&
          (tokens.length === 0 || typeof tokens[tokens.length - 1] === 'string' && (tokens[tokens.length - 1] as string).match(/[+\-*/^(]/))
        ) {
          // push 0 and '-' as binary
          tokens.push(0)
          tokens.push('-')
          i++
          continue
        }
        tokens.push(ch)
        i++
        continue
      }
      return null
    }

    // Shunting-yard to RPN
    const out: (number | string)[] = []
    const ops: string[] = []
    const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 }
    const rightAssoc: Record<string, boolean> = { '^': true }

    for (const t of tokens) {
      if (typeof t === 'number') out.push(t)
      else if (t === '(') ops.push(t)
      else if (t === ')') {
        while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop() as string)
        if (!ops.length) return null
        ops.pop() // remove '('
      } else {
        while (
          ops.length &&
          ops[ops.length - 1] !== '(' &&
          (prec[ops[ops.length - 1]] > prec[t] || (prec[ops[ops.length - 1]] === prec[t] && !rightAssoc[t]))
        ) {
          out.push(ops.pop() as string)
        }
        ops.push(t)
      }
    }
    while (ops.length) {
      const op = ops.pop() as string
      if (op === '(' || op === ')') return null
      out.push(op)
    }

    // Evaluate RPN
    const st: number[] = []
    for (const t of out) {
      if (typeof t === 'number') st.push(t)
      else {
        const b = st.pop(); const a = st.pop()
        if (a === undefined || b === undefined) return null
        switch (t) {
          case '+': st.push(a + b); break
          case '-': st.push(a - b); break
          case '*': st.push(a * b); break
          case '/': st.push(b === 0 ? NaN : a / b); break
          case '^': st.push(Math.pow(a, b)); break
          default: return null
        }
      }
    }
    if (st.length !== 1) return null
    const val = st[0]
    return Number.isFinite(val) ? val : null
  } catch {
    return null
  }
}

const allActions: Action[] = [
  // Navigation
  {
    id: "go-home",
    label: "Go to Home",
    description: "/",
    icon: <Globe className="h-4 w-4 text-blue-500"/> ,
    short: "Enter",
    end: "⌘K",
    href: "/",
    category: "nav",
    priority: 90,
  },
  {
    id: "go-notes",
    label: "Go to Notes",
    description: "/notes",
    icon: <BarChart2 className="h-4 w-4 text-orange-500"/>,
    short: "Enter",
    end: "⌘K",
    href: "/notes",
    category: "nav",
    priority: 90,
  },
  {
    id: "go-signin",
    label: "Go to Sign In",
    description: "/sign-in",
    icon: <PlaneTakeoff className="h-4 w-4 text-red-500" />,
    short: "Enter",
    end: "⌘K",
    href: "/sign-in",
    category: "nav",
    priority: 10,
  },
  // Deck actions
  {
    id: "create-deck",
    label: "Create deck",
    description: "Open create deck dialog",
    icon: <PlusCircle className="h-4 w-4 text-emerald-600" />,
    short: "Enter",
    end: "Decks",
    run: () => {
      try { window.dispatchEvent(new Event('open-create-deck')) } catch {}
    },
    category: "decks",
    priority: 80,
  },
  {
    id: "import-markdown",
    label: "Import markdown",
    description: "Import cards from Markdown",
    icon: <Download className="h-4 w-4 text-blue-600" />,
    short: "Enter",
    end: "Decks",
    run: () => {
      try { window.dispatchEvent(new Event('open-import-markdown')) } catch {}
    },
    category: "decks",
    priority: 70,
  },
  {
    id: "generate-flashcards",
    label: "Generate flashcards (AI)",
    description: "Create flashcards with AI",
    icon: <Search className="h-4 w-4 text-purple-600" />,
    short: "Enter",
    end: "AI",
    run: () => {
      try { window.dispatchEvent(new Event('open-generate-flashcards')) } catch {}
    },
    category: "ai",
    priority: 85,
  },
  {
    id: "merge-decks",
    label: "Merge decks",
    description: "Combine two decks",
    icon: <GitMerge className="h-4 w-4 text-pink-600" />,
    short: "Enter",
    end: "Decks",
    run: () => {
      try { window.dispatchEvent(new Event('open-merge-decks')) } catch {}
    },
    category: "decks",
    priority: 60,
  },
  {
    id: "create-model",
    label: "Create model",
    description: "Open create model dialog",
    icon: <PlusCircle className="h-4 w-4 text-emerald-600" />,
    short: "Enter",
    end: "Models",
    run: () => {
      try { window.dispatchEvent(new Event('open-create-model')) } catch {}
    },
    category: "models",
    priority: 70,
  },
  {
    id: "question",
    label: "Question",
    icon: <HelpCircle className="h-4 w-4 text-blue-500" />,
    description: "gpt-4o",
    short: "⌘cmd+p",
    end: "Command",
    run: () => {
      // Filled at runtime by ActionSearchBar via effectiveActions mapping if needed
    },
    category: "ai",
    priority: 95,
  },
  {
    id: "fan-on",
    label: "Fan On",
    icon: <AudioLines className="h-4 w-4 text-green-500" />,
    description: "Trigger Voicemonkey",
    short: "",
    end: "Device",
    run: () => {
      // Fire-and-forget; modal will close after run
      void fetch(
        "https://api-v2.voicemonkey.io/trigger?token=814e797e65ae46a6828e1001150bd8ac_0a30f8185cdd6014f8a9b1d0ef1b326a&device=fan-on"
      )
    },
    category: "device",
    priority: 20,
  },
  {
    id: "fan-off",
    label: "Fan Off",
    icon: <AudioLines className="h-4 w-4 text-red-500" />,
    description: "Trigger Voicemonkey",
    short: "",
    end: "Device",
    run: () => {
      // Fire-and-forget; modal will close after run
      void fetch(
        "https://api-v2.voicemonkey.io/trigger?token=814e797e65ae46a6828e1001150bd8ac_0a30f8185cdd6014f8a9b1d0ef1b326a&device=fan-off"
      )
    },
    category: "device",
    priority: 20,
  },
  {
    id: "create-note-from-image",
    label: "Create note from image",
    description: "Upload image → process → create note",
    icon: <ImageIcon className="h-4 w-4 text-purple-500" />,
    short: "Enter",
    end: "Image → Note",
    run: () => {
      // Open a file picker for a single image, then call our API and create a note
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.multiple = false
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        try {
          // 1) Upload to API which stores to Supabase Storage (service role) and returns Markdown
          const fd = new FormData()
          fd.append('file', file)
          const res = await fetch('/api/note-from-image', { method: 'POST', body: fd })
          if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || 'Failed to process image')
          const j = await res.json()

          const content: string = j.content || ''
          let title: string = j.title || (file.name.replace(/\.[^.]+$/, '')) || 'Image Note'
          if (!content) throw new Error('No markdown content returned from processor')

          // 2) Create a note for current user
          const { data: userRes } = await supabase.auth.getUser()
          const userId = userRes?.user?.id
          if (!userId) throw new Error('Not signed in')
          const { data, error } = await supabase
            .from('notes')
            .insert([{ title, category: '', content, project: '', user_id: userId }])
            .select('id')
            .single()
          if (error) throw new Error(error.message)

          const newId = (data as { id?: string } | null)?.id
          // Defer navigating to notes page; ActionSearchBar handles router
          if (newId) {
            try {
              // Best-effort set current note id if store is available
              const store = useNoteContextStore.getState?.()
              store?.setCurrentNoteId?.(newId)
            } catch {}
          }
          // Navigate to notes
          const clickToNotes = document.createElement('a')
          clickToNotes.href = '/notes'
          document.body.appendChild(clickToNotes)
          clickToNotes.click()
          clickToNotes.remove()
        } catch (err: any) {
          console.error('Create note from image failed', err)
          alert(err?.message || 'Create note from image failed')
        }
      }
      input.click()
    },
    category: "notes",
    priority: 85,
  },
]

function ActionSearchBar({ actions = allActions }: { actions?: Action[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<SearchResult | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)
  // Category rail state and config
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'basic' | 'ai' | 'notes' | 'decks' | 'models' | 'nav' | 'device' | 'todos'
  >('all')
  const categories: { id: typeof selectedCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All', icon: <Search className="w-4 h-4" /> },
    { id: 'basic', label: 'Basic', icon: <PlusCircle className="w-4 h-4" /> },
    { id: 'ai', label: 'AI', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'notes', label: 'Notes', icon: <Pencil className="w-4 h-4" /> },
    { id: 'decks', label: 'Decks', icon: <GitMerge className="w-4 h-4" /> },
    { id: 'models', label: 'Models', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'nav', label: 'Nav', icon: <Globe className="w-4 h-4" /> },
    { id: 'device', label: 'Device', icon: <AudioLines className="w-4 h-4" /> },
    { id: 'todos', label: 'Todos', icon: <ListTodo className="w-4 h-4" /> },
  ]
  const debouncedQuery = useDebounce(query, 200)
  const router = useRouter()
  const [showAll, setShowAll] = useState(false)
  const pathname = usePathname()
  const { openDialog } = useNoteDialogStore()
  const [openNoteFromContent, setOpenNoteFromContent] = useState(false)
  const [openMoveProject, setOpenMoveProject] = useState(false)
  const startEditCurrentNote = useNoteContextStore((s) => s.startEditCurrentNote)
  const currentNoteId = useNoteContextStore((s) => s.currentNoteId)
  const deleteNoteById = useNoteContextStore((s) => s.deleteNoteById)
  const openSelectNoteDialog = useNoteContextStore((s) => s.openSelectNoteDialog)
  const getCurrentNoteForExam = useNoteContextStore((s) => s.getCurrentNoteForExam)
  const setShowExamInNotes = useNoteContextStore((s) => s.setShowExamInNotes)
  const updateCurrentNoteContent = useNoteContextStore((s) => s.updateCurrentNoteContent)
  const [copied, setCopied] = useState(false)
  const setEnvironment = useEnvironmentStore((s) => s.setEnvironment)
  const [mounted, setMounted] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  // Image→Note sub-UI state
  const [imageNoteOpen, setImageNoteOpen] = useState(false)
  const [imageNoteTitle, setImageNoteTitle] = useState("")
  const [imageNoteProject, setImageNoteProject] = useState("")
  const [imageNoteFile, setImageNoteFile] = useState<File | null>(null)
  const [imageNoteError, setImageNoteError] = useState<string | null>(null)
  const [imageNoteWorking, setImageNoteWorking] = useState(false)
  const [imageNoteProgress, setImageNoteProgress] = useState(0)
  const [imageNoteMessage, setImageNoteMessage] = useState("Idle")
  const imageNoteMessages = [
    "Working on your request…",
    "Uploading image to storage…",
    "Processing image…",
    "Extracting Markdown…",
    "Linking images…",
    "Saving note…",
    "Almost done…",
  ]
  const resetImageNote = () => {
    setImageNoteTitle("")
    setImageNoteProject("")
    setImageNoteFile(null)
    setImageNoteError(null)
    setImageNoteWorking(false)
    setImageNoteProgress(0)
    setImageNoteMessage("Idle")
  }
  // Fix Note loading UI state
  const [fixOpen, setFixOpen] = useState(false)
  const [fixWorking, setFixWorking] = useState(false)
  const [fixProgress, setFixProgress] = useState(0)
  const [fixMessage, setFixMessage] = useState("Preparing…")
  const [fixError, setFixError] = useState<string | null>(null)
  const fixMessages = [
    "Analyzing note…",
    "Applying formatting guidelines…",
    "Generating revised content…",
    "Finalizing update…",
  ]
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  // Image generation state
  const [imgLoading, setImgLoading] = useState(false)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgError, setImgError] = useState<string | null>(null)
  const [imgCopied, setImgCopied] = useState(false)
  // Edit with AI (custom instruction) state
  const [editAiOpen, setEditAiOpen] = useState(false)
  const [editAiPrompt, setEditAiPrompt] = useState('')
  const [editAiLoading, setEditAiLoading] = useState(false)
  const [editAiError, setEditAiError] = useState<string | null>(null)
  const [editAiPreview, setEditAiPreview] = useState<string | null>(null)
  const resetEditAi = () => {
    setEditAiOpen(false)
    setEditAiPrompt('')
    setEditAiLoading(false)
    setEditAiError(null)
    setEditAiPreview(null)
  }
  // Slow (server-backed) image generation state
  const [slowLoading, setSlowLoading] = useState(false)
  const [slowUrl, setSlowUrl] = useState<string | null>(null)
  const [slowError, setSlowError] = useState<string | null>(null)
  const [slowCopied, setSlowCopied] = useState(false)
  const [slowExpanded, setSlowExpanded] = useState(false)
  const [slowScale, setSlowScale] = useState(1)
  const [slowTranslate, setSlowTranslate] = useState({ x: 0, y: 0 })
  const [slowDragging, setSlowDragging] = useState(false)
  const [slowLastPos, setSlowLastPos] = useState<{ x: number; y: number } | null>(null)
  const imageModels: ImageModel[] = [
    "flux", "turbo", "gptimage", "together", "dall-e-3",
    "sdxl-1.0", "sdxl-l", "sdxl-turbo", "sd-3.5-large",
    "flux-pro", "flux-dev", "flux-schnell", "flux-canny", "midjourney", "ideogram-v3-quality", "imagen-4.0-ultra-generate", "flux-1.1-pro"
  ]
  const [selectedModel, setSelectedModel] = useState<ImageModel>("flux-pro")

  // Todos sub-UI state (homework table)
  interface HomeworkRow { id: number; created_at: string; user_id: string; due_date: string | null; subject: string | null; priority: number | null; done: boolean | null }
  const [todosLoading, setTodosLoading] = useState(false)
  const [todos, setTodos] = useState<HomeworkRow[]>([])
  const [todoError, setTodoError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch tasks when opening palette and switching to todos
  useEffect(() => {
    const maybeFetch = async () => {
      if (!open || selectedCategory !== 'todos') return
      try {
        setTodosLoading(true)
        setTodoError(null)
        const { data: userRes, error: uErr } = await supabase.auth.getUser()
        if (uErr) throw uErr
        const uid = userRes?.user?.id
        if (!uid) { setTodos([]); setTodosLoading(false); return }
        const { data, error } = await supabase
          .from('homework')
          .select('id, created_at, user_id, due_date, subject, priority, "done ?":done')
          .eq('user_id', uid)
          .eq('done ?', false)
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false })
        if (error) throw error
        setTodos(((data as unknown) as HomeworkRow[]) || [])
      } catch (e: any) {
        console.error('Fetch homework failed', e)
        setTodoError(e?.message || 'Failed to load tasks')
      } finally {
        setTodosLoading(false)
      }
    }
    void maybeFetch()
  }, [open, selectedCategory])

  // ...

  const toggleTodo = async (id: number, done: boolean) => {
    try {
      await supabase.from('homework').update({ ['done ?']: done } as any).eq('id', id)
      if (done) {
        // Remove from the list if marked done (we only show undone tasks)
        setTodos((prev) => prev.filter((t) => t.id !== id))
      } else {
        setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)))
      }
    } catch (e) {
      console.error('Update task failed', e)
    }
  }

  // Remove addTodo and removeTodo functions
  // ...
  

  // Allow external triggers (e.g., mobile button) to open the palette
  useEffect(() => {
    const handler = () => {
      setOpen(true)
      setIsFocused(true)
      setShowAll(false)
      setTimeout(() => {
        const el = document.getElementById("action-search-input") as HTMLInputElement | null
        el?.focus()
      }, 0)
    }
    window.addEventListener('open-action-search', handler as EventListener)
    return () => window.removeEventListener('open-action-search', handler as EventListener)
  }, [])

  // Reset zoom/pan when closing expanded or when a new image arrives
  useEffect(() => {
    if (!slowExpanded || !slowUrl) {
      setSlowScale(1)
      setSlowTranslate({ x: 0, y: 0 })
      setSlowDragging(false)
      setSlowLastPos(null)
    }
  }, [slowExpanded, slowUrl])

  // Calculator: show result when query starts with '='
  const isCalc = query.trim().startsWith('=')
  const calcValue = isCalc ? evalArithmetic(query.trim().slice(1)) : null
  const trimmed = query.trim()
  const isEnvDev = trimmed === '__dev__'
  const isEnvProd = trimmed === '__prod__'
  const isEnvShow = trimmed === '__env__'
  const currentEnv = useEnvironmentStore((s) => s.environment)
  // AI question detection (use RAW query start, not trimmed)
  const isAiUi = query.startsWith('? ')
  const isAi = query.startsWith('?')
  const aiQuestion = isAiUi ? query.slice(2) : (isAi ? query.slice(1) : '')
  // Generate Image detection (works with or without '? ' UI prefix)
  const rawQuery = (isAiUi ? query.slice(2) : query).trim()
  const isGenImage = rawQuery.toLowerCase().startsWith('generate image:')
  const genImagePrompt = isGenImage ? rawQuery.slice('generate image:'.length).trim() : ''
  const isGenSlow = rawQuery.toLowerCase().startsWith('generate slow image:')
  const genSlowPrompt = isGenSlow ? rawQuery.slice('generate slow image:'.length).trim() : ''

  const applyEnv = (env: 'dev' | 'prod') => {
    setEnvironment(env)
    try {
      // Persist for middleware via cookie (1 year), path=/, SameSite=Lax
      document.cookie = `ENVIRONMENT=${env}; Path=/; Max-Age=31536000; SameSite=Lax`
    } catch {}
    // close palette after setting
    setOpen(false)
    // minor visual feedback could be added later
  }

  const copyCalc = async () => {
    if (!isCalc || calcValue === null) return
    try {
      await navigator.clipboard.writeText(String(calcValue))
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
      // Close palette after copy
      setOpen(false)
    } catch (e) {
      console.error('Copy failed', e)
    }
  }

  const computeEffectiveActions = (): Action[] => {
    let base = actions
    // Notes-specific quick actions
    if (pathname.startsWith('/notes')) {
      const prepend: Action[] = [
        {
          id: "create-note-from-content",
          label: "Create note from content",
          description: "Paste text or upload a file",
          icon: <PlusCircle className="h-4 w-4 text-emerald-600" />,
          short: "Enter",
          end: "Notes",
          run: () => setOpenNoteFromContent(true),
          category: "notes",
          priority: 92,
        },
        {
          id: "create-note-from-image",
          label: "Create note from image",
          description: "Upload image → process → create note",
          icon: <ImageIcon className="h-4 w-4 text-purple-500" />,
          short: "Enter",
          end: "Image → Note",
          keepOpen: true,
          run: () => {
            // Open inline sub-UI instead of closing palette
            setImageNoteOpen(true)
            setTimeout(() => {
              try {
                const el = document.querySelector('input[type="file"]') as HTMLInputElement | null
                el?.focus()
              } catch {}
            }, 0)
          },
          category: "notes",
          priority: 90,
        },
        {
          id: "edit-with-ai",
          label: "Edit with AI…",
          description: currentNoteId ? "Enter custom instruction, preview, then save" : "Select a note first",
          icon: <Pencil className="h-4 w-4 text-blue-500" />,
          short: "Enter",
          end: "AI",
          keepOpen: true,
          run: () => {
            if (!currentNoteId || typeof getCurrentNoteForExam !== 'function') {
              if (typeof openSelectNoteDialog === 'function') openSelectNoteDialog()
              return
            }
            setEditAiError(null)
            setEditAiPreview(null)
            setEditAiOpen(true)
            // focus later on textarea
            setTimeout(() => {
              try {
                const el = document.getElementById('edit-ai-textarea') as HTMLTextAreaElement | null
                el?.focus()
              } catch {}
            }, 0)
          },
          category: "ai",
          priority: 88,
        },
        {
          id: "fix-note-content",
          label: "Fix note content (AI)",
          description: currentNoteId ? "Send content + guidelines to Groq, create revised note" : "Select a note first",
          icon: <Pencil className="h-4 w-4 text-blue-600" />,
          short: "Enter",
          end: "AI",
          keepOpen: true,
          run: async () => {
            try {
              if (!currentNoteId || typeof getCurrentNoteForExam !== 'function') {
                if (typeof openSelectNoteDialog === 'function') openSelectNoteDialog()
                return
              }
              const data = getCurrentNoteForExam()
              if (!data || !data.content?.trim()) {
                alert('No content found for the current note.')
                return
              }
              setFixError(null)
              setFixOpen(true)
              setFixWorking(true)
              setFixProgress(0)
              // 2 minute timeline
              const start = Date.now()
              const total = 120000
              const timer = setInterval(() => {
                const elapsed = Date.now() - start
                const pct = Math.min(100, (elapsed / total) * 100)
                setFixProgress(pct)
              }, 200)
              let msgIdx = 0
              setFixMessage(fixMessages[msgIdx])
              const msgTimer = setInterval(() => {
                msgIdx = (msgIdx + 1) % fixMessages.length
                setFixMessage(fixMessages[msgIdx])
              }, 9000)
              const originalTitle = data.title || 'Note'
              const guidelines = `
You are an expert technical editor. Fix all errors and improve clarity without changing meaning.
Formatting rules:
- replace any <br> with a line break
- Output MUST be Markdown only. No code fences, no backticks, no prose outside the note.
- Keep headings structured (#, ##, ###) and use consistent title case.
- Convert unordered text lists into proper bullet lists.
- Keep and normalize fenced code blocks with correct language tags.
- Fix broken or relative image links only if a clear absolute replacement exists; otherwise preserve as-is.
- Remove duplicated sections, obvious OCR artifacts, and dangling references.
- Keep important equations, examples, and tables; render in Markdown.
- Do not add a preface or summary unless the note already contains one (then improve it).
`
              const systemMessage = 'You are a meticulous Markdown editor. Return ONLY the corrected Markdown. Do not include code fences or explanations.'
              const userPrompt = `Please revise the following note according to the guidelines. Return ONLY the corrected Markdown content.\n\nGuidelines:\n${guidelines}\n\nNote Markdown:\n${data.content}`
              // Call Groq
              const revised = await makeGroqRequest(userPrompt, false, systemMessage)
              const cleaned = (revised || '').trim()
              if (!cleaned) {
                alert('AI returned empty content. Please try again.')
                throw new Error('AI returned empty content')
              }
              // Update current note with revised content (in-place)
              const { error } = await supabase
                .from('notes')
                .update({ content: cleaned })
                .eq('id', currentNoteId)
                .single()
              if (error) throw new Error(error.message)
              // Push refreshed content into the current view immediately
              try { updateCurrentNoteContent?.(cleaned) } catch {}
              // Done: fast-forward progress and close
              setFixProgress(100)
              clearInterval(timer)
              clearInterval(msgTimer)
              setOpen(false)
              setFixOpen(false)
              setFixWorking(false)
            } catch (e: any) {
              console.error('Fix note failed', e)
              setFixError(e?.message || 'Failed to fix note content')
              setFixWorking(false)
            }
          },
          category: "ai",
          priority: 86,
        },
        {
          id: "move-note-project",
          label: "Move note to project",
          description: currentNoteId ? "Change this note's project" : "Select a note first",
          icon: <Pencil className="h-4 w-4 text-violet-600" />,
          short: "Enter",
          end: "Notes",
          run: () => {
            if (!currentNoteId) {
              if (typeof openSelectNoteDialog === 'function') openSelectNoteDialog()
              else alert('Select a note first')
              return
            }
            setOpenMoveProject(true)
          },
          category: "notes",
          priority: 75,
        },
        {
          id: "exam-from-note",
          label: "Start exam from note",
          description: currentNoteId ? "Generate questions from the current note" : "Select a note first",
          icon: <BarChart2 className="h-4 w-4 text-indigo-600" />,
          short: "Enter",
          end: "Exam",
          run: async () => {
            try {
              if (!currentNoteId || typeof getCurrentNoteForExam !== 'function') {
                if (typeof openSelectNoteDialog === 'function') openSelectNoteDialog()
                return
              }
              const data = getCurrentNoteForExam()
              if (!data || !data.content.trim()) {
                alert('No content found for the current note.')
                return
              }
              const examName = `Exam from: ${data.title || 'Note'}`
              const questionCount = 8
              const difficulty = 'medium'
              // Ask AI to produce ExamQuestion[] JSON
              const systemMsg = 'You are an educational content generator. Always output strict JSON parsable by JSON.parse, representing an array of ExamQuestion objects.'
              const userPrompt = `Create ${questionCount} diverse questions from the following note content. Mix types among: "multiple-choice", "true-false", "short-answer", and "matching". For MCQ include exactly 4 options and ensure correctAnswer is one of them. For matching, include 4-6 {left,right} pairs in matchingPairs. For short-answer, set correctAnswer to a concise expected answer. For true-false, set correctAnswer to "True" or "False". Schema keys: id (omit or set null), type, question, correctAnswer, options (for MCQ), matchingPairs (for matching), explanation (optional).

Note content:\n\n${data.content}`
              let questions: any[] = []
              try {
                const raw = await makeGroqRequest(userPrompt, false, systemMsg, true)
                // Try to extract JSON array
                const jsonMatch = raw.match(/\[([\s\S]*?)\]/)
                const jsonText = jsonMatch ? `[${jsonMatch[1]}]` : raw
                const parsed = JSON.parse(jsonText)
                if (Array.isArray(parsed)) questions = parsed
              } catch (e) {
                console.warn('AI question generation failed, falling back', e)
              }
              // Fallback minimal questions if AI failed
              if (!Array.isArray(questions) || questions.length === 0) {
                const lines = data.content.split('\n').filter(l => l.trim())
                const first = lines[0] || 'the main topic'
                questions = [
                  { type: 'short-answer', question: 'What is the main topic of the note?', correctAnswer: first },
                  { type: 'true-false', question: 'The note contains factual information about the topic.', correctAnswer: 'True' },
                  { type: 'multiple-choice', question: `Which best describes ${first}?`, options: ['Definition', 'Example', 'History', 'Unrelated concept'], correctAnswer: 'Definition' },
                ]
              }
              // Normalize and add ids/difficulty
              const normalized = questions.map((q, idx) => {
                const t = q.type || 'short-answer'
                const out: any = {
                  id: idx + 1,
                  type: t,
                  question: q.question || 'Question',
                  correctAnswer: q.correctAnswer || '',
                  difficulty,
                }
                if (t === 'multiple-choice') {
                  const opts = Array.isArray(q.options) ? q.options.slice(0, 4) : []
                  if (opts.length < 4) {
                    while (opts.length < 4) opts.push(`Option ${opts.length + 1}`)
                  }
                  // Ensure correctAnswer is one of options
                  if (!opts.includes(q.correctAnswer)) out.correctAnswer = opts[0]
                  out.options = opts
                }
                if (t === 'matching') {
                  const mp = Array.isArray(q.matchingPairs) ? q.matchingPairs : []
                  out.matchingPairs = mp
                }
                if (q.explanation) out.explanation = q.explanation
                return out
              })
              const payload = {
                examName,
                questions: normalized,
                difficulty,
                questionCount: normalized.length,
                source: 'notes' as const,
                notesContent: data.content,
                createdAt: new Date().toISOString(),
              }
              try {
                localStorage.setItem('notes_exam_data', JSON.stringify(payload))
              } catch {}
              // Embed the exam inside the current note view
              try { setShowExamInNotes(true) } catch {}
              setOpen(false)
            } catch (err) {
              console.error('Failed to start exam from note', err)
              alert('Failed to start exam from this note.')
            }
          },
          category: "notes",
          priority: 70,
        },
        {
          id: "edit-note",
          label: "Edit current note",
          description:
            currentNoteId
              ? "Enter edit mode"
              : "Select a note first to edit",
          icon: <Pencil className="h-4 w-4" />,
          short: "Enter",
          end: "Ctrl+E",
          run: () => {
            if (!currentNoteId) {
              if (typeof openSelectNoteDialog === "function") openSelectNoteDialog()
              return
            }
            if (typeof startEditCurrentNote === "function") startEditCurrentNote()
          },
          category: "notes",
          priority: 93,
        },
        {
          id: "delete-note",
          label: "Delete note",
          description:
            currentNoteId && typeof deleteNoteById === "function"
              ? `Delete current note (${currentNoteId.slice(0, 6)}…)`
              : "Select a note first to delete",
          icon: <Trash2 className="h-4 w-4" />,
          short: "Enter",
          end: "⌘K",
          run: () => {
            if (!currentNoteId || typeof deleteNoteById !== "function") {
              if (typeof openSelectNoteDialog === "function") openSelectNoteDialog()
              return
            }
            deleteNoteById(currentNoteId)
          },
          category: "notes",
          priority: 40,
        },
        {
          id: "create-note",
          label: "Create note",
          description: "Open create note dialog",
          icon: <PlusCircle className="h-4 w-4" />,
          short: "Enter",
          end: "⌘K",
          run: () => openDialog(),
          category: "basic",
          priority: 96,
        },
      ]
      base = [...prepend, ...base]
    }
    // Enhance the "Question" action to prime the input with '? '
    base = base.map(a => a.id === "question"
      ? {
          ...a,
          run: () => {
            setQuery(prev => (prev.startsWith('? ') ? prev : '? '))
            setAiAnswer(null)
            setAiError(null)
            // keep palette open and focus input
            setTimeout(() => {
              const el = document.getElementById("action-search-input") as HTMLInputElement | null
              el?.focus()
            }, 0)
          },
        }
      : a
    )
    // Context-aware filtering
    if (!pathname.startsWith('/notes')) {
      base = base.filter(a => ![
        'delete-note','edit-note','create-note','move-note-project','exam-from-note','fix-note-content','edit-with-ai','create-note-from-image','create-note-from-content'
      ].includes(a.id))
    }
    if (pathname.startsWith('/models')) {
      // Do not show note deletion (reinforced by the above), keep model-related only if present
      base = base.filter(a => a.id !== 'delete-note')
    }
    return base
  }

  // Global hotkeys: Ctrl+K / Ctrl+L to open, ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isOpenCombo = (e.ctrlKey || e.metaKey) && (e.key === "K" || e.key === "k" || e.key === "L" || e.key === "l")
      if (isOpenCombo) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(true)
        setIsFocused(true)
        setShowAll(false)
        setResult({ actions: computeEffectiveActions().slice(0, 8) })
        // focus input after open
        setTimeout(() => {
          if (typeof document !== 'undefined') {
            const el = document.getElementById("action-search-input") as HTMLInputElement | null
            el?.focus()
          }
        }, 0)
        return
      }
      if (e.key === "Escape") {
        setOpen(false)
        setShowAll(false)
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [])

  useEffect(() => {
    const eff = computeEffectiveActions()
    if (!isFocused && !open) {
      setResult(null)
      return
    }

    // Category selection is applied after computing context-aware actions
    const scoped = selectedCategory === 'all'
      ? eff
      : eff.filter(a => (a.category || 'basic') === selectedCategory)

    if (!debouncedQuery) {
      setResult({ actions: showAll ? scoped : scoped.slice(0, 8) })
      return
    }

    const normalizedQuery = debouncedQuery.toLowerCase().trim()

    // Score actions
    const scored = scoped.map(a => {
      if (!normalizedQuery) return { a, score: (a.priority ?? 0) + (['basic','notes','nav'].includes(a.category || '') ? 10 : 0) }
      const hay = [a.label, a.description, a.id].filter(Boolean).join(' ').toLowerCase()
      let s = 0
      if (hay.includes(normalizedQuery)) s += 10
      if ((a.label || '').toLowerCase().startsWith(normalizedQuery)) s += 20
      if ((a.id || '').toLowerCase().startsWith(normalizedQuery)) s += 10
      if ((a.category && ['basic','notes','nav'].includes(a.category)) ) s += 5
      s += (a.priority ?? 0)
      return { a, score: s }
    })
      .filter(x => normalizedQuery ? x.score > 0 : true)
      .sort((x, y) => y.score - x.score)
      .map(x => x.a)

    // If nothing matches, prefer showing navigation quick links so the user always has something to do
    const navActions = scoped.filter((a) => !!a.href)
    setResult({ actions: scored.length > 0 ? scored : navActions })
  }, [debouncedQuery, isFocused, open, showAll, pathname, selectedCategory])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const prevAiUi = query.startsWith('? ')
    const prevAi = query.startsWith('?') && !prevAiUi

    // If in AI UI mode ("? "), value shown excludes the prefix
    if (prevAiUi) {
      if (val === '') {
        // User deleted back to start: exit AI mode
        setQuery('')
      } else {
        setQuery(`? ${val}`)
      }
    } else if (prevAi) {
      // In raw '?' mode, if user removed the '?', exit AI
      if (!val.startsWith('?')) {
        setQuery(val)
      } else {
        // Normalize to '? ' when needed
        setQuery(val.startsWith('? ') ? val : val.startsWith('?') ? `? ${val.slice(1)}` : val)
      }
    } else {
      setQuery(val)
    }
    // Reset AI outputs on input change
    setAiAnswer(null)
    setAiError(null)
    setIsTyping(true)
  }

  // Ask AI helper
  const askAI = async () => {
    const q = aiQuestion.trim()
    if (!q) return
    try {
      setAiLoading(true)
      setAiError(null)
      const systemMessage = "You are a helpful assistant. Answer clearly and concisely."
      const answer = await makeGroqRequest(q, false, systemMessage)
      setAiAnswer(answer)
    } catch (err: any) {
      setAiError(err?.message || 'Failed to get an answer.')
    } finally {
      setAiLoading(false)
    }
  }

  // Generate Image helper using Pollinations (flux-pro)
  const generateImageFromPrompt = async (prompt: string) => {
    try {
      setImgLoading(true)
      setImgError(null)
      setImgUrl(null)
      // Build Pollinations URL (returns an image file). Width/height set to 512 for quicker preview.
      const encodedPrompt = encodeURIComponent(prompt)
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux-pro&width=1024&height=1024`
      setImgUrl(url)
      // Also append to the body as an immediate preview outside the palette
      const img = new Image()
      img.src = url
      document.body.appendChild(img)
    } catch (err: any) {
      console.error('Image generation failed', err)
      setImgError(err?.message || 'Image generation failed')
      alert(err?.message || 'Image generation failed')
    } finally {
      setImgLoading(false)
    }
  }

  // Slow image generation using backend helper (supports many models)
  const generateSlowImageFromPrompt = async (prompt: string, model: ImageModel) => {
    try {
      setSlowLoading(true)
      setSlowError(null)
      setSlowUrl(null)
      const res = await generateSlowImageApi(prompt, model)
      const b64 = res?.data?.[0]?.b64_json
      if (!b64) throw new Error('No image payload returned')
      const isHttp = typeof b64 === 'string' && (b64.startsWith('http://') || b64.startsWith('https://'))
      const isData = typeof b64 === 'string' && b64.startsWith('data:')
      const url = isData ? b64 : (isHttp ? b64 : `data:image/png;base64,${b64}`)
      setSlowUrl(url)
    } catch (err: any) {
      console.error('Slow image generation failed', err)
      setSlowError(err?.message || 'Slow image generation failed')
    } finally {
      setSlowLoading(false)
    }
  }

  const container = {
    hidden: { opacity: 0, height: 0 },
    show: {
      opacity: 1,
      height: "auto",
      transition: {
        height: {
          duration: 0.4,
        },
        staggerChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      height: 0,
      transition: {
        height: {
          duration: 0.3,
        },
        opacity: {
          duration: 0.2,
        },
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
      },
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: {
        duration: 0.2,
      },
    },
  }

  // Reset selectedAction when focusing the input
  const handleFocus = () => {
    setSelectedAction(null)
    setIsFocused(true)
  }

  const runAction = (action: Action) => {
    try {
      if (action.run) action.run()
      else if (action.href) router.push(action.href)
    } finally {
      // Close and reset unless the action requests to keep the palette open
      if (!action.keepOpen) {
        setOpen(false)
        setQuery("")
        setResult(null)
        setSelectedAction(null)
      }
    }
  }


  const content = (
    <motion.div
      className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden bg-white/95 dark:bg-neutral-900/90 backdrop-blur-lg border border-black/5 dark:border-white/10 shadow-2xl text-gray-900 dark:text-gray-50"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative flex flex-row justify-start items-stretch">
        {/* Left category rail */}
        <div className="hidden sm:flex flex-col gap-1 p-2 border-r border-black/5 dark:border-white/10 min-w-12 bg-white/40 dark:bg-neutral-900/40">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              title={cat.label}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${selectedCategory === cat.id ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.icon}
            </button>
          ))}
        </div>
        <div className="flex-1 flex flex-col">
          <div className="w-full px-4 pt-4 pb-2 bg-transparent">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block" htmlFor="search">
            Search Commands
          </label>
          <div className="relative">
            {isAiUi && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-black/10 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-blue-600">
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="text-[10px] leading-none font-semibold">?</span>
              </div>
            )}
        
            <Input
              type="text"
              placeholder="Ask a question with ? or search commands"
              value={isAiUi ? query.slice(2) : query}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              id="action-search-input"
              className={`${isAiUi ? 'pl-16' : 'pl-3'} pr-9 py-1.5 h-10 text-sm rounded-lg focus-visible:ring-offset-0 bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  const q = (isAiUi ? query.slice(2) : query).trim()
                  const lower = q.toLowerCase()
                  if (lower.startsWith('generate image:')) {
                    const prompt = q.slice('generate image:'.length).trim()
                    if (prompt.length > 0) {
                      // Trigger generation and keep palette open to preview and copy URL
                      generateImageFromPrompt(prompt)
                    }
                  } else if (lower.startsWith('generate slow image:')) {
                    const prompt = q.slice('generate slow image:'.length).trim()
                    if (prompt.length > 0) {
                      generateSlowImageFromPrompt(prompt, selectedModel)
                    }
                  } else if (isCalc) {
                    // Copy calculator result instead of running an action
                    copyCalc()
                  } else if (isEnvDev) {
                    applyEnv('dev')
                  } else if (isEnvProd) {
                    applyEnv('prod')
                  } else if (isEnvShow) {
                    // Just close or do nothing; here we close for a quick glance UX
                    setOpen(false)
                  } else if (isAi && aiQuestion.trim().length > 0) {
                    // Ask AI instead of running an action
                    askAI()
                  } else {
                    const target = selectedAction ?? result?.actions?.[0]
                    if (target) runAction(target)
                  }
                }
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <AnimatePresence mode="popLayout">
                {isAiUi ? (
                  <motion.button
                    key="exit"
                    type="button"
                    aria-label="Exit question mode"
                    title="Exit question mode"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-flex items-center justify-center w-5 h-5 rounded-md border border-black/10 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => {
                      setQuery(aiQuestion)
                      setAiAnswer(null)
                      setAiError(null)
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </motion.button>
                ) : query.length > 0 ? (
                  <motion.div
                    key="send"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Send className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="search"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        {/* AI Question UI */}
        {isAi && (
          <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-500" />
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Ask AI</div>
              </div>
              <div className="text-gray-900 dark:text-gray-100 font-medium whitespace-pre-wrap break-words">
                {aiQuestion || 'Type your question after ?'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={askAI}
                  disabled={aiLoading || !aiQuestion.trim()}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                >
                  {aiLoading ? 'Thinking…' : 'Ask'}
                </button>
                {aiAnswer && (
                  <button
                    type="button"
                    onClick={async () => { await navigator.clipboard.writeText(aiAnswer) }}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Copy className="w-4 h-4" />
                    Copy answer
                  </button>
                )}
              </div>
              {aiError && (
                <div className="text-xs text-red-500">{aiError}</div>
              )}
              {aiAnswer && (
                <div className="mt-1 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                  {aiAnswer}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Edit with AI (custom instruction) inline UI */}
        {(editAiOpen || editAiLoading || editAiPreview || editAiError) && (
          <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Edit with AI</div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-600 dark:text-gray-400" htmlFor="edit-ai-textarea">Instruction</label>
                <textarea
                  id="edit-ai-textarea"
                  rows={3}
                  value={editAiPrompt}
                  onChange={(e) => setEditAiPrompt(e.target.value)}
                  disabled={editAiLoading}
                  placeholder="e.g., Rewrite concisely, fix grammar, keep code blocks, and preserve Markdown structure."
                  className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (!currentNoteId || typeof getCurrentNoteForExam !== 'function') {
                          if (typeof openSelectNoteDialog === 'function') openSelectNoteDialog()
                          return
                        }
                        const data = getCurrentNoteForExam()
                        if (!data || !data.content?.trim()) {
                          alert('No content found for the current note.')
                          return
                        }
                        const instruction = editAiPrompt.trim()
                        if (!instruction) {
                          setEditAiError('Please enter an instruction')
                          return
                        }
                        setEditAiLoading(true)
                        setEditAiError(null)
                        setEditAiPreview(null)
                        const systemMessage = 'You are a meticulous Markdown editor. Return ONLY the edited Markdown. No code fences or explanations.'
                        const userPrompt = `Instruction:\n${instruction}\n\nEdit the following Markdown accordingly and return ONLY the final Markdown (no backticks, no fences):\n\n${data.content}`
                        const revised = await makeGroqRequest(userPrompt, false, systemMessage)
                        const cleaned = (revised || '').trim()
                        if (!cleaned) {
                          throw new Error('AI returned empty content')
                        }
                        setEditAiPreview(cleaned)
                      } catch (e: any) {
                        console.error('Edit with AI failed', e)
                        setEditAiError(e?.message || 'Failed to edit with AI')
                      } finally {
                        setEditAiLoading(false)
                      }
                    }}
                    disabled={editAiLoading || !editAiPrompt.trim()}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {editAiLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>) : 'Generate' }
                  </button>
                  <button
                    type="button"
                    onClick={resetEditAi}
                    disabled={editAiLoading}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              {editAiError && <div className="text-xs text-red-500">{editAiError}</div>}
              {editAiPreview && (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview</div>
                  <div className="max-h-64 overflow-auto rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 p-2 text-sm whitespace-pre-wrap break-words">
                    {editAiPreview}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (!currentNoteId || !editAiPreview) return
                          const { error } = await supabase
                            .from('notes')
                            .update({ content: editAiPreview })
                            .eq('id', currentNoteId)
                            .single()
                          if (error) throw new Error(error.message)
                          // Update UI immediately with the saved content
                          try { updateCurrentNoteContent?.(editAiPreview) } catch {}
                          setOpen(false)
                          resetEditAi()
                        } catch (e: any) {
                          console.error('Save failed', e)
                          setEditAiError(e?.message || 'Failed to save changes')
                        }
                      }}
                      className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={resetEditAi}
                      className="px-3 py-1.5 text-sm rounded-md border border-black/10 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Todos UI */}
        {selectedCategory === 'todos' && (
          <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-emerald-600" />
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Tasks</div>
              </div>
              {todoError && <div className="text-xs text-red-500">{todoError}</div>}
              {todosLoading && (
                <div className="p-2 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              )}
              {!todosLoading && todos.length === 0 && (
                <div className="p-2 text-xs text-muted-foreground">No tasks</div>
              )}
              <div className="divide-y">
                {todos.filter((t: HomeworkRow) => !t.done).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="w-full text-left p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                    onClick={() => toggleTodo(t.id, true)}
                    title="Mark as done"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">{t.subject || 'Homework'}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : 'No due date'}
                          {t.priority ? ` · Priority ${t.priority}` : ''}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Done</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Slow Image Generation UI (below search bar) */}
        {(isGenSlow || slowLoading || slowUrl || slowError) && (
          <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon />
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Generate Slow Image</div>
              </div>
              {isGenSlow && (
                <div className="text-gray-900 dark:text-gray-100 font-medium whitespace-pre-wrap break-words">
                  {genSlowPrompt || 'Type a prompt after “generate slow image:”'}
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-400">Model</label>
                <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ImageModel)}>
                  <SelectTrigger className="h-7 w-48">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {imageModels.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => { const p = genSlowPrompt; if (p) generateSlowImageFromPrompt(p, selectedModel) }}
                  disabled={slowLoading || !genSlowPrompt}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                >
                  {slowLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>) : 'Generate'}
                </button>
              </div>
              {slowLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> This may take a while…
                </div>
              )}
              {slowError && <div className="text-xs text-red-500">{slowError}</div>}
              {slowUrl && (
                <div className="flex flex-col gap-2">
                  <div
                    className={`relative w-full overflow-hidden rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 ${slowExpanded ? 'p-1' : 'p-2'}`}
                    onWheel={(e) => {
                      if (!slowExpanded) return
                      e.preventDefault()
                      const delta = -e.deltaY
                      const factor = delta > 0 ? 1.1 : 0.9
                      const next = Math.min(8, Math.max(1, slowScale * factor))
                      setSlowScale(next)
                    }}
                    onMouseDown={(e) => {
                      if (!slowExpanded) return
                      e.preventDefault()
                      setSlowDragging(true)
                      setSlowLastPos({ x: e.clientX, y: e.clientY })
                    }}
                    onMouseMove={(e) => {
                      if (!slowExpanded || !slowDragging || !slowLastPos) return
                      e.preventDefault()
                      const dx = e.clientX - slowLastPos.x
                      const dy = e.clientY - slowLastPos.y
                      setSlowTranslate((t) => ({ x: t.x + dx, y: t.y + dy }))
                      setSlowLastPos({ x: e.clientX, y: e.clientY })
                    }}
                    onMouseUp={() => { if (slowDragging) { setSlowDragging(false); setSlowLastPos(null) } }}
                    onMouseLeave={() => { if (slowDragging) { setSlowDragging(false); setSlowLastPos(null) } }}
                  >
                    {/* Expanded mode overlayed close button */}
                    {slowExpanded && (
                      <button
                        type="button"
                        aria-label="Close expanded image"
                        className="absolute top-2 right-2 z-10 inline-flex items-center justify-center rounded-md border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-800/80 backdrop-blur px-1.5 py-1 hover:bg-white dark:hover:bg-neutral-800"
                        onClick={() => setSlowExpanded(false)}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slowUrl}
                      alt="Generated"
                      className={
                        slowExpanded
                          ? 'w-full h-auto max-h-[70vh] object-contain rounded'
                          : 'max-h-64 mx-auto rounded cursor-zoom-in'
                      }
                      style={slowExpanded ? {
                        transform: `translate(${slowTranslate.x}px, ${slowTranslate.y}px) scale(${slowScale})`,
                        transformOrigin: 'center center',
                        cursor: slowScale > 1 ? (slowDragging ? 'grabbing' : 'grab') : 'zoom-out',
                        transition: slowDragging ? 'none' : 'transform 40ms linear'
                      } : undefined}
                      onClick={() => setSlowExpanded((v) => !v)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      onClick={async () => {
                        try {
                          const filename = `image-${Date.now()}.png`
                          const link = document.createElement('a')
                          if (slowUrl.startsWith('data:')) {
                            link.href = slowUrl
                            link.download = filename
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                          } else {
                            const resp = await fetch(slowUrl)
                            const blob = await resp.blob()
                            const url = URL.createObjectURL(blob)
                            link.href = url
                            link.download = filename
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                            URL.revokeObjectURL(url)
                          }
                        } catch (e) {
                          console.error('Save failed', e)
                        }
                      }}
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-xs">Save</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Image Generation UI */}
        {(isGenImage || imgLoading || imgUrl || imgError) && (
          <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon />
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Generate Image</div>
              </div>
              {isGenImage && (
                <div className="text-gray-900 dark:text-gray-100 font-medium whitespace-pre-wrap break-words">
                  {genImagePrompt || 'Type a prompt after “generate image:”'}
                </div>
              )}
              {imgLoading && <div className="text-xs text-gray-600 dark:text-gray-400">Generating…</div>}
              {imgError && <div className="text-xs text-red-500">{imgError}</div>}
              {imgUrl && (
                <div className="flex flex-col gap-2">
                  <div className="w-full overflow-hidden rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 p-2">
                    {/* Preview */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl} alt="Generated" className="max-h-64 mx-auto rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] break-all text-gray-700 dark:text-gray-300 bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded border border-black/5 dark:border-white/10 flex-1">{imgUrl}</code>
                    <button
                      type="button"
                      onClick={async () => {
                        if (imgUrl) {
                          await navigator.clipboard.writeText(imgUrl)
                          setImgCopied(true)
                          setTimeout(() => setImgCopied(false), 1000)
                        }
                      }}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="text-xs">{imgCopied ? 'Copied' : 'Copy URL'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {isCalc && (
          <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Result</div>
                <div className="text-gray-900 dark:text-gray-100 font-semibold text-base">
                  {calcValue === null ? 'Invalid expression' : `${calcValue}`}
                </div>
              </div>
              <button
                type="button"
                onClick={copyCalc}
                disabled={calcValue === null}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                aria-label="Copy result"
                title={copied ? 'Copied!' : 'Copy'}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500"/> : <Copy className="w-4 h-4"/>}
                <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}
        {(isEnvDev || isEnvProd) && (
          <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Environment</div>
                <div className="text-gray-900 dark:text-gray-100 font-semibold text-base">
                  Set ENVIRONMENT to {isEnvDev ? 'dev' : 'prod'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => applyEnv(isEnvDev ? 'dev' : 'prod')}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                aria-label="Apply environment"
                title="Apply"
              >
                <span className="text-xs">Apply</span>
              </button>
            </div>
          </div>
        )}
        {isEnvShow && (
          <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Environment</div>
                <div className="text-gray-900 dark:text-gray-100 font-semibold text-base">
                  Current ENVIRONMENT: {currentEnv}
                </div>
              </div>
              <span className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 text-xs select-none">
                {currentEnv}
              </span>
            </div>
          </div>
        )}
        <div className="w-full px-2 pb-3">
          <AnimatePresence>
            {open && result && !selectedAction && (
              <motion.div
                className="w-full rounded-xl overflow-hidden bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10"
                variants={container}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                <motion.ul>
                  {!imageNoteOpen && result.actions.map((action) => (
                    <motion.li
                      key={action.id}
                      className="px-3 py-2 flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                      variants={item}
                      layout
                      onClick={() => runAction(action)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          runAction(action)
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-black dark:text-white">
                            {isValidElement(action.icon)
                              ? cloneElement(action.icon as any, { className: "h-4 w-4 text-black dark:text-white" })
                              : action.icon}
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{action.label}</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">{action.description}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400">{action.short}</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 text-right">{action.end}</span>
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
                {/* Image→Note sub-UI */}
                {imageNoteOpen && (
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Title</label>
                        <Input
                          placeholder="Note title"
                          value={imageNoteTitle}
                          onChange={(e) => setImageNoteTitle(e.target.value)}
                          disabled={imageNoteWorking}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Project</label>
                        <Input
                          placeholder="Project (optional)"
                          value={imageNoteProject}
                          onChange={(e) => setImageNoteProject(e.target.value)}
                          disabled={imageNoteWorking}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Image</label>
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={imageNoteWorking}
                        onChange={(e) => setImageNoteFile((e.target.files && e.target.files[0]) || null)}
                      />
                    </div>
                    {imageNoteError && (
                      <div className="text-xs text-red-600">{imageNoteError}</div>
                    )}
                    {imageNoteWorking && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                          <span>{imageNoteMessage}</span>
                          <span>{Math.round(imageNoteProgress)}%</span>
                        </div>
                        <Progress value={imageNoteProgress} className="h-2" />
                        <div className="text-[10px] text-neutral-500">Estimated ~2 minutes</div>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm rounded-md border border-black/10 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        disabled={imageNoteWorking}
                        onClick={() => {
                          resetImageNote()
                          setImageNoteOpen(false)
                        }}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        disabled={imageNoteWorking || !imageNoteFile}
                        onClick={async () => {
                          setImageNoteError(null)
                          if (!imageNoteFile) {
                            setImageNoteError('Please select an image')
                            return
                          }
                          try {
                            setImageNoteWorking(true)
                            setImageNoteProgress(0)
                            // 2 minute timeline
                            const start = Date.now()
                            const total = 120000
                            const timer = setInterval(() => {
                              const elapsed = Date.now() - start
                              const pct = Math.min(100, (elapsed / total) * 100)
                              setImageNoteProgress(pct)
                            }, 200)
                            let msgIdx = 0
                            setImageNoteMessage(imageNoteMessages[msgIdx])
                            const msgTimer = setInterval(() => {
                              msgIdx = (msgIdx + 1) % imageNoteMessages.length
                              setImageNoteMessage(imageNoteMessages[msgIdx])
                            }, 9000)

                            // Upload/process
                            const fd = new FormData()
                            fd.append('file', imageNoteFile)
                            const res = await fetch('/api/note-from-image', { method: 'POST', body: fd })
                            if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || 'Failed to process image')
                            const j = await res.json()

                            // Create note
                            const { data: userRes } = await supabase.auth.getUser()
                            const userId = userRes?.user?.id
                            if (!userId) throw new Error('Not signed in')
                            const title = imageNoteTitle.trim() || j.title || (imageNoteFile.name.replace(/\.[^.]+$/, '')) || 'Image Note'
                            const project = imageNoteProject.trim()
                            const content: string = j.content || ''
                            if (!content) throw new Error('No markdown content returned')
                            setImageNoteMessage('Saving note…')
                            const { data, error } = await supabase
                              .from('notes')
                              .insert([{ title, category: '', content, project, user_id: userId }])
                              .select('id')
                              .single()
                            if (error) throw new Error(error.message)

                            const newId = (data as { id?: string } | null)?.id
                            if (newId) {
                              try { useNoteContextStore.getState?.()?.setCurrentNoteId?.(newId) } catch {}
                            }

                            // Done: fast-forward progress and close
                            setImageNoteProgress(100)
                            clearInterval(timer)
                            clearInterval(msgTimer)
                            // Keep palette open feel but redirect to notes
                            const a = document.createElement('a')
                            a.href = '/notes'
                            document.body.appendChild(a)
                            a.click()
                            a.remove()
                            // Close palette after redirect
                            setOpen(false)
                            resetImageNote()
                            setImageNoteOpen(false)
                          } catch (e: any) {
                            console.error(e)
                            setImageNoteError(e?.message || 'Failed to create note from image')
                          } finally {
                            setImageNoteWorking(false)
                          }
                        }}
                      >
                        {imageNoteWorking ? 'Working…' : 'Create'}
                      </button>
                    </div>
                  </div>
                )}
                {/* Show more when query empty and limited list is shown */}
                {!imageNoteOpen && selectedCategory !== 'todos' && !debouncedQuery && !showAll && computeEffectiveActions().length > 8 && (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-t border-black/5 dark:border-white/10"
                    onClick={() => {
                      setShowAll(true)
                      setResult({ actions: computeEffectiveActions() })
                    }}
                  >
                    Show more ({computeEffectiveActions().length - 8} more)
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>
    </motion.div>
  )

  if (!mounted) return null
  const portalTarget = typeof document !== 'undefined' ? document.body : null
  if (!portalTarget) return null

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xl flex items-center justify-center p-4"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>,
        portalTarget
      )}
      <NoteFromContentDialog open={openNoteFromContent} onOpenChange={setOpenNoteFromContent} />
      <MoveNoteProjectDialog open={openMoveProject} onOpenChange={setOpenMoveProject} noteId={currentNoteId} />
    </>
  )
}

export default ActionSearchBar
