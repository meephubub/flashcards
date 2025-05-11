"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useDecks } from "@/context/deck-context"
import { useToast } from "@/hooks/use-toast"

interface CreateDeckDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateDeckDialog({ open, onOpenChange }: CreateDeckDialogProps) {
  const [deckName, setDeckName] = useState("")
  const [deckDescription, setDeckDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addDeck } = useDecks()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Add the new deck to our context
      await addDeck(deckName, deckDescription)

      // Show success toast
      toast({
        title: "Deck created",
        description: `Successfully created "${deckName}" deck`,
      })

      // Reset form and close dialog
      setDeckName("")
      setDeckDescription("")
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create deck. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Deck</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Deck Name</Label>
              <Input
                id="name"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="e.g., JavaScript Fundamentals"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={deckDescription}
                onChange={(e) => setDeckDescription(e.target.value)}
                placeholder="Add a description for your deck"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!deckName.trim() || isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Deck"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
