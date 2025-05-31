"use client";

import { useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Sidebar } from "@/components/sidebar"
import { ExamMode } from "@/components/exam-mode"

export default function ExamPage({ params }: { params: { id: string } }) {
  const deckId = Number.parseInt(params.id);
  const { session, isLoading } = useAuth();
  const router = useRouter();

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

  if (!session) {
    // This will be briefly shown before redirection, or if redirection fails
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  // Only render if session exists
  return session ? (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <ExamMode deckId={deckId} />
      </main>
    </div>
  ) : null; // Or some fallback UI if session is null after loading
}
