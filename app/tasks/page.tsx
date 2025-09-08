"use client"

import * as React from "react"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Loader2, Plus, Trash2, Link as LinkIcon, ChevronsUpDown, Check } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

// Notes layout components for consistent shell
import { AppSidebar } from "@/components/notes/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface HomeworkRow {
  id: number
  created_at: string
  user_id: string
  due_date: string | null
  subject: string | null
  priority: number | null
  done: boolean | null
  metadata?: any | null
}

interface NoteRow {
  id: string
  title: string | null
}

export default function TasksPage() {
  const { user } = useAuth()
  const supabase = React.useMemo(() => createClient(), [])
  const router = useRouter()

  const [loading, setLoading] = React.useState(false)
  const [tasks, setTasks] = React.useState<HomeworkRow[]>([])
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined)

  // New task form
  const [subject, setSubject] = React.useState("")
  const [dueDate, setDueDate] = React.useState<Date | undefined>(undefined)
  const [priority, setPriority] = React.useState<number | null>(null)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [showCreate, setShowCreate] = React.useState(true)
  // Simple validation
  const [subjectError, setSubjectError] = React.useState(false)
  // Link fields stored in metadata jsonb
  const [linkUrl, setLinkUrl] = React.useState<string>("")
  const [selectedNoteId, setSelectedNoteId] = React.useState<string>("")
  const [createNoteFromTask, setCreateNoteFromTask] = React.useState(false)
  const [noteIdToAttach, setNoteIdToAttach] = React.useState<string>("")

  // Notes for dropdown
  const [notes, setNotes] = React.useState<NoteRow[]>([])
  const [loadingNotes, setLoadingNotes] = React.useState(false)
  const [noteComboOpen, setNoteComboOpen] = React.useState(false)

  // Keep calendar selection and due date in sync
  React.useEffect(() => {
    // When due date changes (via input or after add/reset), mirror to calendar
    if (dueDate) setSelectedDate(dueDate)
    else setSelectedDate(undefined)
  }, [dueDate])

  const fetchTasks = React.useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    let q = supabase
      .from("homework")
      .select('id, created_at, user_id, due_date, subject, priority, done, metadata')
      .eq("user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
    const { data, error } = await q
    if (!error) {
      let rows = (data as HomeworkRow[]) || []
      if (selectedDate) {
        const sy = selectedDate.getUTCFullYear()
        const sm = selectedDate.getUTCMonth()
        const sd = selectedDate.getUTCDate()
        rows = rows.filter((r) => {
          if (!r.due_date) return false
          // If date-only (YYYY-MM-DD), parse as UTC midnight
          if (/^\d{4}-\d{2}-\d{2}$/.test(r.due_date)) {
            const [yy, mm, dd] = r.due_date.split('-').map((x) => parseInt(x, 10))
            return yy === sy && (mm - 1) === sm && dd === sd
          }
          // Else assume timestamp; compare UTC components
          const d = new Date(r.due_date)
          return d.getUTCFullYear() === sy && d.getUTCMonth() === sm && d.getUTCDate() === sd
        })
      }
      setTasks(rows)
    }
    setLoading(false)
  }, [selectedDate, supabase, user?.id])

  const fetchNotes = React.useCallback(async () => {
    if (!user?.id) return
    setLoadingNotes(true)
    const { data, error } = await supabase
      .from("notes")
      .select("id, title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200)
    if (!error) setNotes((data as NoteRow[]) || [])
    setLoadingNotes(false)
  }, [supabase, user?.id])

  React.useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  React.useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const addTask = async () => {
    if (!user?.id) return
    try {
      setAdding(true)
      setCreateError(null)
      // Validate required fields (Due date is optional)
      if (!subject.trim()) {
        setSubjectError(true)
        setAdding(false)
        return
      }
      // Normalize due_date to noon UTC to avoid local->UTC day shifting
      const dueIso = dueDate
        ? (() => {
            const y = dueDate.getUTCFullYear()
            const m = dueDate.getUTCMonth()
            const d = dueDate.getUTCDate()
            return new Date(Date.UTC(y, m, d, 12, 0, 0, 0)).toISOString()
          })()
        : null

      // If requested, create a note first and capture its id
      let noteIdToAttach = selectedNoteId
      if (createNoteFromTask && subject.trim().length > 0) {
        const { data: created, error: noteErr } = await supabase
          .from("notes")
          .insert([{ title: subject.trim(), category: "", content: "", project: "", user_id: user.id }])
          .select("id")
          .single()
        if (noteErr) throw noteErr
        noteIdToAttach = created?.id || noteIdToAttach
      }

      const payload: any = {
        user_id: user.id,
        subject: subject || null,
        due_date: dueIso,
        priority: priority,
        // intentionally omit 'done' to avoid column mismatch if schema differs
        metadata: (linkUrl || noteIdToAttach)
          ? {
              ...(linkUrl ? { link_url: linkUrl } : {}),
              ...(noteIdToAttach ? { note_id: noteIdToAttach } : {}),
            }
          : null,
      }
      const { error } = await supabase.from("homework").insert(payload)
      if (error) throw error

      // If we created a note for this task, navigate to it immediately
      if (createNoteFromTask && noteIdToAttach) {
        router.push(`/notes?note=${encodeURIComponent(noteIdToAttach)}`)
        return
      }

      setSubject("")
      setDueDate(undefined)
      setPriority(null)
      setLinkUrl("")
      setSelectedNoteId("")
      setCreateNoteFromTask(false)
      await fetchTasks()
    } catch (e: any) {
      console.error("Add homework failed", e)
      setCreateError(e?.message || "Failed to add task")
    } finally {
      setAdding(false)
    }
  }

  const updateDone = async (id: number, done: boolean) => {
    await supabase
      .from("homework")
      .update({ done })
      .eq("id", id)
    fetchTasks()
  }

  const removeTask = async (id: number) => {
    await supabase.from("homework").delete().eq("id", id)
    fetchTasks()
  }

  return (
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
                  <BreadcrumbLink href="#">Planner</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Tasks{selectedDate ? ` • ${format(selectedDate, "PPP")}` : ""}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="bg-background min-h-[100vh] flex-1 rounded-xl md:min-h-min p-6 md:p-10">
            <div className="mx-auto max-w-5xl">
              <div className="flex flex-col gap-6 md:flex-row">
                {/* Left: Calendar filter */}
                <div className="md:w-72">
                  <div className="rounded-xl border bg-background">
                    <div className="p-3 border-b">
                      <div className="text-sm font-medium">Calendar</div>
                      <div className="text-xs text-muted-foreground">Filter tasks by day</div>
                    </div>
                    <div className="p-3">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(d) => {
                          setSelectedDate(d)
                          setDueDate(d || undefined)
                        }}
                        showOutsideDays={false}
                        numberOfMonths={1}
                        className="rounded-md"
                      />
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <button className="underline" onClick={() => { setSelectedDate(undefined); setDueDate(undefined) }}>
                          Clear filter
                        </button>
                        {selectedDate ? <span>{format(selectedDate, "PPP")}</span> : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Task manager */}
                <div className="flex-1">
                  <div className="rounded-xl border overflow-hidden">
                    <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Tasks</div>
                        <div className="text-xs text-muted-foreground">Create and track your homework</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setShowCreate((v) => !v)}>
                        {showCreate ? 'Hide' : 'New task'}
                      </Button>
                    </div>

                    {/* Create */}
                    {showCreate && (
                      <div className="p-3 md:p-4 grid gap-3 md:gap-4 md:grid-cols-12 items-end bg-muted/30">
                        <div className="md:col-span-5">
                          <Label htmlFor="subject">Task</Label>
                          <Input
                            id="subject"
                            placeholder="What do you need to do?"
                            value={subject}
                            onChange={(e) => { setSubject(e.target.value); if (subjectError && e.target.value.trim()) setSubjectError(false) }}
                            aria-invalid={subjectError}
                            className={cn(subjectError ? "border-destructive focus-visible:ring-destructive animate-pulse" : "")}
                          />
                          <div className={cn("mt-1 text-xs h-4", subjectError ? "text-destructive" : "invisible")}>Task name is required.</div>
                        </div>
                        <div className="md:col-span-3">
                          <Label>Due date</Label>
                          <Input
                            type="date"
                            value={dueDate ? format(dueDate, "yyyy-MM-dd") : ""}
                            onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value) : undefined)}
                          />
                          <div className="mt-1 h-4 text-xs invisible">spacer</div>
                        </div>
                        <div className="md:col-span-2">
                          <Label>Priority</Label>
                          <Select value={priority?.toString() ?? ""} onValueChange={(v) => setPriority(v ? parseInt(v) : null)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Low</SelectItem>
                              <SelectItem value="2">Medium</SelectItem>
                              <SelectItem value="3">High</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="mt-1 h-4 text-xs invisible">spacer</div>
                        </div>
                        <div className="md:col-span-5">
                          <Label>Attach note</Label>
                          <Popover open={noteComboOpen} onOpenChange={setNoteComboOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" aria-expanded={noteComboOpen} className="w-full justify-between" disabled={createNoteFromTask}>
                                {selectedNoteId
                                  ? (notes.find((n) => n.id === selectedNoteId)?.title || "Selected note")
                                  : (loadingNotes ? "Loading notes…" : "Select a note (optional)")}
                                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[240px]">
                              <Command>
                                <CommandInput placeholder="Search notes…" />
                                <CommandEmpty>No notes found.</CommandEmpty>
                                <CommandList>
                                  <CommandGroup>
                                    <CommandItem value="" onSelect={() => { setSelectedNoteId(""); setNoteComboOpen(false) }}>
                                      <Check className={cn("mr-2 h-4 w-4", selectedNoteId === "" ? "opacity-100" : "opacity-0")} />
                                      No note
                                    </CommandItem>
                                    {notes.map((n) => (
                                      <CommandItem key={n.id} value={n.title || "Untitled note"} onSelect={() => { setSelectedNoteId(n.id); setNoteComboOpen(false) }}>
                                        <Check className={cn("mr-2 h-4 w-4", selectedNoteId === n.id ? "opacity-100" : "opacity-0")} />
                                        {n.title || "Untitled note"}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <div className="mt-1 h-4 text-xs invisible">spacer</div>
                        </div>
                        <div className="md:col-span-7">
                          <Label htmlFor="linkUrl">Link URL</Label>
                          <Input id="linkUrl" placeholder="https://… or /notes?note=… (optional)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} disabled={createNoteFromTask} />
                          <div className="mt-1 h-4 text-xs invisible">spacer</div>
                        </div>
                        <div className="md:col-span-12 flex items-center gap-2">
                          <Checkbox id="createNoteFromTask" checked={createNoteFromTask} onCheckedChange={(v) => setCreateNoteFromTask(!!v)} />
                          <Label htmlFor="createNoteFromTask" className="text-sm">Create note from task (uses task name)</Label>
                        </div>
                        <div className="md:col-span-12 flex justify-end">
                          <Button onClick={addTask} disabled={adding} className="min-w-24">
                            <Plus className="mr-2 h-4 w-4" /> {adding ? 'Adding…' : 'Add'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {createError && (
                      <div className="px-3 pb-3 text-sm text-red-600">{createError}</div>
                    )}

                    {/* List */}
                    <div className="divide-y">
                      {loading && (
                        <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                        </div>
                      )}
                      {!loading && tasks.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground">No tasks</div>
                      )}
                      {tasks.map((t) => {
                        const urlGuess = taskExplicitOrGuessedLink(t)
                        return (
                          <div key={t.id} className="p-3 flex items-center gap-3">
                            <Checkbox checked={!!t.done} onCheckedChange={(v) => updateDone(t.id, !!v)} />
                            <div className="flex-1 min-w-0">
                              <div className={cn("text-sm", t.done ? "line-through text-muted-foreground" : "")}>{t.subject || "Homework"}</div>
                              <div className="text-xs text-muted-foreground">
                                {t.due_date ? `Due ${format(new Date(t.due_date), "PPP")}` : "No due date"}
                                {t.priority ? ` · Priority ${t.priority}` : ""}
                              </div>
                            </div>
                            {urlGuess && (
                              <Link href={urlGuess} className="inline-flex items-center text-xs text-foreground hover:underline">
                                <LinkIcon className="h-3.5 w-3.5 mr-1" /> Open
                              </Link>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => removeTask(t.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Linking guidance */}
                  <div className="mt-4 text-xs text-muted-foreground">
                    To fully link tasks to notes, decks, and models, consider adding nullable columns to the <code>homework</code> table: <code>note_id uuid</code>, <code>deck_id uuid</code>, <code>model_id uuid</code>, and/or a generic <code>link_url text</code>. I can wire these in once added.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

// Prefer explicit metadata.note_id, then metadata.link_url / metadata.linked_task_id, else fall back to guessing from subject text
function taskExplicitOrGuessedLink(t: HomeworkRow): string | null {
  const meta = (t.metadata || {}) as any
  if (meta && typeof meta === 'object') {
    if (meta.note_id && typeof meta.note_id === 'string' && meta.note_id.trim().length > 0) {
      return `/notes?note=${encodeURIComponent(meta.note_id)}`
    }
    if (meta.link_url && typeof meta.link_url === 'string' && meta.link_url.trim().length > 0) {
      return meta.link_url
    }
    if (meta.linked_task_id && Number.isFinite(Number(meta.linked_task_id))) {
      return `/tasks?focus=${meta.linked_task_id}`
    }
  }
  return guessLinkForTask(t)
}

// Very simple helper: try to infer a link from the subject text like "deck: <id>" or "note: <id>" or "model: <id>"
function guessLinkForTask(t: HomeworkRow): string | null {
  const s = (t.subject || "").toLowerCase()
  const mDeck = s.match(/deck\s*:\s*([0-9a-f-]{6,})/)
  if (mDeck) return `/deck/${mDeck[1]}`
  const mNote = s.match(/note\s*:\s*([0-9a-f-]{6,})/)
  if (mNote) return `/notes?note=${mNote[1]}`
  const mModel = s.match(/model\s*:\s*([0-9a-f-]{6,})/)
  if (mModel) return `/viewer?m=${mModel[1]}`
  return null
}
