"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  Home,
  Library,
  Play,
  BarChart2,
  Plus,
  Search,
  X,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Trash2,
  Edit,
  FileText,
} from "lucide-react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname, useRouter } from "next/navigation"
import { useDecks, Deck } from "@/context/deck-context"
import { Card, Note } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/client"
import { useNoteContextStore } from "@/hooks/use-note-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// ─── Types ────────────────────────────────────────────────────────────────────

type Item = {
  id: string
  label: string
  icon: React.ReactNode
  section: string
  href?: string
  run?: () => void
  metadata?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupItems(items: Item[]): Record<string, Item[]> {
  return items.reduce<Record<string, Item[]>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {})
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Kbd({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center rounded border border-border bg-background text-[10px] text-muted-foreground shadow-sm select-none ${wide ? "px-2 py-0.5" : "w-5 h-5"
        }`}
    >
      {children}
    </kbd>
  )
}

// ─── Animations ──────────────────────────────────────────────────────────────

const pageVariants = {
  initial: (direction: number) => ({
    x: direction > 0 ? 20 : -20,
    opacity: 0,
    scale: 0.98,
  }),
  animate: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: [0.23, 1, 0.32, 1],
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -20 : 20,
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.15,
      ease: [0.23, 1, 0.32, 1],
    },
  }),
}

// ─── Deck expanded view ───────────────────────────────────────────────────────

function DeckView({
  deck,
  onBack,
  onClose,
}: {
  deck: Deck
  onBack: () => void
  onClose: () => void
}) {
  const [activeCardIdx, setActiveCardIdx] = useState(0)
  const [cardQuery, setCardQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const filteredCards = cardQuery.trim()
    ? (deck.cards || []).filter((c) =>
      c.front.toLowerCase().includes(cardQuery.toLowerCase()) ||
      c.back.toLowerCase().includes(cardQuery.toLowerCase())
    )
    : (deck.cards || [])

  const activeCard = filteredCards[activeCardIdx] ?? null

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveCardIdx(0)
  }, [cardQuery])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveCardIdx((prev) => Math.min(prev + 1, filteredCards.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveCardIdx((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Escape") {
        onBack()
      } else if (e.key === "Enter") {
        if (activeCard) {
          router.push(`/deck/${deck.id}`) // Navigate to deck on enter? Or card edit?
          onClose()
        }
      }
    },
    [filteredCards.length, onBack, activeCard, deck.id, router, onClose]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="w-[780px] max-w-[95vw] flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Search size={16} className="text-muted-foreground shrink-0" strokeWidth={1.5} />
        {/* Deck badge */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted border border-border text-xs text-foreground shrink-0">
          <span className="text-muted-foreground font-medium">Deck:</span>
          <span className="font-semibold">{deck.name}</span>
          <button
            onClick={onBack}
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={11} strokeWidth={2} />
          </button>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={cardQuery}
          onChange={(e) => setCardQuery(e.target.value)}
          placeholder="Search cards..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        <Kbd wide>esc</Kbd>
      </div>

      {/* Body: two-panel */}
      <div className="flex flex-1 min-h-0 h-[480px]">
        {/* Left: card list */}
        <div className="w-[260px] border-r border-border flex flex-col shrink-0">
          {/* Sort toolbar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <button className="flex items-center gap-1 text-xs text-foreground border border-border rounded-md px-2 py-1 hover:bg-muted transition-colors">
              Sort: Created
              <ChevronDown size={11} strokeWidth={2} className="text-muted-foreground" />
            </button>
            <span className="ml-auto text-xs text-muted-foreground">{filteredCards.length} cards</span>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto py-1">
            {filteredCards.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No cards found.</p>
            ) : (
              filteredCards.map((card, idx) => (
                <div
                  key={card.id}
                  onMouseEnter={() => setActiveCardIdx(idx)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors cursor-default group ${idx === activeCardIdx
                    ? "bg-muted text-foreground"
                    : "text-foreground/80 hover:bg-muted/50"
                    }`}
                >
                  <span className="truncate pr-2" onClick={() => setActiveCardIdx(idx)}>{card.front}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5 rounded">
                        <MoreHorizontal size={14} strokeWidth={1.75} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/deck/${deck.id}/card/${card.id}/edit`);
                          onClose();
                        }}
                        className="gap-2 cursor-pointer"
                      >
                        <Edit size={14} />
                        <span>Edit</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm("Are you sure you want to delete this card?")) {
                            try {
                              await deleteCard(deck.id, card.id);
                              // Note: The UI will update automatically because decks context changes
                            } catch (err) {
                              console.error("Failed to delete card", err);
                            }
                          }
                        }}
                        className="gap-2 cursor-pointer text-red-500 focus:text-red-500"
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: card preview */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeCard ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Front</span>
                <h2 className="text-lg font-medium text-foreground">{activeCard.front}</h2>
              </div>
              <hr className="border-border" />
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Back</span>
                <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {activeCard.back}
                </div>
              </div>
              {activeCard.front_img_url && (
                <div className="mt-4 rounded-lg overflow-hidden border border-border">
                  <img src={activeCard.front_img_url} alt="Card front" className="max-w-full h-auto" />
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Select a card to preview
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-border bg-muted/40">
        <div className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span className="text-xs text-muted-foreground">Navigate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Kbd>↵</Kbd>
          <span className="text-xs text-muted-foreground">Go to Deck</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Kbd>⌫</Kbd>
          <span className="text-xs text-muted-foreground">Back</span>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => { router.push(`/deck/${deck.id}`); onClose(); }}
            className="flex items-center gap-1.5 text-xs font-medium border border-border rounded-lg px-3 py-1.5 bg-background hover:bg-muted transition-colors text-foreground"
          >
            <Play size={13} strokeWidth={2} />
            Study Deck
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Deck picker (shown after typing "deck:") ─────────────────────────────────

function DeckPicker({
  query,
  decks,
  onSelect,
}: {
  query: string
  decks: Deck[]
  onSelect: (deck: Deck) => void
}) {
  const [activeIdx, setActiveIdx] = useState(0)

  const filtered = query.trim()
    ? decks.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
    : decks

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIdx((prev) => Math.min(prev + 1, filtered.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIdx((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter") {
        if (filtered[activeIdx]) onSelect(filtered[activeIdx])
      }
    },
    [filtered, activeIdx, onSelect]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="py-2 max-h-[420px] overflow-y-auto">
      <p className="px-5 pt-3 pb-1.5 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground select-none">
        SELECT DECK
      </p>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No decks found.</p>
      ) : (
        filtered.map((deck, idx) => (
          <button
            key={deck.id}
            onClick={() => onSelect(deck)}
            onMouseEnter={() => setActiveIdx(idx)}
            className={`w-full flex items-center justify-between px-5 py-3 text-sm text-left transition-colors cursor-default ${idx === activeIdx
              ? "bg-muted text-foreground"
              : "text-foreground/80 hover:bg-muted/60"
              }`}
          >
            <div className="flex items-center gap-3.5">
              <Library
                size={16}
                strokeWidth={1.5}
                className={idx === activeIdx ? "text-foreground" : "text-muted-foreground"}
              />
              <span>{deck.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">{(deck.cards || []).length} cards</span>
          </button>
        ))
      )}
    </div>
  )
}

// ─── Note explorer (shown after typing "notes:") ───────────────────────────────

function NoteExplorer({
  query,
  notes,
  onSelect,
  onBack,
  onClose,
}: {
  query: string
  notes: Note[]
  onSelect: (note: Note) => void
  onBack: () => void
  onClose: () => void
}) {
  const [activeNoteIdx, setActiveNoteIdx] = useState(0)
  const [searchQuery, setSearchQuery] = useState(query)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const filtered = searchQuery.trim()
    ? notes.filter((n) =>
      (n.title || "Untitled").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.content || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
    : notes

  const activeNote = filtered[activeNoteIdx] ?? null

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveNoteIdx(0)
  }, [searchQuery])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveNoteIdx((prev) => Math.min(prev + 1, filtered.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveNoteIdx((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Escape") {
        onBack()
      } else if (e.key === "Enter") {
        if (activeNote) {
          onSelect(activeNote)
        }
      }
    },
    [filtered.length, onBack, activeNote, onSelect]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="w-[780px] max-w-[95vw] flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Search size={16} className="text-muted-foreground shrink-0" strokeWidth={1.5} />
        {/* Notes badge */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted border border-border text-xs text-foreground shrink-0">
          <span className="text-muted-foreground font-medium">Search:</span>
          <span className="font-semibold">Notes</span>
          <button
            onClick={onBack}
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={11} strokeWidth={2} />
          </button>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes content..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        <Kbd wide>esc</Kbd>
      </div>

      {/* Body: two-panel */}
      <div className="flex flex-1 min-h-0 h-[480px]">
        {/* Left: note list */}
        <div className="w-[260px] border-r border-border flex flex-col shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <span className="text-xs text-muted-foreground">{filtered.length} notes</span>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No notes found.</p>
            ) : (
              filtered.map((note, idx) => (
                <div
                  key={note.id}
                  onMouseEnter={() => setActiveNoteIdx(idx)}
                  onClick={() => onSelect(note)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors cursor-default group ${idx === activeNoteIdx
                    ? "bg-muted text-foreground"
                    : "text-foreground/80 hover:bg-muted/50"
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={14} className="shrink-0 text-muted-foreground" />
                    <span className="truncate pr-2">{note.title || "Untitled"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: note preview */}
        <div className="flex-1 overflow-y-auto p-8 bg-muted/5">
          {activeNote ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <h2 className="text-xl font-semibold mb-4 text-foreground">{activeNote.title || "Untitled"}</h2>
              <div className="text-sm text-foreground/80 leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activeNote.content || "_No content_"}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Select a note to preview
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-border bg-muted/40">
        <div className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span className="text-xs text-muted-foreground">Navigate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Kbd>↵</Kbd>
          <span className="text-xs text-muted-foreground">Open Note</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Mode = "default" | "deck-pick" | "deck-view" | "note-pick"

export function DecksActionSearchBar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { decks, deleteCard } = useDecks()
  const setCurrentNoteId = useNoteContextStore((s) => s.setCurrentNoteId)
  const isIncluded = pathname === "/" || pathname === "/home" || pathname?.startsWith("/deck") || pathname === "/notes"

  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [mode, setMode] = useState<Mode>("default")
  const [direction, setDirection] = useState(1) // 1 for forward, -1 for back
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch notes
  useEffect(() => {
    if (!open) return

    const fetchNotes = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (data) setNotes(data)
    }

    fetchNotes()
  }, [open, supabase])

  // Global hotkeys
  useEffect(() => {
    if (!isIncluded) return

    const onKey = (e: KeyboardEvent) => {
      const isOpenCombo = (e.ctrlKey || e.metaKey) && (e.key === "K" || e.key === "k" || e.key === "L" || e.key === "l")
      if (isOpenCombo) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
        return
      }
      if (e.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [isIncluded])

  // Allow external triggers (like MobilePaletteButton)
  useEffect(() => {
    if (!isIncluded) return

    const handler = () => {
      setOpen(true)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
    window.addEventListener('open-action-search', handler as EventListener)
    return () => window.removeEventListener('open-action-search', handler as EventListener)
  }, [isIncluded])

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setQuery("")
      setMode("default")
      setSelectedDeck(null)
    }
  }, [open])

  // Parse deck: prefix
  const isDeckPrefix = query.toLowerCase().startsWith("deck:")
  const deckQuery = isDeckPrefix ? query.slice(5).trimStart() : ""

  // Parse notes: prefix
  const isNotePrefix = query.toLowerCase().startsWith("notes:")
  const noteQuery = isNotePrefix ? query.slice(6).trimStart() : ""

  const effectiveMode: Mode = isDeckPrefix ? "deck-pick" : isNotePrefix ? "note-pick" : mode === "deck-view" ? "deck-view" : "default"

  // ── Action Items ──
  const staticItems: Item[] = [
    { id: "home", label: "Home", icon: <Home size={16} strokeWidth={1.5} />, section: "GO TO", href: "/home" },
    { id: "decks", label: "Decks", icon: <Library size={16} strokeWidth={1.5} />, section: "GO TO", href: "/deck" },
    { id: "notes", label: "Notes", icon: <FileText size={16} strokeWidth={1.5} />, section: "GO TO", href: "/notes" },
    { id: "review", label: "Review All", icon: <Play size={16} strokeWidth={1.5} />, section: "GO TO", href: "/study/all-due" },
    { id: "statistics", label: "Statistics", icon: <BarChart2 size={16} strokeWidth={1.5} />, section: "GO TO", href: "/study/stats" },
    { id: "create-card", label: "New Card", icon: <Plus size={16} strokeWidth={1.5} />, section: "CREATE", run: () => { /* Handle create card global? */ } },
  ]

  // Add decks to the searchable items
  const dynamicItems: Item[] = decks.map(d => ({
    id: `deck-${d.id}`,
    label: d.name,
    icon: <Library size={16} strokeWidth={1.5} />,
    section: "DECKS",
    run: () => handleDeckSelect(d)
  }))

  const noteItems: Item[] = notes.map(n => ({
    id: `note-${n.id}`,
    label: n.title || "Untitled",
    icon: <FileText size={16} strokeWidth={1.5} />,
    section: "NOTES",
    run: () => {
      setCurrentNoteId(n.id)
      router.push(`/notes?noteId=${n.id}`)
      setOpen(false)
    }
  }))

  const allSearchable = [...staticItems, ...dynamicItems, ...noteItems]

  const filtered = query.trim() && !isDeckPrefix && !isNotePrefix
    ? allSearchable.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase())
    )
    : allSearchable

  const grouped = groupItems(filtered)
  const flatList = filtered

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (effectiveMode !== "default") return
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, flatList.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter") {
        const item = flatList[activeIndex]
        if (item) {
          if (item.run) item.run()
          else if (item.href) {
            router.push(item.href)
            setOpen(false)
          }
        }
      }
    },
    [flatList, activeIndex, effectiveMode, router]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const handleDeckSelect = (deck: Deck) => {
    setDirection(1)
    setSelectedDeck(deck)
    setMode("deck-view")
    setQuery("")
  }

  const handleBack = () => {
    setDirection(-1)
    setMode("default")
    setSelectedDeck(null)
    setQuery("deck:")
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleNoteSelect = (note: Note) => {
    setCurrentNoteId(note.id)
    router.push(`/notes?noteId=${note.id}`)
    setOpen(false)
  }

  // ── Render ──
  if (!mounted || !isIncluded) return null

  const renderContent = () => {
    return (
      <motion.div
        layout
        initial={false}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="rounded-xl border border-border bg-background shadow-lg overflow-hidden font-sans"
      >
        <AnimatePresence mode="wait" custom={direction}>
          {effectiveMode === "deck-view" && selectedDeck ? (
            <motion.div
              key="deck-view"
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <DeckView deck={selectedDeck} onBack={handleBack} onClose={() => setOpen(false)} />
            </motion.div>
          ) : effectiveMode === "note-pick" ? (
            <motion.div
              key="note-view"
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <NoteExplorer query={noteQuery} notes={notes} onSelect={handleNoteSelect} onBack={handleBack} onClose={() => setOpen(false)} />
            </motion.div>
          ) : (
            <motion.div
              key="picker"
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-[600px] max-w-[95vw]"
            >
              {/* Search input row */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <Search size={16} className="text-muted-foreground shrink-0" strokeWidth={1.5} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search decks, cards, or actions..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isDeckPrefix && !isNotePrefix && (
                    <>
                      <button
                        onClick={() => setQuery("deck:")}
                        className="inline-flex items-center px-2 py-0.5 rounded-full border border-border text-[11px] text-muted-foreground bg-muted font-sans cursor-pointer hover:bg-muted/80 transition-colors select-none"
                      >
                        deck:
                      </button>
                      <button
                        onClick={() => setQuery("notes:")}
                        className="inline-flex items-center px-2 py-0.5 rounded-full border border-border text-[11px] text-muted-foreground bg-muted font-sans cursor-pointer hover:bg-muted/80 transition-colors select-none"
                      >
                        notes:
                      </button>
                      <kbd className="inline-flex items-center px-2 py-0.5 rounded-full border border-border text-[11px] text-muted-foreground bg-muted font-sans cursor-default select-none">
                        tag:
                      </kbd>
                    </>
                  )}
                  <kbd className="inline-flex items-center px-2 py-0.5 rounded-full border border-border text-[11px] text-muted-foreground bg-muted font-sans cursor-default select-none">
                    esc
                  </kbd>
                </div>
              </div>

              {/* Results area */}
              {effectiveMode === "deck-pick" ? (
                <DeckPicker query={deckQuery} decks={decks} onSelect={handleDeckSelect} />
              ) : effectiveMode === "note-pick" ? (
                <NotePicker query={noteQuery} notes={notes} onSelect={handleNoteSelect} />
              ) : (
                <div className="py-2 max-h-[420px] overflow-y-auto">
                  {Object.keys(grouped).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No results found.</p>
                  ) : (
                    Object.entries(grouped).map(([section, items]) => (
                      <div key={section}>
                        <p className="px-5 pt-3 pb-1.5 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground select-none">
                          {section}
                        </p>
                        {items.map((item) => {
                          const globalIdx = flatList.findIndex((f) => f.id === item.id)
                          const isActive = globalIdx === activeIndex
                          return (
                            <button
                              key={item.id}
                              onMouseEnter={() => setActiveIndex(globalIdx)}
                              onClick={() => {
                                if (item.run) item.run()
                                else if (item.href) {
                                  router.push(item.href)
                                  setOpen(false)
                                }
                              }}
                              className={`w-full flex items-center gap-3.5 px-5 py-3 text-sm text-left transition-colors cursor-default ${isActive
                                ? "bg-muted text-foreground"
                                : "text-foreground/80 hover:bg-muted/60"
                                }`}
                            >
                              <span className={`${isActive ? "text-foreground" : "text-muted-foreground"} transition-colors`}>
                                {item.icon}
                              </span>
                              <span>{item.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Footer shortcuts */}
              <div className="flex items-center gap-4 px-5 py-3 border-t border-border bg-muted/40">
                <div className="flex items-center gap-1.5">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  <span className="text-xs text-muted-foreground">Navigate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Kbd>↵</Kbd>
                  <span className="text-xs text-muted-foreground">Open</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            {renderContent()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
