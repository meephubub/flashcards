"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useDecks } from "@/context/deck-context"
import { Sparkles, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"

interface GenerateFlashcardsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GenerateFlashcardsDialog({ open, onOpenChange }: GenerateFlashcardsDialogProps) {
  const [topic, setTopic] = useState("")
  const [numberOfCards, setNumberOfCards] = useState(5)
  const [selectedDeckId, setSelectedDeckId] = useState<string>("new")
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()
  const { decks, refreshDecks } = useDecks()

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTopic("")
      setNumberOfCards(5)
      setSelectedDeckId("new")
    }
  }, [open])

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({
        title: "Topic required",
        description: "Please enter a topic for your flashcards.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: topic.trim(),
          numberOfCards,
          deckId: selectedDeckId !== "new" ? Number.parseInt(selectedDeckId) : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate flashcards")
      }

      // Refresh decks to show the newly generated deck or updated deck
      await refreshDecks()

      toast({
        title: "Generation successful",
        description: data.message,
      })

      // Close dialog
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate flashcards",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate AI Flashcards</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              placeholder="e.g., Quantum Physics, French Revolution, JavaScript Promises"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground">Enter a specific topic to generate flashcards about</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="number-of-cards">Number of Cards: {numberOfCards}</Label>
            <Slider
              id="number-of-cards"
              min={3}
              max={50}
              step={1}
              value={[numberOfCards]}
              onValueChange={(value) => setNumberOfCards(value[0])}
              disabled={isGenerating}
              className="py-4"
            />
            <p className="text-xs text-muted-foreground">More cards will take longer to generate</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="deck">Add to Deck</Label>
            <Select value={selectedDeckId} onValueChange={setSelectedDeckId} disabled={isGenerating}>
              <SelectTrigger id="deck">
                <SelectValue placeholder="Select a deck" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Create new deck</SelectItem>
                {decks.map((deck) => (
                  <SelectItem key={deck.id} value={deck.id.toString()}>
                    {deck.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Create a new deck or add to an existing one</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !topic.trim()}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
