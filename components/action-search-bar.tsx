"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Send, BarChart2, Globe, Video, PlaneTakeoff, AudioLines, PlusCircle, Trash2, Copy, Check, HelpCircle, X, Image as ImageIcon, Download, Pencil } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import useDebounce from "@/hooks/use-debounce"
import { useNoteDialogStore } from "@/hooks/use-note-dialog"
import { useNoteContextStore } from "@/hooks/use-note-context"
import { useEnvironmentStore } from "@/hooks/use-environment"
import { makeGroqRequest } from "@/lib/groq"
import { generateImage as generateSlowImageApi, type ImageModel } from "@/lib/generate-image"
import { Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Action {
  id: string
  label: string
  icon?: React.ReactNode
  description?: string
  short?: string
  end?: string
  href?: string
  run?: () => void
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
    icon: <Globe className="h-4 w-4 text-blue-500"/>,
    short: "Enter",
    end: "⌘K",
    href: "/",
  },
  {
    id: "go-notes",
    label: "Go to Notes",
    description: "/notes",
    icon: <BarChart2 className="h-4 w-4 text-orange-500"/>,
    short: "Enter",
    end: "⌘K",
    href: "/notes",
  },
  {
    id: "go-signin",
    label: "Go to Sign In",
    description: "/sign-in",
    icon: <PlaneTakeoff className="h-4 w-4 text-red-500" />,
    short: "Enter",
    end: "⌘K",
    href: "/sign-in",
  },
  {
    id: "1",
    label: "Book tickets",
    icon: <PlaneTakeoff className="h-4 w-4 text-green-500" />,
    description: "Operator",
    short: "⌘K",
    end: "Agent",
  },
  {
    id: "2",
    label: "Question",
    icon: <HelpCircle className="h-4 w-4 text-blue-500" />,
    description: "gpt-4o",
    short: "⌘cmd+p",
    end: "Command",
    run: () => {
      // Filled at runtime by ActionSearchBar via effectiveActions mapping if needed
    },
  },
  {
    id: "3",
    label: "Screen Studio",
    icon: <Video className="h-4 w-4 text-purple-500" />,
    description: "gpt-4o",
    short: "",
    end: "Application",
  },
  {
    id: "4",
    label: "Talk to Jarvis",
    icon: <AudioLines className="h-4 w-4 text-green-500" />,
    description: "gpt-4o voice",
    short: "",
    end: "Active",
  },
  {
    id: "5",
    label: "Translate",
    icon: <Globe className="h-4 w-4 text-blue-500" />,
    description: "gpt-4o",
    short: "",
    end: "Command",
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
  },
]

function ActionSearchBar({ actions = allActions }: { actions?: Action[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<SearchResult | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)
  const debouncedQuery = useDebounce(query, 200)
  const router = useRouter()
  const [showAll, setShowAll] = useState(false)
  const pathname = usePathname()
  const { openDialog } = useNoteDialogStore()
  const startEditCurrentNote = useNoteContextStore((s) => s.startEditCurrentNote)
  const currentNoteId = useNoteContextStore((s) => s.currentNoteId)
  const deleteNoteById = useNoteContextStore((s) => s.deleteNoteById)
  const openSelectNoteDialog = useNoteContextStore((s) => s.openSelectNoteDialog)
  const [copied, setCopied] = useState(false)
  const setEnvironment = useEnvironmentStore((s) => s.setEnvironment)
  const [mounted, setMounted] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  // Image generation state
  const [imgLoading, setImgLoading] = useState(false)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgError, setImgError] = useState<string | null>(null)
  const [imgCopied, setImgCopied] = useState(false)
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

  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Build actions for current route (e.g., show Create Note on /notes)
  function computeEffectiveActions(): Action[] {
    let base = [...actions]
    if (pathname && pathname.startsWith("/notes")) {
      const prepend: Action[] = [
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
        },
        {
          id: "create-note",
          label: "Create note",
          description: "Open create note dialog",
          icon: <PlusCircle className="h-4 w-4" />,
          short: "Enter",
          end: "⌘K",
          run: () => openDialog(),
        },
      ]
      base = [...prepend, ...base]
    }
    // Enhance the "Question" action to prime the input with '? '
    base = base.map(a => a.id === "2"
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

    if (!debouncedQuery) {
      setResult({ actions: showAll ? eff : eff.slice(0, 8) })
      return
    }

    const normalizedQuery = debouncedQuery.toLowerCase().trim()
    const filteredActions = eff.filter((action) => {
      const searchableText = [action.label, action.description, action.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return searchableText.includes(normalizedQuery)
    })

    // If nothing matches, prefer showing navigation quick links so the user always has something to do
    const navActions = eff.filter((a) => !!a.href)
    setResult({ actions: filteredActions.length > 0 ? filteredActions : navActions })
  }, [debouncedQuery, isFocused, open, showAll, pathname])

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
      // close and reset
      setOpen(false)
      setQuery("")
      setResult(null)
      setSelectedAction(null)
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
      <div className="relative flex flex-col justify-start items-center">
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
                  {result.actions.map((action) => (
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
                          <span className="text-gray-700 dark:text-gray-300">{action.icon}</span>
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
                {/* Show more when query empty and limited list is shown */}
                {!debouncedQuery && !showAll && computeEffectiveActions().length > 8 && (
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
                <div className="mt-2 px-3 py-2 border-t border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900">
                  <div className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-400">
                    <span>Press ⌘K to open commands</span>
                    <span>ESC to cancel</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )

  if (!mounted) return null
  const portalTarget = typeof document !== 'undefined' ? document.body : null
  if (!portalTarget) return null

  return createPortal(
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
  )
}

export default ActionSearchBar
