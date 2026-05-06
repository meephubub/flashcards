"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth-context";
import { AppSidebar } from "@/components/notes/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "next-view-transitions";
import { Button } from "@/components/ui/button";
import { StudyMode } from "@/components/study-mode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PanelLeft } from "lucide-react";

function ShareSidebarTrigger({
  isSignedIn,
  onRequireSignIn,
}: {
  isSignedIn: boolean;
  onRequireSignIn: () => void;
}) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 -ml-1"
      onClick={() => {
        if (!isSignedIn) {
          onRequireSignIn();
          return;
        }
        toggleSidebar();
      }}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

export function SharedStudyPageClient({ token }: { token: string }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const [deck, setDeck] = useState<any | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const shareUrl = useMemo(() => `/share/${encodeURIComponent(token)}`, [token]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setFetchError(null);
        const res = await fetch(`/api/share/${encodeURIComponent(token)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const json = await res.json();
        if (!mounted) return;
        if (!res.ok) {
          setDeck(null);
          setFetchError(json?.error || "Failed to load shared deck");
          return;
        }
        setDeck(json?.deck ?? null);
      } catch (e: any) {
        if (!mounted) return;
        setDeck(null);
        setFetchError(e?.message || "Failed to load shared deck");
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        if (!session) {
          event.preventDefault();
          setShowAuth(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-black">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-xl px-4 py-16">
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold tracking-tight">Link unavailable</h1>
            <p className="mt-2 text-sm text-neutral-600">{fetchError}</p>
            <div className="mt-6">
              <Button onClick={() => router.push("/")} className="rounded-full">
                Back to Decks
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-black">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-black">
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen && !session) {
            setShowAuth(true);
            return;
          }
          setSidebarOpen(nextOpen);
        }}
      >
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-14 items-center border-b border-black/10 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="flex items-center gap-2 px-3 text-sm text-neutral-600 w-full">
              <ShareSidebarTrigger
                isSignedIn={!!session}
                onRequireSignIn={() => setShowAuth(true)}
              />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink asChild>
                      <Link href="/">Decks</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{deck?.name || "Shared Deck"}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto flex items-center gap-2 pr-1">
                <span className="text-xs text-neutral-400">practice</span>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto flex flex-col">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10 flex-1 flex flex-col justify-center">
              <StudyMode
                deckId={Number(deck.id)}
                deckOverride={deck}
                practice
                initialSide="front"
              />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <Dialog open={showAuth} onOpenChange={setShowAuth}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Sign in to open the sidebar</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-neutral-600">
            You can keep studying without an account. Sign in to access your sidebar and
            personal features.
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Button asChild className="rounded-full">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/signup">Create account</Link>
            </Button>
            <div className="pt-2 text-xs text-neutral-500">
              Link: <span className="font-mono">{shareUrl}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

