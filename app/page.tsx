"use client"

import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Sidebar } from "@/components/sidebar"
import { DeckGrid } from "@/components/deck-grid"

export default function Home() {
  const { session, isLoading, error: authError, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    await signIn(email, password);
    // The router.refresh() might not be needed here if onAuthStateChange handles UI updates sufficiently.
    // However, if you have server components that need to re-fetch data based on auth state, it can be useful.
    // For now, let's keep it to ensure immediate refresh of any server-side data.
    router.refresh(); 
  };

  // Use authError from context if it's relevant to the form, or manage form-specific errors with setFormError
  useEffect(() => {
    if (authError) {
      setFormError(authError);
    }
  }, [authError]);

  if (isLoading) { // isLoading from useAuth()
    return (
      <div className="flex items-center justify-center min-h-screen bg-black/5">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen bg-[#f5f5f7]">
      {!session && !isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md p-8 mx-4 bg-white rounded-lg shadow-xl">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
              <p className="mt-2 text-sm text-gray-600">Sign in to access your flashcard decks</p>
            </div>
            
            {(formError || authError) && (
              <div className="p-3 mt-4 text-sm text-red-700 bg-red-100 rounded-md">
                {formError || authError}
              </div>
            )}

            <form className="mt-6 space-y-6" onSubmit={handleSignIn}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 mt-1 text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
                />
              </div>

              <div>
                <button
                  type="submit"
                  className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-black border border-transparent rounded-md shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
                >
                  Sign in
                </button>
              </div>
            </form>

            <p className="mt-4 text-sm text-center text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => router.push('/signup')}
                className="font-medium text-black hover:text-gray-700"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      )}

      <Sidebar />
      <main className={`flex-1 p-6 overflow-auto ${!session ? 'opacity-30 pointer-events-none' : ''}`}>
        <DeckGrid />
      </main>
    </div>
  )
}
