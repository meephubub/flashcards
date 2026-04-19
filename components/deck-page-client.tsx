"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { DeckView } from "@/components/deck-view";
import { AppSidebar } from "@/components/notes/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
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

export function DeckPageClient({ deckId }: { deckId: number }) {
  const { session, isLoading, user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [deckTitle, setDeckTitle] = useState<string>("");
  const [deckTag, setDeckTag] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/");
    }
  }, [session, isLoading, router]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!user?.id || !deckId || Number.isNaN(deckId)) {
        if (mounted) {
          setDeckTitle("");
          setDeckTag(null);
        }
        return;
      }
      if (!isOnline()) {
        const metas = await loadDecksMeta(user.id);
        const found = metas.find((m) => m.id === deckId);
        if (mounted) {
          setDeckTitle(found?.name || "");
          setDeckTag(found?.tag || null);
        }
        return;
      }
      const { data, error } = await supabase
        .from("decks")
        .select("name, tag")
        .eq("id", deckId)
        .eq("user_id", user.id)
        .single();
      if (!mounted) return;
      if (error) {
        setDeckTitle("");
        setDeckTag(null);
      } else {
        setDeckTitle((data?.name as string) || "");
        setDeckTag((data?.tag as string) || null);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [supabase, user?.id, deckId]);

  const tagParts = deckTag ? deckTag.split('/') : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <p className="text-xs text-zinc-400">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-black">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-100 dark:border-zinc-900 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">Decks</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  
                  {tagParts.map((part, index) => (
                    <React.Fragment key={index}>
                      <BreadcrumbItem className="hidden md:block">
                        <BreadcrumbLink href={`/?path=${tagParts.slice(0, index + 1).join('/')}`}>
                          {part}
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden md:block" />
                    </React.Fragment>
                  ))}

                  <BreadcrumbItem>
                    <BreadcrumbPage>{deckTitle || `Deck #${deckId}`}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex-1 p-6 overflow-auto">
            <DeckView deckId={deckId} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
