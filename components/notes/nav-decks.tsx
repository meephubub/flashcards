"use client"

import * as React from "react"
import { BookText, ChevronDown, ChevronRight, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useDecks } from "@/context/deck-context"
import { useRouter } from "next/navigation"

export function NavDecks() {
  const { decks, loading } = useDecks()
  const [expanded, setExpanded] = React.useState(true)
  const [filter, setFilter] = React.useState("")
  const router = useRouter()

  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return decks
    return decks.filter((d) => d.name.toLowerCase().includes(q))
  }, [decks, filter])

  return (
    <SidebarGroup
      className={
        expanded
          ? "group-data-[collapsible=icon]:hidden"
          : "group-data-[collapsible=icon]:hidden p-1 -mb-1"
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
          <span>Decks</span>
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
                placeholder="Filter decks…"
                className="pl-8"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>

          <SidebarMenu>
            {loading && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/70">
                  <span>Loading…</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {!loading && filtered.length === 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/70">
                  <span>No decks</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {filtered.map((d) => (
              <SidebarMenuItem key={d.id}>
                <SidebarMenuButton
                  asChild
                  onClick={() => {
                    router.push(`/deck/${d.id}`)
                  }}
                >
                  <button type="button">
                    <BookText />
                    <span>{d.name}</span>
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
