"use client";

import { Sidebar } from "@/components/sidebar";
import { LanguageStudyMode } from "@/components/language-study-mode";
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useEffect } from 'react';

export default function LanguageStudyPage() {
  const params = useParams();
  const router = useRouter();
  const { session, isLoading } = useAuth();
  // Ensure params.id is treated as a string, as that's what useParams returns.
  // The Number() conversion will handle it appropriately.
  const deckIdString = Array.isArray(params.id) ? params.id[0] : params.id;
  const deckId = Number(deckIdString);

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/'); // Redirect to login or home page
    }
  }, [session, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black/5">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // User not logged in, show message or redirect (already handled by useEffect, but good for clarity)
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  // Existing check for invalid deckId, now only runs if user is logged in
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