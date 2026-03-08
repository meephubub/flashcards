"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { StudyMode } from "@/components/study-mode";
import { AppSidebar } from "@/components/notes/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { isOnline, loadDecksMeta } from "@/lib/offline";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useTimeTracking } from "@/hooks/use-time-tracking";

export function StudyPageClient({ deckId }: { deckId: number }) {
  const { session, isLoading, user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [deckTitle, setDeckTitle] = useState<string>("");
  const [progressInfo, setProgressInfo] = useState<{
    current: number;
    total: number;
    reviewMode: boolean;
    reviewCurrent: number;
    reviewTotal: number;
    remaining: number;
    correct: number;
    wrong: number;
  } | null>(null);
  const [initialSide, setInitialSide] = useState<"front" | "back" | "mixed">("front");

  useTimeTracking({
    activityType: 'study',
    subjectId: deckId,
    isEnabled: !Number.isNaN(deckId) && !!user
  });

  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/");
    }
  }, [session, isLoading, router]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!user?.id || !deckId || Number.isNaN(deckId)) {
        if (mounted) setDeckTitle("");
        return;
      }
      if (!isOnline()) {
        const metas = await loadDecksMeta(user.id);
        const found = metas.find((m) => m.id === deckId);
        if (mounted) setDeckTitle(found?.name || "");
        return;
      }
      const { data, error } = await supabase
        .from("decks")
        .select("name")
        .eq("id", deckId)
        .eq("user_id", user.id)
        .single();
      if (!mounted) return;
      if (error) setDeckTitle("");
      else setDeckTitle((data?.name as string) || "");
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [supabase, user?.id, deckId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-black">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-black">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  if (Number.isNaN(deckId)) {
    return (
      <div className="flex h-screen bg-white text-black">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="sticky top-0 z-20 flex h-14 items-center border-b border-black/10 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
              <div className="flex items-center gap-2 px-3 text-sm text-neutral-600">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="/">Decks</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Invalid Deck</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex-1 overflow-auto">
              <div className="mx-auto w-full max-w-4xl px-4 py-8">
                <div className="rounded-md border border-black/10 p-4">
                  <p className="text-sm text-neutral-600">Invalid Deck ID.</p>
                </div>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-black">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-14 items-center border-b border-black/10 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="flex items-center gap-2 px-3 text-sm text-neutral-600 w-full">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">Decks</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{deckTitle || `Deck #${deckId}`}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto flex items-center gap-2 pr-1">
                {progressInfo && (
                  <div className="text-xs text-neutral-600 border border-black/10 rounded-md px-2 py-1">
                    Remaining: {progressInfo.remaining}
                    <span className="mx-1">•</span>
                    Correct: {progressInfo.correct}
                    <span className="mx-1">•</span>
                    Wrong: {progressInfo.wrong}
                  </div>
                )}
                <Select value={initialSide} onValueChange={(v) => setInitialSide(v as any)}>
                  <SelectTrigger className="h-8 w-[150px] rounded-md border-black/10 text-xs">
                    <SelectValue placeholder="Card side" />
                  </SelectTrigger>
                  <SelectContent className="text-sm">
                    <SelectItem value="front">Front first</SelectItem>
                    <SelectItem value="back">Back first</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-4xl px-4 py-8">
              <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{deckTitle || `Deck #${deckId}`}</h1>
              </div>
              <div className="rounded-lg border border-black/10 shadow-sm">
                <div className="p-4 md:p-8">
                  <StudyMode deckId={deckId} onProgressInfo={setProgressInfo} initialSide={initialSide} />
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
