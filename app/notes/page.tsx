'use client'

import { AppSidebar } from "@/components/notes/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import React, { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/lib/supabase"
import { useAuth } from "@/context/auth-context"
import { useNoteContextStore } from "@/hooks/use-note-context"
import { useNoteDialogStore } from "@/hooks/use-note-dialog"
import { NoteCreateDialog } from "@/components/note-create-dialog"
import { NoteDeleteDialog } from "@/components/note-delete-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle as ShadDialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"

// react-markdown plugins
import remarkGfm from "remark-gfm"
import remarkMath from 'remark-math'
import remarkDirective from 'remark-directive'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Skeleton } from "@/components/ui/skeleton"

export default function Page() {
  const { user } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [teamOptions, setTeamOptions] = useState<string[]>([])
  const [loadingTeams, setLoadingTeams] = useState<boolean>(false)
  const [teamsError, setTeamsError] = useState<string | null>(null)

  const currentNoteId = useNoteContextStore((s) => s.currentNoteId)
  const setCurrentNoteId = useNoteContextStore((s) => s.setCurrentNoteId)
  const setDeleteNoteById = useNoteContextStore((s) => s.setDeleteNoteById)
  const setOpenSelectNoteDialog = useNoteContextStore((s) => s.setOpenSelectNoteDialog)

  // ActionSearchBar "Create note" integration
  const createOpen = useNoteDialogStore((s) => s.open)
  const setCreateOpen = useNoteDialogStore((s) => s.setOpen)
  const [noteTitle, setNoteTitle] = useState<string>("")
  const [noteCategory, setNoteCategory] = useState<string>("")
  const [noteUpdatedAt, setNoteUpdatedAt] = useState<string>("")
  const [noteContent, setNoteContent] = useState<string>("")
  const [noteProject, setNoteProject] = useState<string>("")
  const [loadingNote, setLoadingNote] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  // Minimal select-note dialog state
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [selectLoading, setSelectLoading] = useState(false)
  const [selectError, setSelectError] = useState<string | null>(null)
  const [userNotes, setUserNotes] = useState<Pick<Note, "id" | "title" | "updated_at" | "category">[]>([])

  // Delete confirmation dialog state/handlers (slide-to-delete)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title?: string } | null>(null)

  const openDeleteDialogFor = async (id: string) => {
    if (!id) return
    let title: string | undefined = undefined
    // If it's the current note, we already have title in state
    if (id === currentNoteId && noteTitle) title = noteTitle
    else if (user?.id) {
      const { data } = await supabase
        .from("notes")
        .select("title")
        .eq("id", id)
        .eq("user_id", user.id)
        .single()
      title = (data as any)?.title
    }
    setPendingDelete({ id, title })
    setDeleteError(null)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!pendingDelete?.id || !user?.id) return
    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", pendingDelete.id)
      .eq("user_id", user.id)
    if (error) {
      setDeleteError(error.message)
    } else {
      // Clear selection if we deleted the current one
      if (currentNoteId === pendingDelete.id) setCurrentNoteId(null)
      setIsDeleteOpen(false)
      setPendingDelete(null)
    }
    setDeleting(false)
  }

  useEffect(() => {
    let isMounted = true
    const fetchProjects = async () => {
      if (!user?.id) return
      setLoadingTeams(true)
      setTeamsError(null)
      const { data, error } = await supabase
        .from("notes")
        .select("project")
        .eq("user_id", user.id)
        .order("project", { ascending: true })
      if (!isMounted) return
      if (error) {
        setTeamsError(error.message)
        setLoadingTeams(false)
        return
      }
      const rows = (data as { project: string | null }[] | null) ?? []
      const seen = new Set<string>()
      const unique: string[] = []
      for (const r of rows) {
        const v = (r.project ?? "").trim()
        if (v && !seen.has(v)) {
          seen.add(v)
          unique.push(v)
        }
      }
      setTeamOptions(unique)
      setLoadingTeams(false)
    }
    fetchProjects()
    return () => {
      isMounted = false
    }
  }, [supabase, user?.id])

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!currentNoteId || !user?.id) {
        setNoteContent("")
        setNoteTitle("")
        setNoteCategory("")
        setNoteUpdatedAt("")
        setNoteProject("")
        return
      }
      setLoadingNote(true)
      setNoteError(null)
      const { data, error } = await supabase
        .from("notes")
        .select("title, content, category, updated_at, project")
        .eq("id", currentNoteId)
        .eq("user_id", user.id)
        .single()
      if (!mounted) return
      if (error) {
        setNoteError(error.message)
        setLoadingNote(false)
        return
      }
      setNoteTitle((data?.title as string) || "Untitled")
      setNoteCategory((data?.category as string) || "")
      setNoteUpdatedAt((data?.updated_at as string) || "")
      setNoteContent((data?.content as string) || "")
      setNoteProject((data?.project as string) || "")
      setLoadingNote(false)
    }
    run()
    return () => {
      mounted = false
    }
  }, [currentNoteId, supabase, user?.id])

  // Provide delete handler for ActionSearchBar (opens confirm dialog)
  useEffect(() => {
    // Register a function that opens confirmation dialog
    setDeleteNoteById((id: string) => {
      void openDeleteDialogFor(id)
    })
    return () => {
      // Cleanup to avoid stale closures when leaving the page
      setDeleteNoteById(undefined)
    }
  }, [setDeleteNoteById, supabase, user?.id, setCurrentNoteId, currentNoteId, noteTitle])

  // Provide openSelectNoteDialog for ActionSearchBar (when no note selected)
  useEffect(() => {
    setOpenSelectNoteDialog(() => {
      // open minimal selector and fetch notes lazily
      setIsSelectOpen(true)
      void (async () => {
        if (!user?.id) return
        setSelectLoading(true)
        setSelectError(null)
        const { data, error } = await supabase
          .from("notes")
          .select("id, title, updated_at, category")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(50)
        if (error) {
          setSelectError(error.message)
        } else {
          setUserNotes((data as any) ?? [])
        }
        setSelectLoading(false)
      })()
    })
    return () => setOpenSelectNoteDialog(undefined)
  }, [setOpenSelectNoteDialog, supabase, user?.id])

  // Create note submission wired to NoteCreateDialog and palette
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const handleCreateNote = async ({ title, category, content }: { title: string; category?: string; content?: string }) => {
    if (!user?.id) return
    setCreating(true)
    setCreateError(null)
    const { data, error } = await supabase
      .from("notes")
      .insert([{ title, category: category ?? "", content: content ?? "", user_id: user.id }])
      .select("id")
      .single()
    if (error) {
      setCreateError(error.message)
    } else {
      const newId = (data as { id: string } | null)?.id
      if (newId) setCurrentNoteId(newId)
      setCreateOpen(false)
    }
    setCreating(false)
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    {noteProject || "Notes"}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{noteTitle || "Untitled"}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="bg-background min-h-[100vh] flex-1 rounded-xl md:min-h-min p-6 md:p-10">
            {/* Create Note Dialog (for palette "Create note") */}
            <NoteCreateDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              onSubmit={handleCreateNote}
              isSubmitting={creating}
              error={createError}
            />

            {/* Delete confirmation dialog with slide-to-delete */}
            <NoteDeleteDialog
              open={isDeleteOpen}
              onOpenChange={(o) => {
                setIsDeleteOpen(o)
                if (!o) setPendingDelete(null)
              }}
              noteTitle={pendingDelete?.title}
              onConfirm={confirmDelete}
              isDeleting={deleting}
              error={deleteError}
            />

            {/* Select Note Dialog (for palette when no note is selected) */}
            <Dialog open={isSelectOpen} onOpenChange={(o) => setIsSelectOpen(o)}>
              <DialogContent className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 max-w-md rounded-xl shadow-2xl p-0">
                <div className="p-6 sm:p-8">
                  <DialogHeader className="mb-4">
                    <ShadDialogTitle className="text-xl font-bold">Select a note</ShadDialogTitle>
                    <DialogDescription className="text-neutral-500 dark:text-neutral-400">
                      Choose a note to preview or manage.
                    </DialogDescription>
                  </DialogHeader>
                  {selectError && (
                    <div className="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-md mb-3">
                      {selectError}
                    </div>
                  )}
                  <div className="max-h-72 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-800">
                    {selectLoading ? (
                      <div className="p-4 text-sm text-neutral-500">Loading…</div>
                    ) : userNotes.length === 0 ? (
                      <div className="p-4 text-sm text-neutral-500">No notes yet.</div>
                    ) : (
                      userNotes.map((n) => (
                        <button
                          key={n.id}
                          className="w-full text-left p-3 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                          onClick={() => {
                            setCurrentNoteId(n.id)
                            setIsSelectOpen(false)
                          }}
                        >
                          <div className="font-medium">{n.title || "Untitled"}</div>
                          <div className="text-xs text-neutral-500">
                            {n.category ? `${n.category} • ` : ""}
                            {new Date(n.updated_at as any).toLocaleDateString()}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button variant="outline" onClick={() => setIsSelectOpen(false)}
                      className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900">
                      Close
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {noteError && (
              <p className="text-sm text-red-600">{noteError}</p>
            )}
            {!currentNoteId && !loadingNote && (
              <div className="mx-auto max-w-3xl">
                <div className="mb-6 text-center">
                  <h2 className="text-xl font-semibold mb-1">Select a note</h2>
                  <p className="text-sm text-muted-foreground">Choose a note from the sidebar to preview its content.</p>
                </div>
                <NoteSkeleton />
              </div>
            )}
            {currentNoteId && (
              <article className="mx-auto max-w-3xl">
                <header className="mb-8">
                  <h1 className="text-3xl font-bold tracking-tight mb-2">{noteTitle}</h1>
                  {(noteCategory || noteUpdatedAt) && (
                    <p className="text-sm text-muted-foreground">
                      {noteCategory && <span>Category: {noteCategory}</span>}
                      {noteCategory && noteUpdatedAt && <span> • </span>}
                      {noteUpdatedAt && (
                        <span>
                          Updated {new Date(noteUpdatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  )}
                </header>
                {loadingNote ? (
                  <NoteSkeleton />
                ) : (
                  <MarkdownContent content={noteContent} />
                )}
              </article>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function MarkdownContent({ content }: { content: string }) {
  // Custom remark plugin to handle :::center ... ::: blocks
  const centerDirectivePlugin = React.useCallback(function () {
    return (tree: any) => {
      visit(tree, (node: any) => {
        if (
          (node.type === 'containerDirective' || node.type === 'leafDirective') &&
          node.name === 'center'
        ) {
          const data = node.data || (node.data = {})
          const hast = data.hProperties || (data.hProperties = {})
          data.hName = 'div'
          hast.className = (hast.className ? hast.className + ' ' : '') + 'text-center'
        }
      })
    }
  }, [])

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkDirective, centerDirectivePlugin]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="mt-6 scroll-m-20 text-4xl font-bold tracking-tight" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="mt-10 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="mt-8 scroll-m-20 text-2xl font-semibold tracking-tight" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="mt-6 scroll-m-20 text-xl font-semibold tracking-tight" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="my-6 w-full overflow-x-auto">
              <table className="w-full text-left border-collapse [&_th]:border-b [&_td]:border-b [&_th]:px-3 [&_td]:px-3 [&_th]:py-2 [&_td]:py-2" {...props} />
            </div>
          ),
          img: ({ node, ...props }: any) => {
            const src: string | undefined = props?.src
            const isDataUri = typeof src === 'string' && src.startsWith('data:')
            // eslint-disable-next-line @next/next/no-img-element
            return (
              <img
                className="my-4 max-w-full rounded-md border"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                {...props}
                alt={props?.alt || ''}
              />
            )
          },
          a: ({ node, ...props }) => (
            <a className="underline decoration-muted-foreground underline-offset-4 hover:text-foreground" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="my-4 ml-6 list-disc [&>li]:mt-2" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="my-4 ml-6 list-decimal [&>li]:mt-2" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="mt-6 border-l-2 pl-6 italic text-muted-foreground" {...props} />
          ),
          // Loosened typing to support 'inline' prop from react-markdown Code component
          code: ({ node, inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code className={(className ? className + ' ' : '') + 'rounded bg-muted px-1.5 py-0.5 text-sm'} {...props}>
                  {children}
                </code>
              )
            }
            // Block code: single, minimal element (no outer wrapper), tight spacing
            return (
              <code
                className={(className ? className + ' ' : '') + 'inline-block my-0.1 max-w-full overflow-x-auto bg-neutral-900 text-neutral-50 px-2 py-1 whitespace-pre font-mono text-[13px] leading-6 align-top'}
                {...props}
              >
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// Utilities for remark plugin
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function visit(tree: any, visitor: (node: any) => void) {
  const walk = (node: any) => {
    visitor(node)
    const children = node.children || []
    for (const child of children) walk(child)
  }
  walk(tree)
}

function NoteSkeleton() {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-8">
        <Skeleton className="mb-2 h-9 w-2/3" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-10/12" />
        <Skeleton className="h-4 w-9/12" />
      </div>
      <div className="my-6">
        <Skeleton className="h-48 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </article>
  )
}
