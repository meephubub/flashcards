"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/auth-context";
import { useDecks } from "@/context/deck-context";
import { useRouter, useSearchParams } from "next/navigation";
import { AppSidebar } from "@/components/notes/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Folder, Bold, Italic, Brackets, Sigma, Code2, Tag, ChevronDown, Eye, BookOpen, LayoutGrid, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Link } from "next-view-transitions";

const NOTE_TYPES = ["Basic", "Basic (reversed)", "Cloze", "Image Occlusion"];

interface EditCardPageClientProps {
  deckId: number;
  cardId: number;
}

// Helper to build folder structure from deck tags
interface FolderNode {
  name: string;
  decks: { id: number; name: string }[];
  subfolders: Map<string, FolderNode>;
}

function buildFolderTree(decks: any[]): FolderNode {
  const root: FolderNode = { name: "root", decks: [], subfolders: new Map() };
  decks.forEach(deck => {
    const tags = deck.tag ? deck.tag.split('/').filter(Boolean) : [];
    if (tags.length === 0) {
      root.decks.push({ id: deck.id, name: deck.name });
    } else {
      let current = root;
      tags.forEach((tag: string, index: number) => {
        if (!current.subfolders.has(tag)) {
          current.subfolders.set(tag, { name: tag, decks: [], subfolders: new Map() });
        }
        current = current.subfolders.get(tag)!;
        if (index === tags.length - 1) {
          current.decks.push({ id: deck.id, name: deck.name });
        }
      });
    }
  });
  return root;
}

function DeckFolderMenu({ decks, selectedDeckId, onSelect, path }: any) {
  const tree = buildFolderTree(decks);
  const node = path.length === 0 ? tree : getNodeAtPath(tree, path);
  if (!node) return null;
  return (
    <>
      {node.decks.map(deck => (
        <DropdownMenuItem
          key={deck.id}
          onClick={() => onSelect(deck.id)}
          className={cn(
            "text-sm cursor-pointer",
            selectedDeckId === deck.id && "font-medium bg-zinc-100 dark:bg-zinc-800"
          )}
        >
          {deck.name}
        </DropdownMenuItem>
      ))}
      {node.decks.length > 0 && node.subfolders.size > 0 && <DropdownMenuSeparator />}
      {Array.from(node.subfolders.entries()).map(([name, subfolder]) => (
        <DropdownMenuSub key={name}>
          <DropdownMenuSubTrigger className="text-sm cursor-pointer">
            <Folder className="w-3.5 h-3.5 mr-2 text-zinc-400" />
            {name}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[180px]">
            <DeckFolderMenu decks={decks} selectedDeckId={selectedDeckId} onSelect={onSelect} path={[...path, name]} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ))}
    </>
  );
}

function getNodeAtPath(root: FolderNode, path: string[]): FolderNode | null {
  let current = root;
  for (const segment of path) {
    const next = current.subfolders.get(segment);
    if (!next) return null;
    current = next;
  }
  return current;
}

export function EditCardPageClient({ deckId, cardId }: EditCardPageClientProps) {
  const { decks, updateCard, deleteCard } = useDecks();
  const { toast } = useToast();
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [tag, setTag] = useState("");
  const [selectedDeckId, setSelectedDeckId] = useState<number>(deckId);
  const [selectedType, setSelectedType] = useState("Basic");
  const [activeField, setActiveField] = useState<"front" | "back" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tagInputOpen, setTagInputOpen] = useState(false);

  const selectedDeck = useMemo(() => decks.find(d => d.id === selectedDeckId), [decks, selectedDeckId]);
  const originalCard = useMemo(() => {
    const d = decks.find(d => d.id === deckId);
    return d?.cards?.find(c => c.id === cardId);
  }, [decks, deckId, cardId]);

  useEffect(() => {
    if (originalCard) {
      setFront(originalCard.front);
      setBack(originalCard.back);
      setTag(originalCard.tag || "");
    }
  }, [originalCard]);

  useEffect(() => {
    if (!isLoading && !session) router.push("/");
  }, [session, isLoading, router]);

  const handleSave = async () => {
    if (!front.trim()) {
      toast({ title: "Missing front", description: "Please enter something on the front.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      await updateCard(selectedDeckId, cardId, front, back, tag || null, originalCard?.front_img_url, originalCard?.back_img_url);
      toast({ title: "Card updated", description: "Changes saved successfully." });

      // Check if user came from study mode and redirect back with preserved state
      const returnTo = searchParams.get('returnTo');
      if (returnTo === 'study' || returnTo === 'all-due') {
        const cardIndex = searchParams.get('cardIndex');
        const reviewMode = searchParams.get('reviewMode') === 'true';
        const reviewCurrent = searchParams.get('reviewCurrent');
        const reviewIndices = searchParams.get('reviewIndices');

        const params = new URLSearchParams();
        if (cardIndex) params.set('cardIndex', cardIndex);
        if (reviewMode) params.set('reviewMode', 'true');
        if (reviewCurrent) params.set('reviewCurrent', reviewCurrent);
        if (reviewIndices) params.set('reviewIndices', reviewIndices);

        if (returnTo === 'study') {
          router.push(`/deck/${selectedDeckId}/study?${params.toString()}`);
        } else {
          router.push(`/study/all-due?${params.toString()}`);
        }
      } else {
        router.push(`/deck/${selectedDeckId}`);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update card.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this card?")) {
      try {
        await deleteCard(selectedDeckId, cardId);
        toast({ title: "Card deleted" });
        router.push(`/deck/${selectedDeckId}`);
      } catch (err) {
        toast({ title: "Error", description: "Failed to delete card.", variant: "destructive" });
      }
    }
  };

  const applyFormat = (format: string) => {
    const field = activeField;
    if (!field) return;
    const val = field === "front" ? front : back;
    const setter = field === "front" ? setFront : setBack;
    const textarea = document.getElementById(field === "front" ? "front-input" : "back-input") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = val.slice(start, end);
    let wrapped = selected;
    if (format === "bold") wrapped = `**${selected}**`;
    if (format === "italic") wrapped = `_${selected}_`;
    if (format === "cloze") wrapped = `{{c1::${selected}}}`;
    if (format === "latex") wrapped = `\\(${selected}\\)`;
    if (format === "code") wrapped = `\`${selected}\``;
    setter(val.slice(0, start) + wrapped + val.slice(end));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + wrapped.length, start + wrapped.length);
    }, 0);
  };

  const ToolbarButton = ({ onClick, children, title }: any) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
    >
      {children}
    </button>
  );

  if (isLoading || !originalCard) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-black">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-900 px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink asChild><Link href="/">Home</Link></BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink asChild><Link href={`/deck/${selectedDeckId}`}>{selectedDeck?.name || selectedDeckId}</Link></BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem><BreadcrumbPage>Edit Card</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleDelete} className="text-zinc-400 hover:text-red-500 rounded-full">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !front.trim()} className="h-8 px-5 text-sm bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white rounded-full">
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-6" onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && handleSave()}>
            <div className="absolute top-20 left-1/2 -translate-x-1/2 border border-zinc-300 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <BookOpen className="w-4 h-4" />
                    {selectedDeck?.name || "Select deck"}
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="min-w-[220px] max-h-[400px] overflow-y-auto">
                  <DeckFolderMenu decks={decks} selectedDeckId={selectedDeckId} onSelect={setSelectedDeckId} path={[]} />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <motion.div
              className="w-full max-w-lg relative"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Front</span>
                    <button type="button" className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"><Eye className="w-4 h-4" /></button>
                  </div>
                  <textarea id="front-input" value={front} onChange={(e) => setFront(e.target.value)} onFocus={() => setActiveField("front")} placeholder="Front..." rows={3} className="w-full resize-none bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none leading-relaxed" />
                  <AnimatePresence>
                    {activeField === "front" && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex items-center gap-0.5 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-900">
                        <ToolbarButton onClick={() => applyFormat("bold")} title="Bold"><Bold className="w-3.5 h-3.5" /></ToolbarButton>
                        <ToolbarButton onClick={() => applyFormat("italic")} title="Italic"><Italic className="w-3.5 h-3.5" /></ToolbarButton>
                        <ToolbarButton onClick={() => applyFormat("cloze")} title="Cloze deletion"><Brackets className="w-3.5 h-3.5" /></ToolbarButton>
                        <ToolbarButton onClick={() => applyFormat("latex")} title="LaTeX"><Sigma className="w-3.5 h-3.5" /></ToolbarButton>
                        <ToolbarButton onClick={() => applyFormat("code")} title="Code"><Code2 className="w-3.5 h-3.5" /></ToolbarButton>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="h-px bg-zinc-100 dark:bg-zinc-900" />
                <div className="px-5 pt-4 pb-5">
                  <div className="mb-2"><span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Back</span></div>
                  <textarea id="back-input" value={back} onChange={(e) => setBack(e.target.value)} onFocus={() => setActiveField("back")} placeholder="Back..." rows={4} className="w-full resize-none bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none leading-relaxed" />
                  <AnimatePresence>
                    {activeField === "back" && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex items-center gap-0.5 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-900">
                        <ToolbarButton onClick={() => applyFormat("bold")} title="Bold"><Bold className="w-3.5 h-3.5" /></ToolbarButton>
                        <ToolbarButton onClick={() => applyFormat("italic")} title="Italic"><Italic className="w-3.5 h-3.5" /></ToolbarButton>
                        <ToolbarButton onClick={() => applyFormat("cloze")} title="Cloze deletion"><Brackets className="w-3.5 h-3.5" /></ToolbarButton>
                        <ToolbarButton onClick={() => applyFormat("latex")} title="LaTeX"><Sigma className="w-3.5 h-3.5" /></ToolbarButton>
                        <ToolbarButton onClick={() => applyFormat("code")} title="Code"><Code2 className="w-3.5 h-3.5" /></ToolbarButton>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="px-5 py-3 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <div className="flex items-center gap-2">
                  <AnimatePresence mode="wait">
                    {tagInputOpen ? (
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-1"
                      >
                        <input
                          type="text"
                          value={tag}
                          onChange={(e) => setTag(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              setTagInputOpen(false);
                            }
                            if (e.key === "Escape") {
                              setTagInputOpen(false);
                            }
                          }}
                          onBlur={() => setTagInputOpen(false)}
                          placeholder="Add tags..."
                          autoFocus
                          className="w-32 px-2 py-1 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        />
                      </motion.div>
                    ) : tag ? (
                      <motion.button
                        type="button"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        onClick={() => setTagInputOpen(true)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <Tag className="w-3 h-3" />
                        <span className="max-w-[100px] truncate">{tag}</span>
                      </motion.button>
                    ) : (
                      <motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setTagInputOpen(true)}
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>+ tag</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-zinc-500 h-7 px-2"><LayoutGrid className="w-3.5 h-3.5" />{selectedType}<ChevronDown className="w-3 h-3" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[160px]">
                      {NOTE_TYPES.map((type) => (
                        <DropdownMenuItem key={type} onClick={() => setSelectedType(type)} className={cn("text-xs cursor-pointer", selectedType === type && "font-medium")}>{type}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <p className="text-center mt-4 text-xs text-zinc-400">Ctrl+Enter to save</p>
            </motion.div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
