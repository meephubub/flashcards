"use client"

import * as React from "react"
import { ChevronsUpDown, Plus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import { useProjectStore } from "@/hooks/use-project-store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Team = {
  name: string
  logo: React.ElementType
  plan: string
}

export function TeamSwitcher() {
  const { isMobile } = useSidebar()
  const { user } = useAuth()
  const supabase = React.useMemo(() => createClient(), [])
  const setSelectedProject = useProjectStore((s) => s.setSelectedProject)

  const [teams, setTeams] = React.useState<Team[]>([])
  const [activeTeam, setActiveTeam] = React.useState<Team | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [newTeam, setNewTeam] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  const makeLogo = React.useCallback((letter: string): React.ElementType => {
    const LogoComp = ({ className }: { className?: string }) => (
      <span className={className}>{letter}</span>
    )
    return LogoComp
  }, [])

  React.useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!user?.id) return
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from("notes")
        .select("project")
        .eq("user_id", user.id)
        .order("project", { ascending: true })
      if (!mounted) return
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      const rows = (data as { project: string | null }[] | null) ?? []
      const seen = new Set<string>()
      const items: Team[] = []
      for (const r of rows) {
        const v = (r.project ?? "").trim()
        if (v && !seen.has(v)) {
          seen.add(v)
          items.push({ name: v, logo: makeLogo(v[0]?.toUpperCase() ?? "?"), plan: "" })
        }
      }
      setTeams(items)
      const initial = items[0] ?? null
      setActiveTeam(initial)
      setSelectedProject(initial?.name ?? null)
      setLoading(false)
    }
    run()
    return () => {
      mounted = false
    }
  }, [supabase, user?.id, makeLogo])

  const refreshTeams = React.useCallback(async () => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from("notes")
      .select("project")
      .eq("user_id", user.id)
      .order("project", { ascending: true })
    if (error) throw error
    const rows = (data as { project: string | null }[] | null) ?? []
    const seen = new Set<string>()
    const items: Team[] = []
    for (const r of rows) {
      const v = (r.project ?? "").trim()
      if (v && !seen.has(v)) {
        seen.add(v)
        items.push({ name: v, logo: makeLogo(v[0]?.toUpperCase() ?? "?"), plan: "" })
      }
    }
    setTeams(items)
    if (items.length && !activeTeam) setActiveTeam(items[0])
    return items
  }, [supabase, user?.id, makeLogo, activeTeam])

  const handleCreateTeam = React.useCallback(async () => {
    if (!user?.id) return
    const project = newTeam.trim()
    if (!project) return
    setCreating(true)
    setCreateError(null)
    const demoMd = `# Welcome to ${project}

This is a quick tour of supported Markdown features. You can edit this note freely.

**Bold**, _italic_, ~~strikethrough~~, and inline code like \`const x = 1\`.

> Blockquotes are great for callouts or quotes.

- Lists
  - Nested item
  - Another item

- [Links](https://example.com) and images:

![Placeholder Image](https://picsum.photos/seed/${encodeURIComponent(project)}/600/200)

## Task List (GFM)

- [x] Create your first note
- [ ] Organize notes by project
- [ ] Share with your team

## Code Block

~~~ts
// TypeScript example
type Card = { front: string; back: string }
const add = (a: number, b: number) => a + b
console.log(add(2, 3))
~~~

## Table (GFM)

| Feature     | Supported |
|-------------|-----------|
| Tables      | ✅        |
| Task Lists  | ✅        |
| Strikethrough | ✅      |

## Math (remark-math + rehype-katex)

Inline math: $E = mc^2$.

Block math:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

## Directives (remark-directive)

:::note Getting Started
You can use directive containers for custom callouts.
:::

Happy writing!`
    const { error } = await supabase.from("notes").insert([
      {
        user_id: user.id,
        project,
        title: "Welcome",
        content: demoMd,
        category: "Get Started",
      },
    ])
    if (error) {
      setCreateError(error.message)
      setCreating(false)
      return
    }
    const items = await refreshTeams()
    const created = items?.find((t) => t.name === project) ?? null
    if (created) {
      setActiveTeam(created)
      setSelectedProject(created.name)
    }
    setCreating(false)
    setAddOpen(false)
    setNewTeam("")
  }, [user?.id, newTeam, supabase, refreshTeams])

  if (!activeTeam) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <activeTeam.logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeTeam.name}</span>
                <span className="truncate text-xs">{activeTeam.plan || (loading ? "Loading…" : "")}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Teams
            </DropdownMenuLabel>
            {teams.map((team, index) => (
              <DropdownMenuItem
                key={team.name}
                onClick={() => {
                  setActiveTeam(team)
                  setSelectedProject(team.name)
                }}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <team.logo className="size-3.5 shrink-0" />
                </div>
                {team.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <DropdownMenuItem className="gap-2 p-2" onSelect={(e) => e.preventDefault()}>
                  <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                    <Plus className="size-4" />
                  </div>
                  <div className="text-muted-foreground font-medium">Add team</div>
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a team</DialogTitle>
                  <DialogDescription>
                    Create a new team by choosing a project name. This will create a welcome note in that project.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-2">
                  <label htmlFor="team-name" className="text-sm font-medium">
                    Team name (project)
                  </label>
                  <Input
                    id="team-name"
                    placeholder="e.g. My Project"
                    value={newTeam}
                    onChange={(e) => setNewTeam(e.target.value)}
                  />
                  {createError && (
                    <p className="text-sm text-red-600">{createError}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)} disabled={creating}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTeam} disabled={creating || !newTeam.trim()}>
                    {creating ? "Creating…" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            
            
            {error && (
              <div className="px-2 py-1 text-xs text-red-600">{error}</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
