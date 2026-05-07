"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Home,
  Library,
  Play,
  BarChart2,
  Plus,
  Search,
  X,
  MoreHorizontal,
  ChevronDown,
  Trash2,
  Edit,
  FileText,
  Upload,
  Tag,
  Lightbulb,
  LightbulbOff,
} from "lucide-react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useDecks, Deck } from "@/context/deck-context";
import { useAuth } from "@/context/auth-context";
import { Card, Note } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";
import { useNoteContextStore } from "@/hooks/use-note-context";
import { useNoteDialogStore } from "@/hooks/use-note-dialog";
import { getUniqueTags, parseTags } from "@/lib/text-utils";
import { 
  getCardsByTag, 
  getCardsByMultipleTags, 
  getCardsByMultipleDecks, 
  getDueCardsByMultipleTags, 
  getDueCardsByMultipleDecks, 
  getAllUniqueTags 
} from "@/lib/data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { parseAnkiApkg } from "@/lib/anki-parser";
import { MarkdownCardContent } from "@/components/markdown-card-content";
import { ImportMarkdownDialog } from "@/components/import-markdown-dialog";
import { MultiTagStudy } from "./multi-tag-study";
import { MultiDeckStudy } from "./multi-deck-study";

const ADMIN_LOGIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_LOGIN_EMAIL || "";

// ─── Types ────────────────────────────────────────────────────────────────────

type Item = {
  id: string;
  label: string;
  icon: React.ReactNode;
  section: string;
  href?: string;
  run?: () => void;
  metadata?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupItems(items: Item[]): Record<string, Item[]> {
  return items.reduce<Record<string, Item[]>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Kbd({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <kbd
      className={`inline-flex items-center justify-center rounded border border-border bg-background text-[10px] text-muted-foreground shadow-sm select-none ${
        wide ? "px-2 py-0.5" : "w-5 h-5"
      }`}
    >
      {children}
    </kbd>
  );
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
};

// ─── Deck expanded view ───────────────────────────────────────────────────────

function DeckView({
  deck,
  onBack,
  onClose,
}: {
  deck: Deck;
  onBack: () => void;
  onClose: () => void;
}) {
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [cardQuery, setCardQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filteredCards = (deck.cards || []).filter((c) => {
    const matchesQuery = !cardQuery.trim() || 
      c.front.toLowerCase().includes(cardQuery.toLowerCase()) ||
      c.back.toLowerCase().includes(cardQuery.toLowerCase());
    
    const matchesTag = !selectedTag || (c.tag && c.tag.includes(selectedTag));
    
    return matchesQuery && matchesTag;
  });

  const uniqueTags = useMemo(() => getUniqueTags(deck.cards || []), [deck.cards]);

  const activeCard = filteredCards[activeCardIdx] ?? null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveCardIdx(0);
  }, [cardQuery]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveCardIdx((prev) =>
          Math.min(prev + 1, filteredCards.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveCardIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Escape") {
        onBack();
      } else if (e.key === "Enter") {
        if (activeCard) {
          router.push(`/deck/${deck.id}`); // Navigate to deck on enter? Or card edit?
          onClose();
        }
      }
    },
    [filteredCards.length, onBack, activeCard, deck.id, router, onClose],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="w-[780px] max-w-[95vw] flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Search
          size={16}
          className="text-muted-foreground shrink-0"
          strokeWidth={1.5}
        />
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
          {/* Tags */}
          {uniqueTags.length > 0 && (
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto no-scrollbar shrink-0">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors shrink-0 ${
                  !selectedTag
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                All
              </button>
              {uniqueTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors shrink-0 ${
                    tag === selectedTag
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Sort toolbar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <button className="flex items-center gap-1 text-xs text-foreground border border-border rounded-md px-2 py-1 hover:bg-muted transition-colors">
              Sort: Created
              <ChevronDown
                size={11}
                strokeWidth={2}
                className="text-muted-foreground"
              />
            </button>
            <span className="ml-auto text-xs text-muted-foreground">
              {filteredCards.length} cards
            </span>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto py-1">
            {filteredCards.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No cards found.
              </p>
            ) : (
              filteredCards.map((card, idx) => (
                <div
                  key={card.id}
                  onMouseEnter={() => setActiveCardIdx(idx)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors cursor-default group ${
                    idx === activeCardIdx
                      ? "bg-muted text-foreground"
                      : "text-foreground/80 hover:bg-muted/50"
                  }`}
                >
                  <span
                    className="truncate pr-2"
                    onClick={() => setActiveCardIdx(idx)}
                  >
                    {card.front}
                  </span>
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
                          if (
                            window.confirm(
                              "Are you sure you want to delete this card?",
                            )
                          ) {
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Front
                </span>
                <MarkdownCardContent
                  content={activeCard.front}
                  className="text-lg font-medium text-foreground"
                />
              </div>
              <hr className="border-border" />
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Back
                </span>
                <MarkdownCardContent
                  content={activeCard.back}
                  className="text-sm text-foreground/80 leading-relaxed"
                />
              </div>
              {activeCard.front_img_url && (
                <div className="mt-4 rounded-lg overflow-hidden border border-border">
                  <img
                    src={activeCard.front_img_url}
                    alt="Card front"
                    className="max-w-full h-auto"
                  />
                </div>
              )}
              {activeCard.tag && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {parseTags(activeCard.tag).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground border border-border"
                    >
                      {t}
                    </span>
                  ))}
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
            onClick={() => {
              router.push(`/deck/${deck.id}`);
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs font-medium border border-border rounded-lg px-3 py-1.5 bg-background hover:bg-muted transition-colors text-foreground"
          >
            <Play size={13} strokeWidth={2} />
            Study Deck
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Deck picker (shown after typing "deck:") ─────────────────────────────────

function DeckPicker({
  query,
  decks,
  onSelect,
}: {
  query: string;
  decks: Deck[];
  onSelect: (deck: Deck) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = query.trim()
    ? decks.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
    : decks;

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        if (filtered[activeIdx]) onSelect(filtered[activeIdx]);
      }
    },
    [filtered, activeIdx, onSelect],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="py-2 max-h-[420px] overflow-y-auto">
      <p className="px-5 pt-3 pb-1.5 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground select-none">
        SELECT DECK
      </p>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No decks found.
        </p>
      ) : (
        filtered.map((deck, idx) => (
          <button
            key={deck.id}
            onClick={() => onSelect(deck)}
            onMouseEnter={() => setActiveIdx(idx)}
            className={`w-full flex items-center justify-between px-5 py-3 text-sm text-left transition-colors cursor-default ${
              idx === activeIdx
                ? "bg-muted text-foreground"
                : "text-foreground/80 hover:bg-muted/60"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Library
                size={16}
                strokeWidth={1.5}
                className={
                  idx === activeIdx
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              />
              <span>{deck.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {(deck.cards || []).length} cards
            </span>
          </button>
        ))
      )}
    </div>
  );
}

// ─── Note explorer (shown after typing "notes:") ───────────────────────────────

function NoteExplorer({
  query,
  notes,
  onSelect,
  onBack,
  onClose,
  onDeleteNote,
}: {
  query: string;
  notes: Note[];
  onSelect: (note: Note) => void;
  onBack: () => void;
  onClose: () => void;
  onDeleteNote: (id: string) => Promise<void>;
}) {
  const [activeNoteIdx, setActiveNoteIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const openDialog = useNoteDialogStore((s) => s.openDialog);

  const filtered = searchQuery.trim()
    ? notes.filter(
        (n) =>
          (n.title || "Untitled")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (n.content || "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : notes;

  const activeNote = filtered[activeNoteIdx] ?? null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveNoteIdx(0);
  }, [searchQuery]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveNoteIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveNoteIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Escape") {
        onBack();
      } else if (e.key === "Enter") {
        if (activeNote) {
          onSelect(activeNote);
        }
      }
    },
    [filtered.length, onBack, activeNote, onSelect],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="w-[780px] max-w-[95vw] flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Search
          size={16}
          className="text-muted-foreground shrink-0"
          strokeWidth={1.5}
        />
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
        <button
          onClick={() => {
            router.push("/notes");
            openDialog();
            onClose();
          }}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="New Note"
        >
          <Plus size={16} strokeWidth={2} />
        </button>
        <Kbd wide>esc</Kbd>
      </div>

      {/* Body: two-panel */}
      <div className="flex flex-1 min-h-0 h-[480px]">
        {/* Left: note list */}
        <div className="w-[260px] border-r border-border flex flex-col shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <span className="text-xs text-muted-foreground">
              {filtered.length} notes
            </span>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No notes found.
              </p>
            ) : (
              filtered.map((note, idx) => (
                <div
                  key={note.id}
                  onMouseEnter={() => setActiveNoteIdx(idx)}
                  onClick={() => onSelect(note)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors cursor-default group ${
                    idx === activeNoteIdx
                      ? "bg-muted text-foreground"
                      : "text-foreground/80 hover:bg-muted/50"
                  }`}
                >
                  <div
                    className="flex items-center gap-3 min-w-0 flex-1"
                    onClick={() => onSelect(note)}
                  >
                    <FileText
                      size={14}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span className="truncate pr-2">
                      {note.title || "Untitled"}
                    </span>
                  </div>

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
                          router.push(`/notes?noteId=${note.id}`);
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
                          if (
                            window.confirm(
                              "Are you sure you want to delete this note?",
                            )
                          ) {
                            try {
                              await onDeleteNote(note.id);
                            } catch (err) {
                              console.error("Failed to delete note", err);
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

        {/* Right: note preview */}
        <div className="flex-1 overflow-y-auto p-8 bg-muted/5">
          {activeNote ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <h2 className="text-xl font-semibold mb-4 text-foreground">
                {activeNote.title || "Untitled"}
              </h2>
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
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Mode = "default" | "deck-pick" | "deck-view" | "note-pick" | "tag-view" | "multi-deck-study" | "multi-tag-study" | "login";

export function DecksActionSearchBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { decks, deleteCard, addDeck, addCard } = useDecks();
  const setCurrentNoteId = useNoteContextStore((s) => s.setCurrentNoteId);
  const isIncluded =
    pathname === "/" ||
    pathname === "/home" ||
    pathname?.startsWith("/deck") ||
    pathname === "/notes" ||
    pathname === "/study/all-due";

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("default");
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for back
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDecks, setSelectedDecks] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);
  const [isImportMarkdownOpen, setIsImportMarkdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const openDialog = useNoteDialogStore((s) => s.openDialog);

  // Login state (hidden functionality)
  const { signIn } = useAuth();
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch notes and tags
  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch notes
      const { data: notesData } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (notesData) setNotes(notesData);

      // Fetch all unique tags
      const tags = await getAllUniqueTags(supabase);
      setAllTags(tags);
    };

    fetchData();
  }, [open, supabase]);

  const deleteNote = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [supabase],
  );

  // Global hotkeys
  useEffect(() => {
    if (!isIncluded) return;

    const onKey = (e: KeyboardEvent) => {
      const isOpenCombo =
        (e.ctrlKey || e.metaKey) &&
        (e.key === "K" || e.key === "k" || e.key === "L" || e.key === "l");
      if (isOpenCombo) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isIncluded]);

  // Allow external triggers (like MobilePaletteButton)
  useEffect(() => {
    if (!isIncluded) return;

    const handler = () => {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    };
    window.addEventListener("open-action-search", handler as EventListener);
    return () =>
      window.removeEventListener(
        "open-action-search",
        handler as EventListener,
      );
  }, [isIncluded]);

  // Listen for import markdown event
  useEffect(() => {
    if (!isIncluded) return;

    const handler = () => setIsImportMarkdownOpen(true);
    window.addEventListener("open-import-markdown", handler as EventListener);
    return () =>
      window.removeEventListener("open-import-markdown", handler as EventListener);
  }, [isIncluded]);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setQuery("");
      setMode("default");
      setSelectedDeck(null);
      setSelectedTags([]);
      setSelectedDecks([]);
    }
  }, [open]);

  // Parse deck: prefix
  const isDeckPrefix = query.toLowerCase().startsWith("deck:");
  const deckQuery = isDeckPrefix ? query.slice(5).trimStart() : "";

  // Parse notes: prefix
  const isNotePrefix = query.toLowerCase().startsWith("notes:");
  const noteQuery = isNotePrefix ? query.slice(6).trimStart() : "";

  // Parse tag: prefix
  const isTagPrefix = query.toLowerCase().startsWith("tag:");
  const tagQuery = isTagPrefix ? query.slice(4).trimStart() : "";

  // Parse login: prefix (hidden functionality)
  const isLoginPrefix = query.toLowerCase().trim() === "login:";
  const hasLoginPrefix = query.toLowerCase().startsWith("login:");

  const effectiveMode: Mode = isLoginPrefix
    ? "login"
    : isDeckPrefix
    ? "deck-pick"
    : isNotePrefix
      ? "note-pick"
      : isTagPrefix
        ? "tag-view"
        : mode === "deck-view"
          ? "deck-view"
          : mode === "multi-tag-study"
            ? "multi-tag-study"
            : mode === "multi-deck-study"
              ? "multi-deck-study"
              : mode === "login"
                ? "login"
                : "default";

  // Light control functions
  const triggerLightOn = async () => {
    try {
      const token = process.env.NEXT_PUBLIC_VOICEMONKEY_TOKEN;
      if (!token) {
        toast.error("VoiceMonkey token not configured");
        return;
      }
      
      const response = await fetch(`https://api-v2.voicemonkey.io/trigger?token=${token}&device=fan-on`);
      if (!response.ok) {
        throw new Error("Failed to trigger light on");
      }
      toast.success("Lights turned on");
      setOpen(false);
    } catch (error) {
      console.error("Light on error:", error);
      toast.error("Failed to turn lights on");
    }
  };

  const triggerLightOff = async () => {
    try {
      const token = process.env.NEXT_PUBLIC_VOICEMONKEY_TOKEN;
      if (!token) {
        toast.error("VoiceMonkey token not configured");
        return;
      }
      
      const response = await fetch(`https://api-v2.voicemonkey.io/trigger?token=${token}&device=fan-off`);
      if (!response.ok) {
        throw new Error("Failed to trigger light off");
      }
      toast.success("Lights turned off");
      setOpen(false);
    } catch (error) {
      console.error("Light off error:", error);
      toast.error("Failed to turn lights off");
    }
  };

  // ── Action Items ──
  const staticItems: Item[] = [
    {
      id: "home",
      label: "Home",
      icon: <Home size={16} strokeWidth={1.5} />,
      section: "GO TO",
      href: "/home",
    },
    {
      id: "decks",
      label: "Decks",
      icon: <Library size={16} strokeWidth={1.5} />,
      section: "GO TO",
      href: "/",
    },
    {
      id: "notes",
      label: "Notes",
      icon: <FileText size={16} strokeWidth={1.5} />,
      section: "GO TO",
      href: "/notes",
    },
    {
      id: "review",
      label: "Review All",
      icon: <Play size={16} strokeWidth={1.5} />,
      section: "GO TO",
      href: "/study/all-due",
    },
    {
      id: "study-tags",
      label: "Study by Tags",
      icon: <Tag size={16} strokeWidth={1.5} />,
      section: "STUDY",
      run: () => {
        setMode("multi-tag-study");
        setQuery("");
      },
    },
    {
      id: "study-decks",
      label: "Study Multiple Decks",
      icon: <Library size={16} strokeWidth={1.5} />,
      section: "STUDY",
      run: () => {
        setMode("multi-deck-study");
        setQuery("");
      },
    },
    {
      id: "study-ahead",
      label: "Study Ahead",
      icon: <Play size={16} strokeWidth={1.5} />,
      section: "STUDY",
      run: () => {
        // Extract deck ID from current pathname if on a deck page
        const deckMatch = pathname?.match(/\/deck\/(\d+)/);
        if (deckMatch) {
          const deckId = deckMatch[1];
          router.push(`/study/all-due?mode=ahead&days=7`);
        } else {
          // If not on a deck page, go to all due study ahead
          router.push(`/study/all-due?mode=ahead&days=7`);
        }
        setOpen(false);
      },
    },
    {
      id: "statistics",
      label: "Statistics",
      icon: <BarChart2 size={16} strokeWidth={1.5} />,
      section: "GO TO",
      href: "/study/stats",
    },
    {
      id: "create-card",
      label: "New Card",
      icon: <Plus size={16} strokeWidth={1.5} />,
      section: "CREATE",
      run: () => {
        /* Handle create card global? */
      },
    },
    {
      id: "create-deck",
      label: "New Deck",
      icon: <Library size={16} strokeWidth={1.5} />,
      section: "CREATE",
      run: () => {
        /* Trigger create deck dialog */
        window.dispatchEvent(new CustomEvent('open-create-deck'));
        setOpen(false);
      },
    },
    {
      id: "create-note",
      label: "New Note",
      icon: <FileText size={16} strokeWidth={1.5} />,
      section: "CREATE",
      run: () => {
        router.push("/notes");
        openDialog();
        setOpen(false);
      },
    },
    {
      id: "import-anki",
      label: importing ? "Importing Anki..." : "Import Anki Deck",
      icon: <Upload size={16} strokeWidth={1.5} />,
      section: "IMPORT",
      run: () => {
        fileInputRef.current?.click();
      },
    },
    {
      id: "import-markdown",
      label: "Import Markdown",
      icon: <FileText size={16} strokeWidth={1.5} />,
      section: "IMPORT",
      run: () => {
        setIsImportMarkdownOpen(true);
        setOpen(false);
      },
    },
    {
      id: "lights-on",
      label: "Lights On",
      icon: <Lightbulb size={16} strokeWidth={1.5} />,
      section: "CONTROL",
      run: triggerLightOn,
    },
    {
      id: "lights-off",
      label: "Lights Off",
      icon: <LightbulbOff size={16} strokeWidth={1.5} />,
      section: "CONTROL",
      run: triggerLightOff,
    },
  ];

  // Add decks to the searchable items
  const dynamicItems: Item[] = decks.map((d) => ({
    id: `deck-${d.id}`,
    label: d.name,
    icon: <Library size={16} strokeWidth={1.5} />,
    section: "DECKS",
    run: () => handleDeckSelect(d),
  }));

  const noteItems: Item[] = notes.map((n) => ({
    id: `note-${n.id}`,
    label: n.title || "Untitled",
    icon: <FileText size={16} strokeWidth={1.5} />,
    section: "NOTES",
    run: () => {
      setCurrentNoteId(n.id);
      router.push(`/notes?noteId=${n.id}`);
      setOpen(false);
    },
  }));

  const allSearchable = [...staticItems, ...dynamicItems, ...noteItems];

  const filtered =
    query.trim() && !isDeckPrefix && !isNotePrefix && !isTagPrefix && !hasLoginPrefix
      ? allSearchable.filter((item) =>
          item.label.toLowerCase().includes(query.toLowerCase()),
        )
      : isTagPrefix
        ? decks.flatMap(d => (d.cards || []).map(c => ({
            id: `card-${c.id}`,
            label: c.front,
            icon: <Tag size={14} />, // Updated to Tag icon
            section: "TAG RESULTS",
            run: () => {
              const deck = decks.find(dk => dk.id === c.deck_id);
              if (deck) handleDeckSelect(deck);
              setOpen(false);
            }
          }))).filter(item => {
            const card = (decks.flatMap(d => d.cards || [])).find(c => `card-${c.id}` === item.id);
            return card && card.tag && card.tag.toLowerCase().includes(tagQuery.toLowerCase());
          })
        : allSearchable;

  const grouped = groupItems(filtered);
  const flatList = filtered;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open || effectiveMode !== "default") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, flatList.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        const item = flatList[activeIndex];
        if (item) {
          if (item.run) item.run();
          else if (item.href) {
            router.push(item.href);
            setOpen(false);
          }
        }
      }
    },
    [flatList, activeIndex, effectiveMode, router, open],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleDeckSelect = (deck: Deck) => {
    setDirection(1);
    setSelectedDeck(deck);
    setMode("deck-view");
    setQuery("");
  };

  const handleBack = () => {
    setDirection(-1);
    if (mode === "multi-tag-study" || mode === "multi-deck-study") {
      setMode("default");
      setQuery("");
      setSelectedTags([]);
      setSelectedDecks([]);
    } else {
      setMode("default");
      setSelectedDeck(null);
      setQuery("deck:");
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleNoteSelect = (note: Note) => {
    setCurrentNoteId(note.id);
    router.push(`/notes?noteId=${note.id}`);
    setOpen(false);
  };

  const handleAnkiImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const toastId = toast.loading(`Importing ${file.name}...`);
    
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to import decks", { id: toastId });
        return;
      }

      const results = await parseAnkiApkg(file);
      let totalCardsAdded = 0;

      // Group results by top-level deck to avoid creating many small decks
      const groupedByRoot: { [rootName: string]: { subNames: string[], cards: any[] }[] } = {};
      for (const result of results) {
        const parts = result.deckName.split("::");
        const rootName = parts[0];
        const subNames = parts.slice(1); 
        
        if (!groupedByRoot[rootName]) groupedByRoot[rootName] = [];
        groupedByRoot[rootName].push({ subNames, cards: result.cards });
      }

      for (const [rootName, entries] of Object.entries(groupedByRoot)) {
        // 1. Create/Find the root deck
        let deck = decks.find(d => d.name === rootName);
        if (!deck) {
          deck = await addDeck(rootName, "Imported from Anki");
        }
        if (!deck) continue;

        for (const entry of entries) {
          for (const cardData of entry.cards) {
            let front = cardData.front;
            let back = cardData.back;

            // 2. Handle media
            for (const [filename, blob] of Object.entries(cardData.media)) {
              const ext = filename.split(".").pop() || "png";
              const storagePath = `${user.id}/anki/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
              
              const { data, error } = await supabase.storage
                .from("userFiles")
                .upload(storagePath, blob);

              if (data) {
                const { data: { publicUrl } } = supabase.storage
                  .from("userFiles")
                  .getPublicUrl(storagePath);
                
                front = front.replace(new RegExp(filename, "g"), publicUrl);
                back = back.replace(new RegExp(filename, "g"), publicUrl);
              }
            }

            // 3. Combine all subdeck parts and existing tags into one list
            const allTags = [...cardData.tags, ...entry.subNames];

            // 4. Add the card
            await addCard(
              deck.id,
              front,
              back,
              allTags.join(", "), 
            );
            totalCardsAdded++;
          }
        }
      }

      toast.success(`Successfully imported ${totalCardsAdded} cards from Anki!`, { id: toastId });
      setOpen(false);
    } catch (err) {
      console.error("Anki import error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to import Anki deck", { id: toastId });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Render ──
  if (!mounted || !isIncluded) return null;

  const renderContent = () => {
    return (
      <motion.div
        layout
        initial={false}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="rounded-xl border border-border bg-background shadow-lg overflow-hidden font-sans text-left"
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
              <DeckView
                deck={selectedDeck}
                onBack={handleBack}
                onClose={() => setOpen(false)}
              />
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
              <NoteExplorer
                query={noteQuery}
                notes={notes}
                onSelect={handleNoteSelect}
                onBack={handleBack}
                onClose={() => setOpen(false)}
                onDeleteNote={deleteNote}
              />
            </motion.div>
          ) : effectiveMode === "multi-tag-study" ? (
            <motion.div
              key="multi-tag-study"
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <MultiTagStudy
                onClose={() => setOpen(false)}
                onBack={handleBack}
              />
            </motion.div>
          ) : effectiveMode === "login" ? (
            <motion.div
              key="login"
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="p-4"
            >
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium">Enter password to continue</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && loginPassword) {
                        e.preventDefault();
                        setIsLoggingIn(true);
                        setLoginError(null);
                        try {
                          await signIn(ADMIN_LOGIN_EMAIL, loginPassword);
                          setOpen(false);
                          setQuery("");
                          setLoginPassword("");
                          window.location.href = "/";
                        } catch (err) {
                          setLoginError("Invalid password");
                        } finally {
                          setIsLoggingIn(false);
                        }
                      }
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (!loginPassword) return;
                      setIsLoggingIn(true);
                      setLoginError(null);
                      try {
                        await signIn(ADMIN_LOGIN_EMAIL, loginPassword);
                        setOpen(false);
                        setQuery("");
                        setLoginPassword("");
                        window.location.href = "/";
                      } catch (err) {
                        setLoginError("Invalid password");
                      } finally {
                        setIsLoggingIn(false);
                      }
                    }}
                    disabled={isLoggingIn || !loginPassword}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
                  >
                    {isLoggingIn ? "Logging in..." : "Login"}
                  </button>
                </div>
                {loginError && (
                  <p className="text-xs text-red-500 mt-2">{loginError}</p>
                )}
              </div>
            </motion.div>
          ) : effectiveMode === "multi-deck-study" ? (
            <motion.div
              key="multi-deck-study"
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <MultiDeckStudy
                onClose={() => setOpen(false)}
                onBack={handleBack}
              />
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
              {/* Hidden file input for Anki import */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".apkg"
                onChange={handleAnkiImport}
                className="hidden"
              />
              {/* Search input row */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <Search
                  size={16}
                  className="text-muted-foreground shrink-0"
                  strokeWidth={1.5}
                />
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
                      <button
                        onClick={() => setQuery("tag:")}
                        className="inline-flex items-center px-2 py-0.5 rounded-full border border-border text-[11px] text-muted-foreground bg-muted font-sans cursor-pointer hover:bg-muted/80 transition-colors select-none"
                      >
                        tag:
                      </button>
                    </>
                  )}
                  <kbd className="inline-flex items-center px-2 py-0.5 rounded-full border border-border text-[11px] text-muted-foreground bg-muted font-sans cursor-default select-none">
                    esc
                  </kbd>
                </div>
              </div>

              {/* Results area */}
              {effectiveMode === "deck-pick" ? (
                <DeckPicker
                  query={deckQuery}
                  decks={decks}
                  onSelect={handleDeckSelect}
                />
              ) : effectiveMode === "note-pick" ? (
                <NoteExplorer
                  query={noteQuery}
                  notes={notes}
                  onSelect={handleNoteSelect}
                  onBack={handleBack}
                  onClose={() => setOpen(false)}
                  onDeleteNote={deleteNote}
                />
              ) : (
                <div className="py-2 max-h-[420px] overflow-y-auto">
                  {Object.keys(grouped).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No results found.
                    </p>
                  ) : (
                    Object.entries(grouped).map(([section, items]) => (
                      <div key={section}>
                        <p className="px-5 pt-3 pb-1.5 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground select-none">
                          {section}
                        </p>
                        {items.map((item) => {
                          const globalIdx = flatList.findIndex(
                            (f) => f.id === item.id,
                          );
                          const isActive = globalIdx === activeIndex;
                          return (
                            <button
                              key={item.id}
                              onMouseEnter={() => setActiveIndex(globalIdx)}
                              onClick={() => {
                                if (item.run) item.run();
                                else if (item.href) {
                                  router.push(item.href);
                                  setOpen(false);
                                }
                              }}
                              className={`w-full flex items-center gap-3.5 px-5 py-3 text-sm text-left transition-colors cursor-default ${
                                isActive
                                  ? "bg-muted text-foreground"
                                  : "text-foreground/80 hover:bg-muted/60"
                              }`}
                            >
                              <span
                                className={`${isActive ? "text-foreground" : "text-muted-foreground"} transition-colors`}
                              >
                                {item.icon}
                              </span>
                              <span>{item.label}</span>
                            </button>
                          );
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
                  <span className="text-xs text-muted-foreground">
                    Navigate
                  </span>
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
    );
  };

  return (
    <>
      {createPortal(
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
                className="w-[600px] max-w-[95vw] mx-auto"
              >
                {renderContent()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
      <ImportMarkdownDialog open={isImportMarkdownOpen} onOpenChange={setIsImportMarkdownOpen} />
    </>
  );
}
