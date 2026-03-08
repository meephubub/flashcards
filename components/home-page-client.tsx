"use client"

import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { AppSidebar } from "@/components/notes/app-sidebar"
import { DeckGrid } from "@/components/deck-grid"
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
            <div className="flex items-center justify-center min-h-screen bg-black/5">
                <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="relative flex h-screen bg-[#f5f5f7]">
            {showAuthModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md p-8 mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {isSignUp ? 'Create Account' : 'Welcome Back'}
                            </h2>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                {isSignUp ? 'Sign up to start creating flashcards' : 'Sign in to access your flashcard decks'}
                            </p>
                        </div>

                        {(formError || authError) && (
                            <div className="p-3 mt-4 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-200 dark:text-red-800">
                                {formError || authError}
                            </div>
                        )}

                        <form className="mt-6 space-y-6" onSubmit={handleAuth}>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                    Email address
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white sm:text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                    Password
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        autoComplete={isSignUp ? "new-password" : "current-password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white sm:text-sm"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="flex w-full justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black dark:bg-white dark:text-black hover:bg-gray-900 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white"
                            >
                                {isSignUp ? 'Sign up' : 'Sign in'}
                            </button>
                        </form>

                        <p className="mt-4 text-sm text-center text-gray-600 dark:text-gray-300">
                            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                            <button
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="font-medium text-black dark:text-white hover:text-gray-700 dark:hover:text-gray-200"
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
                    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                        <div className="flex items-center gap-2 px-4">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem className="hidden md:block">
                                        <BreadcrumbLink href="#">Decks</BreadcrumbLink>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator className="hidden md:block" />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>All Decks</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>
                    <div className={`flex-1 p-6 overflow-auto ${!session ? 'opacity-30 pointer-events-none' : ''}`}>
                        <DeckGrid />
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </div>
    )
}
