"use client"

import * as React from "react"
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Link,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  Earth,
} from "lucide-react"

import { NavMain } from "@/components/notes/nav-main"
import { NavSearch } from "@/components/notes/nav-search"
import { NavDecks } from "@/components/notes/nav-decks"
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
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { ImportMarkdownDialog } from "@/components/import-markdown-dialog"
import { GenerateFlashcardsDialog } from "@/components/generate-flashcards-dialog"
import { MergeDecksDialog } from "@/components/merge-decks-dialog"

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
      title: "Notes",
      url: "#",
      icon: SquareTerminal,
      isActive: true,
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
      title: "Links",
      url: "#",
      icon: Earth,
      items: [
        {
          title: "Home",
          url: "/home",
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
          title: "Account",
          url: "/account",
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

  // Listen for Action Search Bar events to open dialogs
  React.useEffect(() => {
    const openCreate = () => setIsCreateDeckOpen(true)
    const openImport = () => setIsImportOpen(true)
    const openGenerate = () => setIsGenerateOpen(true)
    const openMerge = () => setIsMergeDecksOpen(true)
    window.addEventListener('open-create-deck', openCreate as EventListener)
    window.addEventListener('open-import-markdown', openImport as EventListener)
    window.addEventListener('open-generate-flashcards', openGenerate as EventListener)
    window.addEventListener('open-merge-decks', openMerge as EventListener)
    return () => {
      window.removeEventListener('open-create-deck', openCreate as EventListener)
      window.removeEventListener('open-import-markdown', openImport as EventListener)
      window.removeEventListener('open-generate-flashcards', openGenerate as EventListener)
      window.removeEventListener('open-merge-decks', openMerge as EventListener)
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
          <NavSearch />
          <NavDecks />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={navUser} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* Dialogs controlled by global Action Search Bar events */}
      <CreateDeckDialog open={isCreateDeckOpen} onOpenChange={setIsCreateDeckOpen} />
      <ImportMarkdownDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      <GenerateFlashcardsDialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen} />
      <MergeDecksDialog isOpen={isMergeDecksOpen} onOpenChange={setIsMergeDecksOpen} />
    </>
  )
}
