"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDueCardsByMultipleDecks } from "@/lib/data";
import { toast } from "sonner";
import { Card } from "@/lib/supabase";
import { StudySession } from "@/components/study-session";

export default function StudyDecksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deckIds, setDeckIds] = useState<number[]>([]);

  useEffect(() => {
    const decksParam = searchParams.get("decks");
    if (!decksParam) {
      toast.error("No decks specified");
      router.push("/");
      return;
    }

    const parsedDeckIds = decksParam.split(",").map(id => parseInt(decodeURIComponent(id.trim())));
    if (parsedDeckIds.some(isNaN)) {
      toast.error("Invalid deck IDs");
      router.push("/");
      return;
    }

    setDeckIds(parsedDeckIds);

    fetchCards(parsedDeckIds);
  }, [searchParams, router]);

  const fetchCards = async (deckIdsToStudy: number[]) => {
    try {
      const supabase = createClient();
      const dueCards = await getDueCardsByMultipleDecks(supabase, deckIdsToStudy);
      setCards(dueCards);
    } catch (error) {
      console.error("Error fetching cards:", error);
      toast.error("Failed to load cards");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-semibold text-foreground mb-4">
            No cards to study
          </h1>
          <p className="text-muted-foreground mb-6">
            There are no due cards in the selected decks ({deckIds.length} deck{deckIds.length !== 1 ? 's' : ''})
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <StudySession 
        cards={cards} 
        sessionInfo={{
          type: "decks",
          identifiers: deckIds,
          title: `Study: ${deckIds.length} deck${deckIds.length !== 1 ? 's' : ''}`
        }}
      />
    </div>
  );
}
