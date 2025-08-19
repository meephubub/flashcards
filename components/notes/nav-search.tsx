"use client"

import * as React from "react"
import { Search, ChevronRight, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import { useProjectStore } from "@/hooks/use-project-store"
import { useNoteContextStore } from "@/hooks/use-note-context"
import { useRouter } from "next/navigation"

interface SearchResult {
  id: string
  title: string | null
  category: string | null
}

export function NavSearch() {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [expanded, setExpanded] = React.useState(true)
  const supabase = React.useMemo(() => createClient(), [])
  const { user } = useAuth()
  const selectedProject = useProjectStore((s) => s.selectedProject)
  const setCurrentNoteId = useNoteContextStore((s) => s.setCurrentNoteId)
  const router = useRouter()

  React.useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      if (!user?.id) return
      const q = query.trim()
      setLoading(true)
      // Build base query
      let req = supabase
        .from("notes")
        .select("id,title,category")
        .eq("user_id", user.id)
        .order("title", { ascending: true })
      if (q) {
        req = req.ilike("category", `%${q}%`)
      }
      if (selectedProject) {
        req = req.eq("project", selectedProject)
      }
      const { data, error } = await req
      if (error) {
        // Fail silently for now; could add a small error UI
        setResults([])
        setLoading(false)
        return
      }
      setResults((data as SearchResult[] | null) ?? [])
      setLoading(false)
    }
    const t = setTimeout(run, 250) // debounce
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [query, supabase, user?.id, selectedProject])

  return (
    <SidebarGroup
      className={
        expanded
          ? "group-data-[collapsible=icon]:hidden"
          : "group-data-[collapsible=icon]:hidden p-1 -mb-2"
      }
    >
      <SidebarGroupLabel>
        <button
          type="button"
          className="flex w-full items-center gap-2 select-none"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          <span>Notes</span>
        </button>
      </SidebarGroupLabel>
      <div
        className={
          (expanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0") +
          " grid transition-all duration-200 ease-out"
        }
      >
        <div className="overflow-hidden">
          <div className="px-2 pb-2 transition-opacity duration-150 ease-out">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by category…"
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <SidebarMenu>
            {query && !loading && results.length === 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/70">
                  <span>No matches</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {!query && !loading && results.length === 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/70">
                  <span>No notes</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {results.map((r) => (
              <SidebarMenuItem key={r.id}>
                <SidebarMenuButton
                  asChild
                  onClick={() => {
                    setCurrentNoteId(r.id)
                    router.push("/notes")
                  }}
                >
                  <button type="button">
                    <Search />
                    <span>{r.title || "Untitled"}</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      </div>
    </SidebarGroup>
  )
}
