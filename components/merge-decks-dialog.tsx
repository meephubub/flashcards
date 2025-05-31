"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import type { Deck } from "@/lib/supabase"
import { mergeDecks as mergeDecksAction, getDecks } from "@/lib/data"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Combine, Search, Check, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MergeDecksDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onMergeSuccess?: () => void
}

export function MergeDecksDialog({ isOpen, onOpenChange, onMergeSuccess }: MergeDecksDialogProps) {
  const [allDecks, setAllDecks] = React.useState<Deck[]>([])
  const [selectedDeckIds, setSelectedDeckIds] = React.useState<string[]>([])
  const [newDeckName, setNewDeckName] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isFetchingDecks, setIsFetchingDecks] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    async function fetchDecks() {
      if (isOpen) {
        setIsFetchingDecks(true)
        try {
          const decks = await getDecks(supabase)
          console.log("Fetched decks for merge dialog:", decks)
          setAllDecks(decks)
        } catch (error) {
          console.error("Failed to fetch decks:", error)
          toast.error("Failed to load decks for merging.")
        } finally {
          setIsFetchingDecks(false)
        }
      }
    }
    fetchDecks()
  }, [isOpen])

  const handleDeckSelection = (deckId: string) => {
    console.log(`Toggle selection for deck ID: ${deckId}`)
    setSelectedDeckIds((prevSelected) => {
      const newSelection = prevSelected.includes(deckId)
        ? prevSelected.filter((id) => id !== deckId)
        : [...prevSelected, deckId]
      console.log('Updated selection:', newSelection)
      return newSelection
    })
  }

  const handleMerge = async () => {
    if (selectedDeckIds.length < 2) {
      toast.error("Please select at least two decks to merge.")
      return
    }
    if (!newDeckName.trim()) {
      toast.error("Please enter a name for the new merged deck.")
      return
    }

    console.log("Starting merge with selected deck IDs:", selectedDeckIds)
    setIsLoading(true)
    const toastId = toast.loading("Merging decks...")
    try {
      const newDeck = await mergeDecksAction(supabase, selectedDeckIds, newDeckName.trim(), "Merged deck", "merged")
      console.log("Merge result:", newDeck)
      
      if (newDeck) {
        toast.success(`Decks merged into "${newDeck.name}"!`, { id: toastId })
        setSelectedDeckIds([])
        setNewDeckName("")
        onOpenChange(false)
        if (onMergeSuccess) {
          onMergeSuccess()
        } else {
          // Force a complete refresh to ensure we get updated data
          window.location.reload()
        }
      } else {
        toast.error("Failed to merge decks. Please try again.", { id: toastId })
      }
    } catch (error) {
      console.error("Error merging decks:", error)
      toast.error("An unexpected error occurred while merging decks.", { id: toastId })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] overflow-hidden">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <Combine className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl">Merge Decks</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Combine multiple decks into a single new deck. Your original decks will remain unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-6">
          {/* New Deck Name Input */}
          <div>
            <Label htmlFor="newDeckName" className="text-sm font-medium mb-2 block">
              New Deck Name
            </Label>
            <div className="relative">
              <Input
                id="newDeckName"
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                className="pl-10"
                placeholder="e.g., Combined Science Topics"
                disabled={isLoading}
              />
              <Combine className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          {/* Selected Count Badge */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Select Decks to Merge</Label>
            {selectedDeckIds.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedDeckIds.length} selected
              </Badge>
            )}
          </div>

          {/* Deck Selection Area */}
          <div className="border rounded-lg overflow-hidden">
            {/* Search Filter - Optional */}
            <div className="border-b p-2 bg-muted/30">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter decks..."
                  className="pl-8 h-9 bg-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isLoading || isFetchingDecks}
                />
              </div>
            </div>

            {/* Deck List */}
            {isFetchingDecks ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Loading decks...</span>
              </div>
            ) : allDecks.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No decks available to merge.</p>
              </div>
            ) : (
              <ScrollArea className="h-[240px]">
                <div className="p-2 space-y-1">
                  {allDecks
                    .filter(deck => 
                      searchQuery.trim() === '' || 
                      deck.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((deck) => (
                      <div 
                        key={String(deck.id)} 
                        className={cn(
                          "flex items-center space-x-3 p-2 rounded-md transition-colors",
                          "hover:bg-muted/50 cursor-pointer",
                          selectedDeckIds.includes(String(deck.id)) && "bg-primary/10"
                        )}
                        onClick={() => handleDeckSelection(String(deck.id))}
                      >
                        <div className="flex-shrink-0">
                          <Checkbox
                            id={`deck-${String(deck.id)}`}
                            checked={selectedDeckIds.includes(String(deck.id))}
                            onCheckedChange={() => handleDeckSelection(String(deck.id))}
                            disabled={isLoading}
                            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={`deck-${String(deck.id)}`}
                            className="block text-sm font-medium truncate cursor-pointer"
                          >
                            {deck.name}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {String(deck.card_count || 0)} cards
                          </p>
                        </div>
                        {selectedDeckIds.includes(String(deck.id)) && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                    ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2 border-t">
          <div className="w-full flex items-center justify-between gap-4 flex-row-reverse sm:flex-row">
            <Button 
              onClick={handleMerge} 
              disabled={isLoading || isFetchingDecks || selectedDeckIds.length < 2 || !newDeckName.trim()}
              className="flex-1 sm:flex-none gap-2"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Combine className="h-4 w-4" /> 
                  Merge {selectedDeckIds.length >= 2 ? selectedDeckIds.length : ""} Decks
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={isLoading}
              size="lg"
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
