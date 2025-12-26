"use client"

import * as React from "react"
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  Earth,
} from "lucide-react"
import NextLink from "next/link"

import { NavMain } from "@/components/notes/nav-main"
import { NavSearch } from "@/components/notes/nav-search"
import { NavDecks } from "@/components/notes/nav-decks"
import { NavModels } from "@/components/notes/nav-models"
import { NavUser } from "@/components/notes/nav-user"
import { TeamSwitcher } from "@/components/notes/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import { isOnline, loadTasksMeta } from "@/lib/offline"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { ImportMarkdownDialog } from "@/components/import-markdown-dialog"
import { GenerateFlashcardsDialog } from "@/components/generate-flashcards-dialog"
import { MergeDecksDialog } from "@/components/merge-decks-dialog"
import { CreateModelDialog } from "@/components/create-model-dialog"
// Calendar date picker removed per request

// This is sample data.
const data = {
  teams: [
    {
      name: "Acme Inc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Links",
      url: "#",
      icon: Earth,
      isActive: true,
      items: [
        {
          title: "Home",
          url: "/home",
        },
        {
          title: "Files",
          url: "/files",
        },
        {
          title: "Decks",
          url: "/",
        },
        {
          title: "Notes",
          url: "/notes",
        },
        {
          title: "Stream",
          url: "/stream",
        },
        {
          title: "Statistics",
          url: "/study/stats",
        },
        {
          title: "Account",
          url: "/account",
        },
        {
          title: "Essay",
          url: "/essay",
        },
        {
          title: "Exam Questions",
          url: "/question",
        },
      ],
    },
    {
      title: "Notes",
      url: "#",
      icon: SquareTerminal,
      items: [
        {
          title: "History",
          url: "#",
        },
        {
          title: "Starred",
          url: "#",
        },
        {
          title: "Settings",
          url: "#",
        },
      ],
    },
    {
      title: "School",
      url: "#",
      icon: BookOpen,
      items: [
        {
          title: "Google Classroom",
          url: "https://classroom.google.com/",
        },
        {
          title: "Edulink",
          url: "https://www12.edulinkone.com/#!/",
        },
        {
          title: "Google Drive",
          url: "https://drive.google.com/",
        },
        {
          title: "Daos",
          url: "https://damealiceowens.herts.sch.uk/",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "#",
        },
        {
          title: "Team",
          url: "#",
        },
        {
          title: "Billing",
          url: "#",
        },
        {
          title: "Limits",
          url: "#",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()
  const [isCreateDeckOpen, setIsCreateDeckOpen] = React.useState(false)
  const [isImportOpen, setIsImportOpen] = React.useState(false)
  const [isGenerateOpen, setIsGenerateOpen] = React.useState(false)
  const [isMergeDecksOpen, setIsMergeDecksOpen] = React.useState(false)
  const [isCreateModelOpen, setIsCreateModelOpen] = React.useState(false)
  // manage mutually exclusive expanded sections
  const [openSection, setOpenSection] = React.useState<
    null | "search" | "decks" | "models"
  >("search")
  const today = React.useMemo(() => new Date(), [])
  const weekday = React.useMemo(
    () => today.toLocaleDateString(undefined, { weekday: "long" }),
    [today]
  )
  const dateStr = React.useMemo(
    () =>
      today.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [today]
  )
  const [upcomingTasks, setUpcomingTasks] = React.useState<
    { id: number; subject: string | null; due_date: string | null }[]
  >([])
  const supabase = React.useMemo(() => createClient(), [])
  React.useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!user?.id) return
      if (!isOnline()) {
        const metas = await loadTasksMeta(user.id)
        const pending = metas.filter(m => m.done !== true)
        pending.sort((a, b) => {
          const da = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER
          const db = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER
          if (da !== db) return da - db

          const pa = a.priority || 0
          const pb = b.priority || 0
          return pb - pa
        })
        if (!mounted) return
        setUpcomingTasks(pending.slice(0, 5).map(m => ({ id: Number(m.id), subject: m.subject, due_date: m.due_date })))
        return
      }
      const { data, error } = await supabase
        .from('homework')
        .select('id, subject, due_date, done, priority')
        .eq('user_id', user.id)
        .eq('done', false)
        // include overdue items as well; show soonest first
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false, nullsFirst: false })
        .limit(5)
      if (!mounted) return
      if (error) {
        setUpcomingTasks([])
        return
      }
      setUpcomingTasks((data as any[])?.map((r) => ({
        id: r.id,
        subject: r.subject ?? null,
        due_date: r.due_date ?? null,
      })) || [])
    }
    run()
    const onFocus = () => run()
    window.addEventListener('focus', onFocus)
    return () => { mounted = false; window.removeEventListener('focus', onFocus) }
  }, [supabase, user?.id])

  // Listen for Action Search Bar events to open dialogs
  React.useEffect(() => {
    const openCreate = () => setIsCreateDeckOpen(true)
    const openImport = () => setIsImportOpen(true)
    const openGenerate = () => setIsGenerateOpen(true)
    const openMerge = () => setIsMergeDecksOpen(true)
    const openCreateModel = () => setIsCreateModelOpen(true)
    window.addEventListener('open-create-deck', openCreate as EventListener)
    window.addEventListener('open-import-markdown', openImport as EventListener)
    window.addEventListener('open-generate-flashcards', openGenerate as EventListener)
    window.addEventListener('open-merge-decks', openMerge as EventListener)
    window.addEventListener('open-create-model', openCreateModel as EventListener)
    return () => {
      window.removeEventListener('open-create-deck', openCreate as EventListener)
      window.removeEventListener('open-import-markdown', openImport as EventListener)
      window.removeEventListener('open-generate-flashcards', openGenerate as EventListener)
      window.removeEventListener('open-merge-decks', openMerge as EventListener)
      window.removeEventListener('open-create-model', openCreateModel as EventListener)
    }
  }, [])
  const navUser = React.useMemo(
    () => ({
      name:
        (user as any)?.user_metadata?.full_name ||
        (user as any)?.user_metadata?.name ||
        (user?.email ? user.email.split("@")[0] : "User"),
      email: user?.email || "",
      avatar:
        (user as any)?.user_metadata?.avatar_url ||
        (user as any)?.user_metadata?.picture ||
        "",
    }),
    [user]
  )
  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <TeamSwitcher />
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={data.navMain} />
          <NavSearch
            expanded={openSection === "search"}
            onToggle={() =>
              setOpenSection((s) => (s === "search" ? null : "search"))
            }
          />
          <NavDecks
            expanded={openSection === "decks"}
            onToggle={() =>
              setOpenSection((s) => (s === "decks" ? null : "decks"))
            }
          />
          <NavModels
            expanded={openSection === "models"}
            onToggle={() =>
              setOpenSection((s) => (s === "models" ? null : "models"))
            }
          />
        </SidebarContent>
        <SidebarFooter>
          {/* Fixed Agenda panel */}
          <div className="w-full px-2 pt-2 border-t group-data-[collapsible=icon]:hidden">
            <NextLink href="/tasks" className="block">
              <div className="rounded-lg border bg-muted/30 backdrop-blur p-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium">
                    {weekday}
                  </span>
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight leading-snug">
                  {dateStr}
                </div>

                <div className="mt-3">
                  <div className="text-xs font-medium text-foreground/90">Upcoming</div>
                  <ul className="mt-1 max-h-28 overflow-auto divide-y divide-border rounded-md">
                    {upcomingTasks.length === 0 ? (
                      <li className="py-2 px-2 text-xs text-muted-foreground">No upcoming tasks</li>
                    ) : (
                      upcomingTasks.map((t) => (
                        <li
                          key={t.id}
                          className="py-2 px-2 text-xs hover:bg-muted/50 transition-colors"
                          title={t.subject || undefined}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{t.subject || 'Homework'}</span>
                            {t.due_date ? (() => {
                              const d = new Date(t.due_date)
                              const overdue = d.getTime() < Date.now()
                              return (
                                <span className={"shrink-0 text-[10px] " + (overdue ? "text-red-600" : "text-muted-foreground")}>{d.toLocaleDateString()}</span>
                              )
                            })() : null}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </NextLink>
          </div>
          <NavUser user={navUser} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* Dialogs controlled by global Action Search Bar events */}
      <CreateDeckDialog open={isCreateDeckOpen} onOpenChange={setIsCreateDeckOpen} />
      <ImportMarkdownDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      <GenerateFlashcardsDialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen} />
      <MergeDecksDialog isOpen={isMergeDecksOpen} onOpenChange={setIsMergeDecksOpen} />
      <CreateModelDialog open={isCreateModelOpen} onOpenChange={setIsCreateModelOpen} />
    </>
  )
}
