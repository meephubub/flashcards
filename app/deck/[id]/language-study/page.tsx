"use client";

import { Sidebar } from "@/components/sidebar";
import { LanguageStudyMode } from "@/components/language-study-mode";
import { useParams } from 'next/navigation';

export default function LanguageStudyPage() {
  const params = useParams();
  // Ensure params.id is treated as a string, as that's what useParams returns.
  // The Number() conversion will handle it appropriately.
  const deckIdString = Array.isArray(params.id) ? params.id[0] : params.id;
  const deckId = Number(deckIdString);

  if (isNaN(deckId)) {
    return (
      <div className="flex h-screen bg-[#f5f5f7]">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <p>Invalid Deck ID.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f5f5f7]">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <LanguageStudyMode deckId={deckId} />
      </main>
    </div>
  );
}