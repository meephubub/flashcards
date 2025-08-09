"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Send, BarChart2, Globe, Video, PlaneTakeoff, AudioLines, PlusCircle, Trash2, Copy, Check } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import useDebounce from "@/hooks/use-debounce"
import { useNoteDialogStore } from "@/hooks/use-note-dialog"
import { useNoteContextStore } from "@/hooks/use-note-context"
import { useEnvironmentStore } from "@/hooks/use-environment"

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
    label: "Summarize",
    icon: <BarChart2 className="h-4 w-4 text-orange-500" />,
    description: "gpt-4o",
    short: "⌘cmd+p",
    end: "Command",
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
    setQuery(e.target.value)
    setIsTyping(true)
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
            <Input
              type="text"
              placeholder="What's up?"
              value={query}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              id="action-search-input"
              className="pl-3 pr-9 py-1.5 h-10 text-sm rounded-lg focus-visible:ring-offset-0 bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
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
                  } else {
                    const target = selectedAction ?? result?.actions?.[0]
                    if (target) runAction(target)
                  }
                }
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4">
              <AnimatePresence mode="popLayout">
                {query.length > 0 ? (
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
