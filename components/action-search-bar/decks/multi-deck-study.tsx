"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  Library, 
  X, 
  Play, 
  Search, 
  ChevronDown, 
  Check,
  Plus,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { getDueCardsByMultipleDecks } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { useDecks } from "@/context/deck-context";

interface MultiDeckStudyProps {
  onClose: () => void;
  onBack: () => void;
}

export function MultiDeckStudy({ onClose, onBack }: MultiDeckStudyProps) {
  const [selectedDecks, setSelectedDecks] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showDeckDropdown, setShowDeckDropdown] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { decks } = useDecks();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredDecks = decks.filter(deck => 
    deck.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
    !selectedDecks.includes(deck.id)
  );

  const handleAddDeck = (deckId: number) => {
    if (!selectedDecks.includes(deckId)) {
      setSelectedDecks([...selectedDecks, deckId]);
      setSearchQuery("");
      setShowDeckDropdown(false);
    }
  };

  const handleRemoveDeck = (deckIdToRemove: number) => {
    setSelectedDecks(selectedDecks.filter(deckId => deckId !== deckIdToRemove));
  };

  const handleStudy = async () => {
    if (selectedDecks.length === 0) {
      toast.error("Please select at least one deck");
      return;
    }

    setIsLoading(true);
    try {
      const cards = await getDueCardsByMultipleDecks(supabase, selectedDecks);
      
      if (cards.length === 0) {
        toast.info("No due cards found in selected decks");
        setIsLoading(false);
        return;
      }

      // Store the selected deck IDs in sessionStorage for the study session
      sessionStorage.setItem('studyDecks', JSON.stringify(selectedDecks));
      
      // Navigate to study session with deck information
      router.push(`/study/decks?decks=${encodeURIComponent(selectedDecks.join(','))}`);
      onClose();
    } catch (error) {
      console.error("Error starting study session:", error);
      toast.error("Failed to start study session");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDeckDropdown) {
          setShowDeckDropdown(false);
        } else {
          onBack();
        }
      } else if (e.key === "Enter" && !showDeckDropdown) {
        e.preventDefault();
        handleStudy();
      } else if (e.key === "Backspace" && searchQuery === "" && selectedDecks.length > 0) {
        // Remove last deck on backspace when search is empty
        handleRemoveDeck(selectedDecks[selectedDecks.length - 1]);
      }
    },
    [selectedDecks, searchQuery, showDeckDropdown, onBack]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const getDeckName = (deckId: number) => {
    const deck = decks.find(d => d.id === deckId);
    return deck?.name || `Deck #${deckId}`;
  };

  const getDeckCardCount = (deckId: number) => {
    const deck = decks.find(d => d.id === deckId);
    return deck?.cards?.length || 0;
  };

  return (
    <div className="w-[600px] max-w-[95vw] flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        <Library
          size={16}
          className="text-muted-foreground shrink-0"
          strokeWidth={1.5}
        />
        <span className="text-sm font-medium text-foreground">Study Multiple Decks</span>
        <button
          onClick={onClose}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Deck Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Select decks to study
          </label>
          <div className="relative">
            <div className="flex flex-wrap gap-2 p-3 border border-border rounded-lg bg-background min-h-[48px] items-center">
              {selectedDecks.map((deckId) => (
                <span
                  key={deckId}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded-full text-xs font-medium"
                >
                  {getDeckName(deckId)}
                  <button
                    onClick={() => handleRemoveDeck(deckId)}
                    className="hover:bg-primary/80 rounded-full p-0.5 transition-colors"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDeckDropdown(true);
                }}
                onFocus={() => setShowDeckDropdown(true)}
                placeholder={selectedDecks.length === 0 ? "Type to search decks..." : "Add more decks..."}
                className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Deck Dropdown */}
            <AnimatePresence>
              {showDeckDropdown && filteredDecks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto z-10"
                >
                  {filteredDecks.map((deck) => (
                    <button
                      key={deck.id}
                      onClick={() => handleAddDeck(deck.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg"
                    >
                      <Library size={14} className="text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <span className="truncate">{deck.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {getDeckCardCount(deck.id)} cards
                        </span>
                      </div>
                      <Plus size={14} className="text-muted-foreground" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Selected Decks Summary */}
        {selectedDecks.length > 0 && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Selected {selectedDecks.length} deck{selectedDecks.length !== 1 ? 's' : ''}:{" "}
              <span className="font-medium text-foreground">
                {selectedDecks.map(getDeckName).join(", ")}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total cards: {selectedDecks.reduce((sum, deckId) => sum + getDeckCardCount(deckId), 0)}
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Type to search for decks</p>
          <p>• Click on a deck to add it</p>
          <p>• Press Enter to start studying</p>
          <p>• Press Escape to go back</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-border bg-muted/40">
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </button>
        <div className="ml-auto">
          <button
            onClick={handleStudy}
            disabled={selectedDecks.length === 0 || isLoading}
            className="flex items-center gap-1.5 text-sm font-medium border border-border rounded-lg px-3 py-1.5 bg-background hover:bg-muted transition-colors text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play size={13} strokeWidth={2} />
            )}
            Study {selectedDecks.length > 0 && `${selectedDecks.length} deck${selectedDecks.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
