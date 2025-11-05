"use client";

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { DeckEditor } from "@/components/deck-editor"
import { AppSidebar } from "@/components/notes/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/client"
import { isOnline, loadDecksMeta } from "@/lib/offline"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default function EditDeckPage({ params }: { params: { id: string } }) {
  const deckId = Number.parseInt(params.id);
  const { session, isLoading, user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [deckTitle, setDeckTitle] = useState<string>("");

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/'); // Redirect to login or home page
    }
  }, [session, isLoading, router]);

  // Fetch deck title for breadcrumb when user and deckId are available
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!user?.id || !deckId || Number.isNaN(deckId)) {
        if (mounted) setDeckTitle("");
        return;
      }
      if (!isOnline()) {
        const metas = await loadDecksMeta(user.id)
        const found = metas.find((m) => m.id === deckId)
        if (mounted) setDeckTitle(found?.name || "")
        return
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
    return () => { mounted = false };
  }, [supabase, user?.id, deckId]);

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
          </header>
          <div className="flex-1 p-6 overflow-auto">
            <DeckEditor deckId={deckId} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  ) : null; // Or some fallback UI if session is null after loading
}
