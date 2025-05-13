"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Plus, Save, Trash2, GripVertical } from "lucide-react"
import Link from "next/link"
import { CreateCardDialog } from "@/components/create-card-dialog"
import { useDecks } from "@/context/deck-context"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { ImageUpload } from "@/components/ui/image-upload"

interface DeckEditorProps {
  deckId: number
}

export function DeckEditor({ deckId }: DeckEditorProps) {
  const { getDeck, updateDeck, deleteCard, loading } = useDecks()
  const { toast } = useToast()
  const router = useRouter()

  const originalDeck = getDeck(deckId)

  const [deck, setDeck] = useState(originalDeck)
  const [isCreateCardOpen, setIsCreateCardOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    // Update local state when the deck changes in context
    setDeck(getDeck(deckId))
  }, [getDeck, deckId])

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

  const handleDeckNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeck({ ...deck, name: e.target.value })
  }

  const handleDeckDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDeck({ ...deck, description: e.target.value })
  }

  const handleCardChange = (id: number, field: "front" | "back" | "img_url", value: string) => {
    setDeck({
      ...deck,
      cards: deck.cards.map((card) => (card.id === id ? { ...card, [field]: value } : card)),
    })
  }

  const handleDeleteCard = async (id: number) => {
    try {
      await deleteCard(deckId, id)
      toast({
        title: "Card deleted",
        description: "The flashcard has been removed from the deck.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete card. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      // Save the updated deck to context
      await updateDeck(deck)

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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/deck/${deckId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Edit Deck</h1>
      </div>

      <div className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
        <div>
          <label htmlFor="deckName" className="block text-sm font-medium mb-1">
            Deck Name
          </label>
          <Input id="deckName" value={deck.name} onChange={handleDeckNameChange} className="max-w-md" />
        </div>

        <div>
          <label htmlFor="deckDescription" className="block text-sm font-medium mb-1">
            Description (Optional)
          </label>
          <Textarea
            id="deckDescription"
            value={deck.description}
            onChange={handleDeckDescriptionChange}
            rows={3}
            className="max-w-md"
          />
        </div>

        <div>
          <label htmlFor="deckTag" className="block text-sm font-medium mb-1">
            Tag (Optional)
          </label>
          <Input
            id="deckTag"
            value={deck.tag || ""}
            onChange={(e) => setDeck({ ...deck, tag: e.target.value || null })}
            placeholder="e.g., programming, math, language"
            className="max-w-md"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium">Flashcards ({deck.cards.length})</h2>
        <Button onClick={() => setIsCreateCardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Card
        </Button>
      </div>

      <div className="space-y-4">
        {deck.cards.map((card, index) => (
          <Card key={card.id} className="relative">
            <div className="absolute left-2 top-0 bottom-0 flex items-center text-gray-400">
              <GripVertical className="h-5 w-5" />
            </div>
            <CardContent className="p-6 pl-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`front-${card.id}`} className="block text-sm font-medium mb-1">
                    Front (Question)
                  </label>
                  <Textarea
                    id={`front-${card.id}`}
                    value={card.front}
                    onChange={(e) => handleCardChange(card.id, "front", e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <label htmlFor={`back-${card.id}`} className="block text-sm font-medium mb-1">
                    Back (Answer)
                  </label>
                  <Textarea
                    id={`back-${card.id}`}
                    value={card.back}
                    onChange={(e) => handleCardChange(card.id, "back", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">
                  Image (Optional)
                </label>
                <ImageUpload
                  value={card.img_url}
                  onChange={(url) => handleCardChange(card.id, "img_url", url)}
                />
              </div>
              <div className="mt-3 flex justify-end">
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
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" asChild>
          <Link href={`/deck/${deckId}`}>Cancel</Link>
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <CreateCardDialog open={isCreateCardOpen} onOpenChange={setIsCreateCardOpen} deckId={deckId} />
    </div>
  )
}
