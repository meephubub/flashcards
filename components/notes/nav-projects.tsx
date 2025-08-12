"use client"

import {
  Folder,
  Forward,
  MoreHorizontal,
  Trash2,
  type LucideIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import { useProjectStore } from "@/hooks/use-project-store"
import { useNoteContextStore } from "@/hooks/use-note-context"

type NoteItem = { id: string; title: string }

export function NavProjects() {
  const { isMobile } = useSidebar()
  const { user } = useAuth()
  const supabase = React.useMemo(() => createClient(), [])
  const selectedProject = useProjectStore((s) => s.selectedProject)
  const setCurrentNoteId = useNoteContextStore((s) => s.setCurrentNoteId)

  const [notes, setNotes] = React.useState<NoteItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!user?.id || !selectedProject) {
        setNotes([])
        return
      }
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from("notes")
        .select("id,title")
        .eq("user_id", user.id)
        .eq("project", selectedProject)
        .order("title", { ascending: true })
      if (!mounted) return
      if (error) {
        setError(error.message)
        setNotes([])
        setLoading(false)
        return
      }
      const rows = (data as { id: string; title: string | null }[] | null) ?? []
      setNotes(rows.map((r) => ({ id: r.id, title: r.title || "Untitled" })))
      setLoading(false)
    }
    run()
    return () => {
      mounted = false
    }
  }, [supabase, user?.id, selectedProject])

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {selectedProject ? (
          notes.length > 0 ? (
            notes.map((n) => (
              <SidebarMenuItem key={n.id}>
                <SidebarMenuButton asChild onClick={() => setCurrentNoteId(n.id)}>
                  <button type="button">
                    <Folder />
                    <span>{n.title}</span>
                  </button>
                </SidebarMenuButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction showOnHover>
                      <MoreHorizontal />
                      <span className="sr-only">More</span>
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-48 rounded-lg"
                    side={isMobile ? "bottom" : "right"}
                    align={isMobile ? "end" : "start"}
                  >
                    <DropdownMenuItem>
                      <Folder className="text-muted-foreground" />
                      <span>Open</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Trash2 className="text-muted-foreground" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ))
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton className="text-sidebar-foreground/70">
                <MoreHorizontal className="text-sidebar-foreground/70" />
                <span>No notes in {selectedProject}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        ) : (
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sidebar-foreground/70">
              <MoreHorizontal className="text-sidebar-foreground/70" />
              <span>Select a team to see notes</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
