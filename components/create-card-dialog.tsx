"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useDecks } from "@/context/deck-context"
import { useToast } from "@/hooks/use-toast"

interface CreateCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deckId: number
}

export function CreateCardDialog({ open, onOpenChange, deckId }: CreateCardDialogProps) {
  const [front, setFront] = useState("")
  const [back, setBack] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addCard } = useDecks()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Add the new card to the deck
      await addCard(deckId, front, back)

      // Show success toast
      toast({
        title: "Card added",
        description: "The flashcard has been successfully added to the deck.",
      })

      // Reset form and close dialog
      setFront("")
      setBack("")
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add card. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Flashcard</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="front">Front (Question)</Label>
              <Textarea
                id="front"
                value={front}
                onChange={(e) => setFront(e.target.value)}
                placeholder="Enter the question or prompt"
                rows={3}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="back">Back (Answer)</Label>
              <Textarea
                id="back"
                value={back}
                onChange={(e) => setBack(e.target.value)}
                placeholder="Enter the answer or explanation"
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!front.trim() || !back.trim() || isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
