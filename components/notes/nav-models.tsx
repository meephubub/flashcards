"use client"

import * as React from "react"
import { Box, ChevronDown, ChevronRight, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface ModelRow {
  id: string
  name: string
  model_url: string
}

export function NavModels() {
  const { user } = useAuth()
  const supabase = React.useMemo(() => createClient(), [])
  const [expanded, setExpanded] = React.useState(true)
  const [filter, setFilter] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [models, setModels] = React.useState<ModelRow[]>([])
  const router = useRouter()

  React.useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!user?.id) return
      setLoading(true)
      const { data, error } = await supabase
        .from('models')
        .select('id, name, model_url')
        .order('created_at', { ascending: false })
        .limit(100)
      if (!mounted) return
      if (!error) setModels((data as any) || [])
      setLoading(false)
    }
    run()
    // simple refresh when window regains focus
    const onFocus = () => run()
    window.addEventListener('focus', onFocus)
    return () => { mounted = false; window.removeEventListener('focus', onFocus) }
  }, [supabase, user?.id])

  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return models
    return models.filter((m) => (m.name || '').toLowerCase().includes(q))
  }, [models, filter])

  return (
    <SidebarGroup className={expanded ? "group-data-[collapsible=icon]:hidden" : "group-data-[collapsible=icon]:hidden p-1 -mb-1"}>
      <SidebarGroupLabel>
        <button type="button" className="flex w-full items-center gap-2 select-none" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span>Models</span>
        </button>
      </SidebarGroupLabel>
      <div className={(expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0") + " grid transition-all duration-200 ease-out"}>
        <div className="overflow-hidden">
          <div className="px-2 pb-2 transition-opacity duration-150 ease-out">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Filter models…" className="pl-8" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
          </div>
          <SidebarMenu>
            {loading && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/70"><span>Loading…</span></SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {!loading && filtered.length === 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/70"><span>No models</span></SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {filtered.map((m) => (
              <SidebarMenuItem key={m.id}>
                <SidebarMenuButton asChild onClick={() => { router.push(`/viewer?m=${m.id}`) }}>
                  <button type="button">
                    <Box />
                    <span>{m.name || 'Model'}</span>
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
