"use client";

import Script from 'next/script';
import { useEffect } from 'react'; 
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

export default function AgentPage() {
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
    <>
      <Script
        src="https://cdn.jsdelivr.net/gh/logspace-ai/langflow-embedded-chat@v1.0.7/dist/build/static/js/bundle.min.js"
        strategy="afterInteractive"
      />
      <langflow-chat
        window_title="Search agent"
        flow_id="a722ff6b-92bd-4d78-8b0c-c906bd261fe9"
        host_url="https://astra.datastax.com"
      ></langflow-chat>
    </>
  ) : null; // Or some fallback UI if session is null after loading
}