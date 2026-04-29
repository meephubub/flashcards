"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDueCardsByMultipleTags } from "@/lib/data";
import { toast } from "sonner";
import { Card } from "@/lib/supabase";
import { StudySession } from "@/components/study-session";

export function StudyTagsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    const tagsParam = searchParams.get("tags");
    if (!tagsParam) {
      toast.error("No tags specified");
      router.push("/");
      return;
    }

    const parsedTags = tagsParam.split(",").map(tag => decodeURIComponent(tag.trim()));
    setTags(parsedTags);

    fetchCards(parsedTags);
  }, [searchParams, router]);

  const fetchCards = async (tagsToStudy: string[]) => {
    try {
      const supabase = createClient();
      const dueCards = await getDueCardsByMultipleTags(supabase, tagsToStudy);
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
            There are no due cards with the selected tags: {tags.join(", ")}
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
          type: "tags",
          identifiers: tags,
          title: `Study: ${tags.join(", ")}`
        }}
      />
    </div>
  );
}
