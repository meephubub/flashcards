"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Plus, Save, Trash2, GripVertical, Image as ImageIcon } from "lucide-react"
import { Link } from "next-view-transitions"
import { useDecks } from "@/context/deck-context"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { ImageUpload } from "@/components/ui/image-upload"

interface DeckEditorProps {
  deckId: number
}

export function DeckEditor({ deckId }: DeckEditorProps) {
  const { getDeck, updateDeck, deleteCard, addCard, updateCard, loading, refreshDecks } = useDecks()
  const { toast } = useToast()
  const router = useRouter()

  const originalDeck = getDeck(deckId)

  const [deck, setDeck] = useState(originalDeck)
  const [isSaving, setIsSaving] = useState(false)
  // Track which image panel is expanded per card and side: key `${cardId}-front|back`
  const [expandedImages, setExpandedImages] = useState<Record<string, boolean>>({})
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const focusRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  // Track cards marked for deletion (persisted on Save only)
  const [deletedCardIds, setDeletedCardIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    // Update local state when the deck changes in context
    setDeck(getDeck(deckId))
  }, [getDeck, deckId])

  // Keyboard shortcut: Ctrl/Cmd + Enter to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey
      if (isMeta && e.key === "Enter") {
        e.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // We intentionally omit handleSave from deps to avoid re-registering the listener frequently
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-32" />
        </div>

        <div className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div>
            <Skeleton className="h-5 w-24 mb-1" />
            <Skeleton className="h-10 w-full max-w-md" />
          </div>

          <div>
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-24 w-full max-w-md" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>

        {[1, 2, 3].map((i) => (
          <Card key={i} className="relative">
            <CardContent className="p-6 pl-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-24 w-full" />
                </div>
                <div>
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Deck not found</h2>
        <p className="text-gray-500 mb-6">The deck you're looking for doesn't exist or has been deleted.</p>
        <Button asChild>
          <Link href="/">Return to Home</Link>
        </Button>
      </div>
    )
  }

  // Reorder helpers (only defined when deck is present)
  const reorderCards = (fromId: number, toId: number) => {
    if (fromId === toId) return
    const fromIndex = deck.cards.findIndex((c) => c.id === fromId)
    const toIndex = deck.cards.findIndex((c) => c.id === toId)
    if (fromIndex === -1 || toIndex === -1) return
    const newCards = [...deck.cards]
    const [moved] = newCards.splice(fromIndex, 1)
    newCards.splice(toIndex, 0, moved)
    setDeck({ ...deck, cards: newCards })
  }

  const handleDragStart = (id: number) => setDraggingId(id)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }
  const handleDropOn = (id: number) => {
    if (draggingId != null) reorderCards(draggingId, id)
    setDraggingId(null)
  }

  // Keyboard navigation across fields
  const focusKey = (cardId: number, field: "front" | "back") => `${cardId}-${field}`
  const focusField = (cardId: number, field: "front" | "back") => {
    const el = focusRefs.current[focusKey(cardId, field)]
    if (el) el.focus()
  }
  const moveToNextField = (cardIndex: number, field: "front" | "back") => {
    const isFront = field === "front"
    if (isFront) {
      focusField(deck.cards[cardIndex].id, "back")
    } else {
      const nextIndex = cardIndex + 1
      if (nextIndex < deck.cards.length) {
        focusField(deck.cards[nextIndex].id, "front")
      }
    }
  }
  const moveToPrevField = (cardIndex: number, field: "front" | "back") => {
    const isBack = field === "back"
    if (isBack) {
      focusField(deck.cards[cardIndex].id, "front")
    } else {
      const prevIndex = cardIndex - 1
      if (prevIndex >= 0) {
        focusField(deck.cards[prevIndex].id, "back")
      }
    }
  }

  // Inline add card (create a temporary row matching Card shape)
  const addCardAt = (index: number) => {
    const tempId = -Date.now()
    const newCard = {
      id: tempId,
      front: "",
      back: "",
      front_img_url: "",
      back_img_url: "",
      deck_id: deckId,
      exclude_from_srs: false,
      created_at: null,
      updated_at: null,
      user_id: null,
    }
    const newCards = [...deck.cards]
    newCards.splice(index, 0, newCard as any)
    setDeck({ ...deck, cards: newCards })
    setTimeout(() => focusField(tempId, "front"), 0)
  }
  const handleDeckNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeck({ ...deck, name: e.target.value })
  }

  const handleDeckDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDeck({ ...deck, description: e.target.value })
  }

  const handleCardChange = (
    id: number,
    field: "front" | "back" | "front_img_url" | "back_img_url" | "exclude_from_srs",
    value: string | null | boolean,
  ) => {
    setDeck({
      ...deck,
      // Cast to any to support fields that might not exist on the generated Card type yet
      cards: deck.cards.map((card) => (card.id === id ? ({ ...card, [field]: value } as any) : card)),
    })
  }

  const handleDeleteCard = (id: number) => {
    // Mark for deletion and remove from local draft
    setDeletedCardIds(prev => new Set(prev).add(id))
    setDeck({
      ...deck,
      cards: deck.cards.filter((c) => c.id !== id),
      card_count: Math.max(0, deck.cards.length - 1),
    })
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      // Persist deletions first (only for existing cards with positive IDs)
      for (const id of deletedCardIds) {
        if (id > 0) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await deleteCard(deckId, id)
          } catch (e) {
            // If any deletion fails, surface error and stop save to avoid partial state
            toast({ title: "Error", description: `Failed to delete card ${id}.`, variant: "destructive" })
            setIsSaving(false)
            return
          }
        }
      }

      // 1) Save deck metadata (name/description/tag)
      await updateDeck(deck)

      // 2) Persist new cards and updates
      const originalById = new Map<number, any>((originalDeck?.cards || []).map((c: any) => [c.id, c]))

      // Create new cards (temporary negative IDs)
      for (const c of deck.cards) {
        if (c.id < 0) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await addCard(
              deckId,
              c.front,
              c.back,
              (c as any).front_img_url ?? null,
              (c as any).back_img_url ?? null,
            )
          } catch (e) {
            toast({ title: "Error", description: "Failed to create a new card.", variant: "destructive" })
            setIsSaving(false)
            return
          }
        }
      }

      // Update modified existing cards
      for (const c of deck.cards) {
        if (c.id > 0) {
          const orig = originalById.get(c.id)
          if (!orig) continue
          const frontChanged = (orig.front ?? "") !== (c.front ?? "")
          const backChanged = (orig.back ?? "") !== (c.back ?? "")
          const frontImgChanged = (orig.front_img_url ?? null) !== ((c as any).front_img_url ?? null)
          const backImgChanged = (orig.back_img_url ?? null) !== ((c as any).back_img_url ?? null)
          const excludeChanged = (orig.exclude_from_srs ?? false) !== ((c as any).exclude_from_srs ?? false)
          if (frontChanged || backChanged || frontImgChanged || backImgChanged || excludeChanged) {
            try {
              // eslint-disable-next-line no-await-in-loop
              await updateCard(
                deckId,
                c.id,
                c.front,
                c.back,
                (c as any).front_img_url ?? null,
                (c as any).back_img_url ?? null,
                (c as any).exclude_from_srs ?? false,
              )
            } catch (e) {
              toast({ title: "Error", description: `Failed to update card ${c.id}.`, variant: "destructive" })
              setIsSaving(false)
              return
            }
          }
        }
      }

      // Clear deletion markers after successful save
      setDeletedCardIds(new Set())

      // Refresh decks to ensure state matches DB (names, counts, etc.)
      try {
        await refreshDecks()
      } catch (e) {
        // Non-fatal; UI will still navigate back
      }

      toast({
        title: "Changes saved",
        description: "Your changes to the deck have been saved.",
      })

      // Redirect back to deck view
      router.push(`/deck/${deckId}`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-black/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-black/70 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between px-2 sm:px-0 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/deck/${deckId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="text-sm text-black/60 dark:text-white/60">{deck.cards.length} cards</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/deck/${deckId}`}>Cancel</Link>
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* Deck meta */}
      <div className="space-y-3 bg-white dark:bg-black border border-black/10 dark:border-white/10 p-5 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="deckName" className="block text-xs uppercase tracking-wider text-black/60 dark:text-white/60 mb-1">
              Title
            </label>
            <Input id="deckName" value={deck.name} onChange={handleDeckNameChange} placeholder="Deck title" />
          </div>
          <div>
            <label htmlFor="deckTag" className="block text-xs uppercase tracking-wider text-black/60 dark:text-white/60 mb-1">
              Tag
            </label>
            <Input
              id="deckTag"
              value={deck.tag || ""}
              onChange={(e) => setDeck({ ...deck, tag: e.target.value || null })}
              placeholder="e.g. math, biology"
            />
          </div>
        </div>
        <div>
          <label htmlFor="deckDescription" className="block text-xs uppercase tracking-wider text-black/60 dark:text-white/60 mb-1">
            Description
          </label>
          <Textarea id="deckDescription" value={deck.description} onChange={handleDeckDescriptionChange} rows={3} placeholder="Optional description" />
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="deck-exclude-srs"
            checked={(deck as any).exclude_from_srs ?? false}
            onCheckedChange={(checked) => setDeck({ ...deck, exclude_from_srs: checked } as any)}
          />
          <Label htmlFor="deck-exclude-srs">Exclude entire deck from Spaced Repetition</Label>
        </div>
      </div>

      {/* Cards header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Cards</h2>
      </div>

      {/* Cards list */}
      <div className="space-y-3">
        {/* Empty state: show inline add when there are no cards */}
        {deck.cards.length === 0 && (
          <div className="flex justify-center py-1">
            <Button variant="ghost" size="sm" onClick={() => addCardAt(0)}>
              <Plus className="h-4 w-4 mr-1" /> Add card here
            </Button>
          </div>
        )}
        {deck.cards.map((card, index) => {
          return (
            <div key={card.id}>
              {/* No top add button; only inline 'Add card here' between cards */}
              <Card
                className="border-black/10 dark:border-white/10"
                draggable
                onDragStart={() => handleDragStart(card.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDropOn(card.id)}
              >
                <CardContent className="p-0">
                  <div className="flex items-stretch gap-0">
                    <div className="w-10 shrink-0 flex items-center justify-center text-black/50 dark:text-white/50 border-r border-black/10 dark:border-white/10">
                      <span className="text-sm">{index + 1}</span>
                    </div>
                    <div className="hidden sm:flex w-8 shrink-0 items-center justify-center text-black/30 dark:text-white/30 border-r border-black/10 dark:border-white/10 cursor-grab">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-black/10 dark:bg-white/10">
                        <div className="p-4 bg-white dark:bg-black">
                          <label htmlFor={`front-${card.id}`} className="block text-xs uppercase tracking-wider text-black/60 dark:text-white/60 mb-1">
                            Term
                          </label>
                          <Textarea
                            id={`front-${card.id}`}
                            value={card.front}
                            onChange={(e) => handleCardChange(card.id, "front", e.target.value)}
                            rows={2}
                            placeholder="Enter term"
                            ref={(el) => { focusRefs.current[focusKey(card.id, "front")] = el }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                moveToNextField(index, "front")
                              } else if (e.key === "ArrowUp" && (e.currentTarget.selectionStart ?? 0) === 0) {
                                e.preventDefault()
                                moveToPrevField(index, "front")
                              } else if (e.key === "ArrowDown" && (e.currentTarget.selectionStart ?? 0) === e.currentTarget.value.length) {
                                e.preventDefault()
                                moveToNextField(index, "front")
                              }
                            }}
                          />
                        </div>
                        <div className="p-4 bg-white dark:bg-black">
                          <label htmlFor={`back-${card.id}`} className="block text-xs uppercase tracking-wider text-black/60 dark:text-white/60 mb-1">
                            Definition
                          </label>
                          <Textarea
                            id={`back-${card.id}`}
                            value={card.back}
                            onChange={(e) => handleCardChange(card.id, "back", e.target.value)}
                            rows={2}
                            placeholder="Enter definition"
                            ref={(el) => { focusRefs.current[focusKey(card.id, "back")] = el }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                moveToNextField(index, "back")
                              } else if (e.key === "ArrowUp" && (e.currentTarget.selectionStart ?? 0) === 0) {
                                e.preventDefault()
                                moveToPrevField(index, "back")
                              } else if (e.key === "ArrowDown" && (e.currentTarget.selectionStart ?? 0) === e.currentTarget.value.length) {
                                e.preventDefault()
                                moveToNextField(index, "back")
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Image row with per-side controls */}
                      <div className="flex items-center justify-between px-4 py-2 border-t border-black/10 dark:border-white/10">
                        <div className="flex items-center gap-2 text-sm text-black/60 dark:text-white/60">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedImages((prev) => ({
                                ...prev,
                                [`${card.id}-front`]: !prev[`${card.id}-front`],
                              }))
                            }
                          >
                            <ImageIcon className="h-4 w-4 mr-1" />
                            {expandedImages[`${card.id}-front`] ? "Hide term image" : (card as any).front_img_url ? "Change term image" : "Add term image"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedImages((prev) => ({
                                ...prev,
                                [`${card.id}-back`]: !prev[`${card.id}-back`],
                              }))
                            }
                          >
                            <ImageIcon className="h-4 w-4 mr-1" />
                            {expandedImages[`${card.id}-back`] ? "Hide definition image" : (card as any).back_img_url ? "Change definition image" : "Add definition image"}
                          </Button>
                          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-black/10 dark:border-white/10">
                            <Switch
                              id={`exclude-srs-${card.id}`}
                              checked={(card as any).exclude_from_srs ?? false}
                              onCheckedChange={(checked) => handleCardChange(card.id, "exclude_from_srs", checked)}
                            />
                            <Label htmlFor={`exclude-srs-${card.id}`} className="text-xs cursor-pointer">
                              Exclude from SRS
                            </Label>
                          </div>
                        </div>
                        <div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => handleDeleteCard(card.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                      {expandedImages[`${card.id}-front`] && (
                        <div className="px-4 pb-4 border-t border-black/10 dark:border-white/10">
                          <div className="pt-2">
                            <ImageUpload
                              value={(card as any).front_img_url ?? ""}
                              onChange={(url) => handleCardChange(card.id, "front_img_url", url)}
                            />
                          </div>
                        </div>
                      )}
                      {expandedImages[`${card.id}-back`] && (
                        <div className="px-4 pb-4 border-t border-black/10 dark:border-white/10">
                          <div className="pt-2">
                            <ImageUpload
                              value={(card as any).back_img_url ?? ""}
                              onChange={(url) => handleCardChange(card.id, "back_img_url", url)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Inline add below this card */}
              <div className="flex justify-center py-1">
                <Button variant="ghost" size="sm" onClick={() => addCardAt(index + 1)}>
                  <Plus className="h-4 w-4 mr-1" /> Add card here
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Save/Cancel only at top; no bottom controls */}
    </div>
  )
}
