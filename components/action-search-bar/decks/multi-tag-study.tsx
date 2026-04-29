"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  Tag, 
  X, 
  Play, 
  Search, 
  ChevronDown, 
  Check,
  Plus,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { getDueCardsByMultipleTags, getAllUniqueTags } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";

interface MultiTagStudyProps {
  onClose: () => void;
  onBack: () => void;
}

export function MultiTagStudy({ onClose, onBack }: MultiTagStudyProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const tags = await getAllUniqueTags(supabase);
      setAvailableTags(tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      toast.error("Failed to load tags");
    }
  };

  const filteredTags = availableTags.filter(tag => 
    tag.toLowerCase().includes(searchQuery.toLowerCase()) && 
    !selectedTags.includes(tag)
  );

  const handleAddTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
      setSearchQuery("");
      setShowTagDropdown(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const handleStudy = async () => {
    if (selectedTags.length === 0) {
      toast.error("Please select at least one tag");
      return;
    }

    setIsLoading(true);
    try {
      const cards = await getDueCardsByMultipleTags(supabase, selectedTags);
      
      if (cards.length === 0) {
        toast.info("No due cards found with selected tags");
        setIsLoading(false);
        return;
      }

      // Store the selected tags in sessionStorage for the study session
      sessionStorage.setItem('studyTags', JSON.stringify(selectedTags));
      
      // Navigate to study session with tag information
      router.push(`/study/tags?tags=${encodeURIComponent(selectedTags.join(','))}`);
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
        if (showTagDropdown) {
          setShowTagDropdown(false);
        } else {
          onBack();
        }
      } else if (e.key === "Enter" && !showTagDropdown) {
        e.preventDefault();
        handleStudy();
      } else if (e.key === "Backspace" && searchQuery === "" && selectedTags.length > 0) {
        // Remove last tag on backspace when search is empty
        handleRemoveTag(selectedTags[selectedTags.length - 1]);
      }
    },
    [selectedTags, searchQuery, showTagDropdown, onBack]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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
        <Tag
          size={16}
          className="text-muted-foreground shrink-0"
          strokeWidth={1.5}
        />
        <span className="text-sm font-medium text-foreground">Study by Tags</span>
        <button
          onClick={onClose}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Tag Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Select tags to study
          </label>
          <div className="relative">
            <div className="flex flex-wrap gap-2 p-3 border border-border rounded-lg bg-background min-h-[48px] items-center">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded-full text-xs font-medium"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
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
                  setShowTagDropdown(true);
                }}
                onFocus={() => setShowTagDropdown(true)}
                placeholder={selectedTags.length === 0 ? "Type to search tags..." : "Add more tags..."}
                className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Tag Dropdown */}
            <AnimatePresence>
              {showTagDropdown && filteredTags.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto z-10"
                >
                  {filteredTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleAddTag(tag)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg"
                    >
                      <Tag size={14} className="text-muted-foreground" />
                      <span>{tag}</span>
                      <Plus size={14} className="ml-auto text-muted-foreground" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Selected Tags Summary */}
        {selectedTags.length > 0 && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Selected {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''}:{" "}
              <span className="font-medium text-foreground">
                {selectedTags.join(", ")}
              </span>
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Type to search for tags</p>
          <p>• Click on a tag to add it</p>
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
            disabled={selectedTags.length === 0 || isLoading}
            className="flex items-center gap-1.5 text-sm font-medium border border-border rounded-lg px-3 py-1.5 bg-background hover:bg-muted transition-colors text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play size={13} strokeWidth={2} />
            )}
            Study {selectedTags.length > 0 && `${selectedTags.length} tag${selectedTags.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
