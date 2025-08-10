"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Send, BarChart2, Globe, Video, PlaneTakeoff, AudioLines, PlusCircle, Trash2, Copy, Check, HelpCircle, X } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import useDebounce from "@/hooks/use-debounce"
import { useNoteDialogStore } from "@/hooks/use-note-dialog"
import { useNoteContextStore } from "@/hooks/use-note-context"
import { useEnvironmentStore } from "@/hooks/use-environment"
import { makeGroqRequest } from "@/lib/groq"

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
  const currentNoteId = useNoteContextStore((s) => s.currentNoteId)
  const deleteNoteById = useNoteContextStore((s) => s.deleteNoteById)
  const openSelectNoteDialog = useNoteContextStore((s) => s.openSelectNoteDialog)
  const [copied, setCopied] = useState(false)
  const setEnvironment = useEnvironmentStore((s) => s.setEnvironment)
  const [mounted, setMounted] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

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
  const effectiveActions = ((): Action[] => {
    let base = [...actions]
    if (pathname && pathname.startsWith("/notes")) {
      const prepend: Action[] = [
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
  })()

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
        setResult({ actions: effectiveActions.slice(0, 8) })
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
    if (!isFocused && !open) {
      setResult(null)
      return
    }

    if (!debouncedQuery) {
      setResult({ actions: showAll ? effectiveActions : effectiveActions.slice(0, 8) })
      return
    }

    const normalizedQuery = debouncedQuery.toLowerCase().trim()
    const filteredActions = effectiveActions.filter((action) => {
      const searchableText = [action.label, action.description, action.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return searchableText.includes(normalizedQuery)
    })

    // If nothing matches, prefer showing navigation quick links so the user always has something to do
    const navActions = effectiveActions.filter((a) => !!a.href)
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
                  if (isCalc) {
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
                {!debouncedQuery && !showAll && effectiveActions.length > 8 && (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-t border-black/5 dark:border-white/10"
                    onClick={() => {
                      setShowAll(true)
                      setResult({ actions: effectiveActions })
                    }}
                  >
                    Show more ({effectiveActions.length - 8} more)
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
