"use client";

import { LanguageStudyMode } from "@/components/language-study-mode";
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useEffect, useMemo, useState } from 'react';
import { AppSidebar } from "@/components/notes/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function LanguageStudyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tag = searchParams.get('tag') || undefined;
  const router = useRouter();
  const { session, isLoading, user } = useAuth();
  // Ensure params.id is treated as a string, as that's what useParams returns.
  // The Number() conversion will handle it appropriately.
  const deckIdString = Array.isArray(params.id) ? params.id[0] : params.id;
  const deckId = Number(deckIdString);
  const supabase = useMemo(() => createClient(), []);
  const [deckTitle, setDeckTitle] = useState<string>("");
  const [metrics, setMetrics] = useState<{ streak: number; current: number; total: number; progress: number }>({ streak: 0, current: 1, total: 1, progress: 0 });

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/'); // Redirect to login or home page
    }
  }, [session, isLoading, router]);

  // Fetch deck title for breadcrumb
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!user?.id || !deckId || Number.isNaN(deckId)) {
        if (mounted) setDeckTitle("");
        return;
      }
      const { data, error } = await supabase
        .from("decks")
        .select("name")
        .eq("id", deckId)
        .eq("user_id", user.id)
        .single();
      if (!mounted) return;
      if (error) setDeckTitle(""); else setDeckTitle((data?.name as string) || "");
    };
    void run();
    return () => { mounted = false };
  }, [supabase, user?.id, deckId]);

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
            <div className="flex-1 p-6 overflow-auto">
              <p>Invalid Deck ID.</p>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f5f5f7]">
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
                    <BreadcrumbLink href="/">Decks</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{deckTitle || `Deck #${deckId}`}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            {/* Right-aligned metrics inline with breadcrumb */}
            <div className="ml-auto mr-4 flex items-center gap-4">
              <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Streak: {metrics.streak} 🔥</div>
              <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Card {metrics.current} of {metrics.total}</div>
            </div>
          </header>
          {/* Thin progress bar under header */}
          <div className="px-4">
            <div className="h-1 w-full bg-muted rounded">
              <div className="h-1 bg-primary rounded" style={{ width: `${Math.min(100, Math.max(0, metrics.progress))}%` }} />
            </div>
          </div>
          <div className="flex-1 p-6 overflow-auto">
            <LanguageStudyMode deckId={deckId} tag={tag} compactHeader onMetricsChange={setMetrics} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}