"use client"

import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { AppSidebar } from "@/components/notes/app-sidebar"
import { Dashboard } from "@/components/dashboard"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default function HomeClient() {
    const { session, isLoading, error: authError, signIn, signUp } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);
    const router = useRouter();
    const [showAuthModal, setShowAuthModal] = useState(false);

    useEffect(() => {
        if (!isLoading && !session) {
            setShowAuthModal(true);
        } else if (session) {
            setShowAuthModal(false);
        }
    }, [session, isLoading]);

    const handleAuth = async (e: FormEvent) => {
        e.preventDefault();
        setFormError(null);
        console.log('Form submitted:', { isSignUp, email });
        try {
            if (isSignUp) {
                console.log('Attempting sign up...');
                await signUp(email, password);
                // If we get here, sign up was successful
                setFormError('Please check your email for the confirmation link');
            } else {
                console.log('Attempting sign in...');
                await signIn(email, password);
                router.refresh();
            }
        } catch (error) {
            console.error('Auth operation failed:', error);
            setFormError(error instanceof Error ? error.message : 'An error occurred');
        }
    };

    // Use authError from context if it's relevant to the form, or manage form-specific errors with setFormError
    useEffect(() => {
        if (authError) {
            setFormError(authError);
        }
    }, [authError]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
                <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="relative flex h-screen bg-white dark:bg-black">
            {showAuthModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80">
                    <div className="w-full max-w-sm p-8 mx-4">
                        <div className="text-center mb-8">
                            <h2 className="text-lg font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
                                {isSignUp ? 'Create account' : 'Welcome back'}
                            </h2>
                            <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
                                {isSignUp ? 'Sign up to start studying' : 'Sign in to continue'}
                            </p>
                        </div>

                        {(formError || authError) && (
                            <div className="p-3 mb-4 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                {formError || authError}
                            </div>
                        )}

                        <form className="space-y-4" onSubmit={handleAuth}>
                            <div>
                                <label htmlFor="email" className="block text-[11px] uppercase tracking-widest font-bold text-zinc-400 dark:text-zinc-600 mb-2">
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
                                    className="block w-full h-10 px-3 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-colors"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-[11px] uppercase tracking-widest font-bold text-zinc-400 dark:text-zinc-600 mb-2">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete={isSignUp ? "new-password" : "current-password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full h-10 px-3 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-colors"
                                />
                            </div>

                            <button
                                type="submit"
                                className="flex w-full justify-center h-10 items-center rounded-lg text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                            >
                                {isSignUp ? 'Sign up' : 'Sign in'}
                            </button>
                        </form>

                        <p className="mt-6 text-xs text-center text-zinc-400 dark:text-zinc-600">
                            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                            <button
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
                            >
                                {isSignUp ? 'Sign in' : 'Sign up'}
                            </button>
                        </p>
                    </div>
                </div>
            )}

            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-100 dark:border-zinc-900 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                        <div className="flex items-center gap-2 px-4">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>Home</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>
                    <div className={`flex-1 overflow-auto ${!session ? 'opacity-20 pointer-events-none' : ''}`}>
                        <Suspense fallback={<div className="flex items-center justify-center h-32 text-zinc-400 text-sm">Loading decks…</div>}>
                            <Dashboard />
                        </Suspense>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </div>
    )
}
