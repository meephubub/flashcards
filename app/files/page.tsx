"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/lib/supabase"
import { useNoteContextStore } from "@/hooks/use-note-context"
import { useRouter } from "next/navigation"
import { useFolder } from "@/context/folder-context"

import { AppSidebar } from "@/components/notes/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from "@/components/ui/breadcrumb"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { 
  Search, 
  LayoutGrid, 
  List as ListIcon, 
  FolderPlus, 
  FilePlus,
  FolderOpen as FolderOpenIcon,
  FileText
} from "lucide-react"
import { toast } from "sonner"
import { 
  FolderCard, 
  FolderRow, 
  NoteCard, 
  NoteRow, 
  FolderTreeItem
} from "@/components/files/file-components"

interface NoteWithFolder extends Pick<Note, "id" | "title" | "updated_at" | "category" | "project"> {
  folder_id?: string | null
}

export default function FilesPage() {
  const { user } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const {
    currentFolder,
    setCurrentFolder,
    folderPath,
    createFolder,
    moveNoteToFolder,
    loading: foldersLoading,
    folders
  } = useFolder()

  const setCurrentNoteId = useNoteContextStore((s) => s.setCurrentNoteId)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<NoteWithFolder[]>([])
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [newFolderName, setNewFolderName] = useState("")
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)
  const [moveNoteId, setMoveNoteId] = useState<string | null>(null)
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)

  // Persist view preference locally
  useEffect(() => {
    try {
      const v = localStorage.getItem("files:view") as "grid" | "list" | null
      if (v === "grid" || v === "list") setView(v)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem("files:view", view) } catch {}
  }, [view])

  // Fetch notes for the current folder
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!user?.id) return
      setLoading(true)
      setError(null)
      
      try {
        let query = supabase
          .from("notes")
          .select("id, title, updated_at, category, project, folder_id")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(200)
        
        // Filter by current folder
        if (currentFolder) {
          query = query.eq("folder_id", currentFolder)
        } else {
          query = query.is("folder_id", null)
        }
        
        const { data, error } = await query
        
        if (cancelled) return
        
        if (error) throw error
        
        setNotes(data || [])
      } catch (err) {
        console.error("Error fetching notes:", err)
        setError("Failed to load notes. Please try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    
    run()
    return () => { cancelled = true }
  }, [user?.id, supabase, currentFolder])

  // Handle creating a new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    
    try {
      await createFolder(newFolderName.trim(), currentFolder)
      setNewFolderName("")
      setIsCreateFolderDialogOpen(false)
      toast.success("Folder created successfully")
    } catch (error) {
      console.error("Error creating folder:", error)
      toast.error("Failed to create folder")
    }
  }

  // Handle moving a note to a folder
  const handleMoveNote = async (folderId: string | null) => {
    if (!moveNoteId) return
    
    try {
      await moveNoteToFolder(moveNoteId, folderId)
      setMoveNoteId(null)
      setIsMoveDialogOpen(false)
      toast.success("Note moved successfully")
    } catch (error) {
      console.error("Error moving note:", error)
      toast.error("Failed to move note")
    }
  }

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    if (!query) return notes
    
    const q = query.toLowerCase()
    return notes.filter(note => 
      (note.title?.toLowerCase().includes(q) ?? false) ||
      (note.category?.toLowerCase().includes(q) ?? false) ||
      (note.project?.toLowerCase().includes(q) ?? false)
    )
  }, [notes, query])

  // Get subfolders for current folder
  const subfolders = useMemo(() => {
    if (!folders || !folders.length) return []
    
    if (currentFolder) {
      // Find current folder and return its children
      const findFolder = (folderList: typeof folders): typeof folders => {
        for (const folder of folderList) {
          if (folder.id === currentFolder) return folder.children || []
          if (folder.children?.length) {
            const found = findFolder(folder.children)
            if (found.length) return found
          }
        }
        return []
      }
      
      return findFolder(folders)
    }
    
    // Return top-level folders (no parent)
    return folders.filter(folder => !folder.parent_id)
  }, [folders, currentFolder])

  const onOpenNote = (id: string) => {
    setCurrentNoteId(id)
    router.push("/notes")
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4 w-full">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <div className="flex-1 min-w-0">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Drive</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  {folderPath.map((folder, index) => (
                    <BreadcrumbItem key={index}>
                      <BreadcrumbLink onClick={() => setCurrentFolder(folder.id)}>{folder.name}</BreadcrumbLink>
                    </BreadcrumbItem>
                  ))}
                  <BreadcrumbItem>
                    <BreadcrumbPage>All files</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="bg-background flex-1 rounded-xl p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative w-full max-w-xl">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search files by title, category, or project..."
                  className="pl-8"
                />
              </div>
              <div className="ml-auto flex items-center gap-1 rounded-md border bg-card p-1">
                <button
                  aria-label="Grid view"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-sm px-2 py-1 text-sm",
                    view === "grid" ? "bg-muted" : "hover:bg-muted/60"
                  )}
                  onClick={() => setView("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
                <button
                  aria-label="List view"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-sm px-2 py-1 text-sm",
                    view === "list" ? "bg-muted" : "hover:bg-muted/60"
                  )}
                  onClick={() => setView("list")}
                >
                  <ListIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
            </div>

            {loading && (view === "grid") && (
              <Grid>
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-lg" />
                ))}
              </Grid>
            )}
            {loading && (view === "list") && (
              <div className="divide-y rounded-md border">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="p-3">
                    <Skeleton className="h-4 w-1/2" />
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            )}

            {!loading && !error && filteredNotes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-1">No notes found</h3>
                <p className="text-sm text-muted-foreground">
                  Get started by creating a new note.
                </p>
              </div>
            )}

            {!loading && !error && filteredNotes.length > 0 && view === "grid" && (
              <Grid>
                {filteredNotes.map((n) => (
                  <NoteCard 
                    key={n.id} 
                    note={n} 
                    onClick={() => onOpenNote(n.id)}
                    onMoveClick={(e) => {
                      e.stopPropagation()
                      setMoveNoteId(n.id)
                      setIsMoveDialogOpen(true)
                    }}
                  />
                ))}
              </Grid>
            )}
            {!loading && !error && filteredNotes.length > 0 && view === "list" && (
              <div className="overflow-hidden rounded-md border">
                <div className="hidden grid-cols-12 gap-2 bg-muted/60 px-3 py-2 text-xs text-muted-foreground md:grid">
                  <div className="col-span-6">Name</div>
                  <div className="col-span-3">Project/Category</div>
                  <div className="col-span-3">Last modified</div>
                </div>
                <div className="divide-y">
                  {filteredNotes.map((n) => (
                    <NoteRow 
                      key={n.id} 
                      note={n} 
                      onClick={() => onOpenNote(n.id)}
                      onMoveClick={(e) => {
                        e.stopPropagation()
                        setMoveNoteId(n.id)
                        setIsMoveDialogOpen(true)
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
      {children}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 rounded-lg border bg-muted p-3 text-muted-foreground">
        <FileText className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold">No files yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Create a note to see it appear here. You can also use the command palette to quickly add a note.
      </p>
    </div>
  )
}

function formatRelativeDate(iso?: string | null) {
  if (!iso) return ""
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const sec = Math.floor(diff / 1000)
    if (sec < 60) return "Just now"
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hrs = Math.floor(min / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString()
  } catch {
    return ""
  }
}
