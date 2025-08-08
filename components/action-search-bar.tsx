"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Send, BarChart2, Globe, Video, PlaneTakeoff, AudioLines } from "lucide-react"
import { useRouter } from "next/navigation"
import useDebounce from "@/hooks/use-debounce"

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

const allActions: Action[] = [
  // Navigation
  {
    id: "go-home",
    label: "Go to Home",
    description: "/",
    icon: <Globe className="h-4 w-4" text-blue-500/>,
    short: "Enter",
    end: "⌘K",
    href: "/",
  },
  {
    id: "go-notes",
    label: "Go to Notes",
    description: "/notes",
    icon: <BarChart2 className="h-4 w-4" text-orange-500/>,
    short: "Enter",
    end: "⌘K",
    href: "/notes",
  },
  {
    id: "go-signin",
    label: "Go to Sign In",
    description: "/sign-in",
    icon: <PlaneTakeoff className="h-4 w-4" text-red-500/>,
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
        setResult({ actions: allActions.slice(0, 8) })
        // focus input after open
        setTimeout(() => {
          const el = document.getElementById("action-search-input") as HTMLInputElement | null
          el?.focus()
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
      setResult({ actions: showAll ? allActions : allActions.slice(0, 8) })
      return
    }

    const normalizedQuery = debouncedQuery.toLowerCase().trim()
    const filteredActions = allActions.filter((action) => {
      const searchableText = [action.label, action.description, action.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return searchableText.includes(normalizedQuery)
    })

    // If nothing matches, prefer showing navigation quick links so the user always has something to do
    const navActions = allActions.filter((a) => !!a.href)
    setResult({ actions: filteredActions.length > 0 ? filteredActions : navActions })
  }, [debouncedQuery, isFocused, open, showAll])

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
    <div
      className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden bg-white/95 dark:bg-neutral-900/90 backdrop-blur-lg border border-black/5 dark:border-white/10 shadow-2xl text-gray-900 dark:text-gray-50"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
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
                  const target = selectedAction ?? result?.actions?.[0]
                  if (target) runAction(target)
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
                {!debouncedQuery && !showAll && allActions.length > 8 && (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-t border-black/5 dark:border-white/10"
                    onClick={() => {
                      setShowAll(true)
                      setResult({ actions: allActions })
                    }}
                  >
                    Show more ({allActions.length - 8} more)
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
    </div>
  )

  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      {content}
    </div>,
    document.body
  )
}

export default ActionSearchBar
