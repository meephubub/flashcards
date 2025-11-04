'use client'

import React, { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/lib/supabase"
import { useNoteContextStore } from "@/hooks/use-note-context"
import { useRouter } from "next/navigation"
import { useFolder } from "@/context/folder-context"
import { useAuth } from "@/context/auth-context"

import { AppSidebar } from "@/components/notes/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from "@/components/ui/breadcrumb"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { 
  Search, 
  LayoutGrid, 
  List as ListIcon, 
  FileText,
  FolderPlus,
  Upload as UploadIcon,
  Loader2,
  Camera,
  ArrowLeft,
  FolderOpenIcon,
  FolderIcon,
  Archive,
  Box,
  Briefcase,
  Database,
  Package,
  FolderTree
} from "lucide-react"
import DocumentScanner from "@/components/scanner/DocumentScanner"
import OcrDoclingModal from "@/components/ocr/OcrDoclingModal"

// Preset pastel colors for folder customization
const PASTEL_COLORS = [
  { name: 'Pure White', value: '#FFFFFF' },
  { name: 'Snow Gray', value: '#F9FAFB' },
  { name: 'Platinum', value: '#E5E7EB' },
  { name: 'Ash', value: '#D1D5DB' },
  { name: 'Silver', value: '#9CA3AF' },
  { name: 'Smoke', value: '#6B7280' },
  { name: 'Granite', value: '#4B5563' },
  { name: 'Charcoal', value: '#374151' },
  { name: 'Graphite', value: '#1F2937' },
  { name: 'Jet Black', value: '#0F172A' },
];

// Color preset component
function ColorPreset({ color, onSelect, isSelected }: { color: string; onSelect: () => void; isSelected: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
        isSelected ? 'border-foreground scale-110' : 'border-border hover:border-foreground/50'
      }`}
      style={{ backgroundColor: color }}
      title={`Select ${color}`}
    />
  )
}
import { 
  FolderCard, 
  NoteCard, 
  FolderTreeItem,
  NoteRow,
  StorageFileCard,
  StorageFileRow,
  FolderRow
} from "@/components/files/file-components"
import { NoteDeleteDialog } from "@/components/note-delete-dialog"

// Preview component for folder icon
function FolderIconPreview({ icon, color }: { icon?: string; color?: string }) {
  function normalizeLucideName(name: string): string {
    const parts = (name || "").split(/[^a-zA-Z0-9]+/).filter(Boolean)
    if (parts.length === 0) return name
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("")
  }
  return (
    <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/50">
      <div className="flex flex-col items-center text-center">
        {(() => {
          if (!icon) {
            return <FolderOpenIcon className="h-12 w-12 mb-2 transition-colors" style={{ color }} />
          }

          // Check if it's likely an emoji (contains non-word, non-space characters)
          if (/[^\w\s-]/.test(icon)) {
            return <div className="h-12 w-12 mb-2 flex items-center justify-center text-3xl" style={{ color }}>{icon}</div>
          }

          // Check static map first for common icons
          const folderIconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
            Folder: FolderIcon,
            FolderOpen: FolderOpenIcon,
            Archive: Archive,
            Box: Box,
            Briefcase: Briefcase,
            Database: Database,
            Package: Package,
            FolderTree: FolderTree,
          }

          const normalized = normalizeLucideName(icon)
          const IconComponent = folderIconMap[normalized] || folderIconMap[icon]
          if (IconComponent) {
            return <IconComponent className="h-12 w-12 mb-2 transition-colors" style={{ color }} />
          }

          // For dynamic loading, we'll use a placeholder that can be updated
          // This is a simple implementation - in a real app you might use React Suspense
          const [DynamicIcon, setDynamicIcon] = React.useState<React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null>(null)

          React.useEffect(() => {
            let mounted = true

            const loadIcon = async () => {
              try {
                const module = await import('lucide-react')
                const normalizedName = normalizeLucideName(icon)
                let IconComponent = (module as any)[normalizedName] as React.ComponentType<{ className?: string; style?: React.CSSProperties }>
                if (!IconComponent) {
                  IconComponent = (module as any)[icon] as React.ComponentType<{ className?: string; style?: React.CSSProperties }>
                }

                if (IconComponent && mounted) {
                  setDynamicIcon(IconComponent)
                } else if (mounted) {
                  setDynamicIcon(null) // Icon not found
                }
              } catch (error) {
                console.warn(`Failed to load Lucide icon: ${icon}`, error)
                if (mounted) {
                  setDynamicIcon(null)
                }
              }
            }

            loadIcon()

            return () => {
              mounted = false
            }
          }, [icon])

          if (DynamicIcon) {
            return <DynamicIcon className="h-12 w-12 mb-2 transition-colors" style={{ color }} />
          }

          // Show placeholder while loading or if not found
          return <FolderOpenIcon className="h-12 w-12 mb-2 transition-colors animate-pulse" style={{ color }} />
        })()}
        <span className="text-sm font-medium">Preview</span>
      </div>
    </div>
  )
}

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
    updateFolder,
    deleteFolder,
    moveNoteToFolder,
    loading: foldersLoading,
    folders,
    refreshFolders
  } = useFolder()

  const setCurrentNoteId = useNoteContextStore((s) => s.setCurrentNoteId)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<NoteWithFolder[]>([])
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [newFolderName, setNewFolderName] = useState("")
  const [newFolderColor, setNewFolderColor] = useState<string>("")
  const [newFolderIcon, setNewFolderIcon] = useState<string>("")
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)
  const [isEditFolderDialogOpen, setIsEditFolderDialogOpen] = useState(false)
  const [editFolderName, setEditFolderName] = useState<string>("")
  const [editFolderColor, setEditFolderColor] = useState<string>("")
  const [editFolderIcon, setEditFolderIcon] = useState<string>("")
  const [isDeleteFolderOpen, setIsDeleteFolderOpen] = useState(false)
  const [moveNoteId, setMoveNoteId] = useState<string | null>(null)
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)
  const [selectedMoveFolderId, setSelectedMoveFolderId] = useState<string | null>(null)
  const [storageFileToMove, setStorageFileToMove] = useState<{ fullPath: string; name: string } | null>(null)
  // Delete dialog state (reuse NoteDeleteDialog)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title?: string } | null>(null)
  // Storage: files and delete dialog
  const [storageFiles, setStorageFiles] = useState<Array<{ name: string; updated_at?: string | null; fullPath: string }>>([])
  const [isDeleteStorageOpen, setIsDeleteStorageOpen] = useState(false)
  const [deletingStorage, setDeletingStorage] = useState(false)
  const [deleteStorageError, setDeleteStorageError] = useState<string | null>(null)
  const [pendingDeleteStorage, setPendingDeleteStorage] = useState<{ name: string; fullPath: string } | null>(null)
  // Storage preview
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<'image' | 'video' | 'audio' | 'pdf' | 'unknown'>('unknown')
  const [previewName, setPreviewName] = useState<string>("")
  // Hover preview cache: fullPath -> signed URL
  const [storagePreviewUrls, setStoragePreviewUrls] = useState<Record<string, string>>({})
  const [ownedByPath, setOwnedByPath] = useState<Record<string, boolean | undefined>>({})
  const [walletAddress, setWalletAddress] = useState<string>("")

  useEffect(() => {
    const loadWallet = async () => {
      if (!user?.id) return
      try {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('address')
          .eq('user_id', user.id)
          .maybeSingle()
        setWalletAddress(wallet?.address || "")
      } catch {
        setWalletAddress("")
      }
    }
    void loadWallet()
  }, [supabase, user?.id])
  // Note content hover preview cache: noteId -> snippet
  const [notePreviews, setNotePreviews] = useState<Record<string, string>>({})
  // Storage rename dialog
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ fullPath: string; name: string } | null>(null)
  const [renameNewName, setRenameNewName] = useState<string>("")
  // Upload progress state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [uploadTotal, setUploadTotal] = useState<number>(0)
  const [uploadDone, setUploadDone] = useState<number>(0)
  // Scanner modal state
  const [isScanOpen, setIsScanOpen] = useState(false)
  // OCR modal state
  const [isOcrOpen, setIsOcrOpen] = useState(false)
  const [ocrImageUrl, setOcrImageUrl] = useState<string | null>(null)
  const [ocrTitleBase, setOcrTitleBase] = useState<string>("Scan")

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

  // Fetch storage files for current path (reusable)
  const refreshStorageFiles = async () => {
    if (!user?.id) { setStorageFiles([]); return }
    const base = user.id
    const sub = currentFolder ? `${currentFolder}` : ""
    const path = sub ? `${base}/${sub}` : `${base}`
    const { data, error } = await supabase.storage.from('userFiles').list(path, { limit: 200, sortBy: { column: 'updated_at', order: 'desc' } })
    if (error) {
      console.warn('List storage files failed', error)
      setStorageFiles([])
      return
    }
    // Only include FILES; folders returned by list() lack metadata.size
    const mapped = (data || [])
      .filter((d: any) => d?.name && (d?.metadata && typeof d.metadata.size === 'number'))
      .map((d: any) => ({
      name: d.name as string,
      updated_at: (d as any).updated_at || null,
      fullPath: sub ? `${base}/${sub}/${d.name}` : `${base}/${d.name}`
    }))
    setStorageFiles(mapped)
  }

  useEffect(() => { void refreshStorageFiles() }, [user?.id, currentFolder, supabase])

  // Scroll to top when changing folders
  useEffect(() => {
    try { window.scrollTo(0, 0) } catch {}
  }, [currentFolder])

  // Determine file type label and image-ness
  const getFileType = (name: string): { label: string; isImage: boolean } => {
    const lower = name.toLowerCase()
    const ext = (lower.split('.').pop() || '').trim()
    const image = ['png','jpg','jpeg','gif','webp','bmp','svg'].includes(ext)
    return { label: ext || 'file', isImage: image }
  }

  const openOcrForFile = async (f: { fullPath: string; name: string }) => {
    try {
      const lower = f.name.toLowerCase()
      if (!/(\.png|\.jpe?g|\.webp|\.bmp)$/.test(lower)) {
        toast.message('OCR currently supports images only (png/jpg/webp/bmp)')
        return
      }
      const { data, error } = await supabase.storage.from('userFiles').createSignedUrl(f.fullPath, 3600)
      if (error || !data?.signedUrl) throw error || new Error('No URL')
      setOcrImageUrl(data.signedUrl)
      setOcrTitleBase(() => { const idx = f.name.lastIndexOf('.'); return idx > 0 ? f.name.slice(0, idx) : f.name })
      setIsOcrOpen(true)
    } catch (e) {
      console.error('Open OCR failed', e)
      toast.error('Failed to open OCR')
    }
  }

  // Prefetch hover preview for images
  const onHoverStartFile = async (f: { fullPath: string; name: string }) => {
    const { isImage } = getFileType(f.name)
    if (!isImage) return
    if (storagePreviewUrls[f.fullPath]) return
    try {
      const { data, error } = await supabase.storage.from('userFiles').createSignedUrl(f.fullPath, 3600)
      if (error || !data?.signedUrl) return
      setStoragePreviewUrls((prev) => ({ ...prev, [f.fullPath]: data.signedUrl }))
    } catch {}
  }

  // Verify storage file ownership only when user requests (no auto on hover)
  const verifyStorageFile = async (f: { fullPath: string; name: string }) => {
    try {
      const { data, error } = await supabase.storage.from('userFiles').createSignedUrl(f.fullPath, 3600)
      if (error || !data?.signedUrl) throw error || new Error('Could not sign URL')
      const res = await fetch(data.signedUrl)
      const blob = await res.blob()
      const fd = new FormData()
      fd.append('file', new File([blob], f.name, { type: blob.type || 'application/octet-stream' }))
      const vr = await fetch('/api/verify', { method: 'POST', body: fd })
      const json = await vr.json().catch(() => ({}))
      if (vr.status === 404 && json?.status === 'not_minted') {
        setOwnedByPath((m) => ({ ...m, [f.fullPath]: false }))
        toast.info('Not minted')
        return
      }
      if (!vr.ok) throw new Error(json?.error || 'Verify failed')
      const minter = (json?.tokenData?.user || json?.owner || '').toLowerCase()
      const owned = Boolean(walletAddress && minter && walletAddress.toLowerCase() === minter)
      setOwnedByPath((m) => ({ ...m, [f.fullPath]: owned }))
      toast.success('Minted')
    } catch (e: any) {
      toast.error(e?.message || 'Verify failed')
    }
  }

  // Handle creating a new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    
    try {
      const style = (newFolderColor || newFolderIcon) ? { color: newFolderColor || undefined, icon: newFolderIcon || undefined } : null
      await createFolder(newFolderName.trim(), currentFolder, style)
      setNewFolderName("")
      setNewFolderColor("")
      setNewFolderIcon("")
      setIsCreateFolderDialogOpen(false)
      toast.success("Folder created successfully")
      // Efficiently refresh storage files (in case folder contains files soon after)
      void refreshStorageFiles()
    } catch (error) {
      console.error("Error creating folder:", error)
      toast.error("Failed to create folder")
    }
  }

  // Open edit folder dialog prefilled with current values from breadcrumb tail
  const openEditFolder = () => {
    const current = folderPath[folderPath.length - 1]
    if (!current) return
    setEditFolderName(current.name || "")
    // We don't have style in path; fetch minimal info
    void (async () => {
      const { data } = await supabase.from('folders').select('style').eq('id', current.id).single()
      const style = (data as any)?.style || {}
      setEditFolderColor(typeof style?.color === 'string' ? style.color : '')
      setEditFolderIcon(typeof style?.icon === 'string' ? style.icon : '')
      setIsEditFolderDialogOpen(true)
    })()
  }

  const handleSaveFolder = async () => {
    const current = folderPath[folderPath.length - 1]
    if (!current) return
    try {
      const updates: any = { name: editFolderName.trim() || undefined, style: { color: editFolderColor || undefined, icon: editFolderIcon || undefined } }
      await updateFolder(current.id, updates)
      setIsEditFolderDialogOpen(false)
      toast.success('Folder updated')
      await refreshFolders()
    } catch (e) {
      console.error('Update folder failed', e)
      toast.error('Failed to update folder')
    }
  }

  const confirmDeleteFolder = async () => {
    const current = folderPath[folderPath.length - 1]
    if (!current) return
    try {
      await deleteFolder(current.id)
      setIsDeleteFolderOpen(false)
      setCurrentFolder(null)
      await refreshFolders()
      await refreshStorageFiles()
      toast.success('Folder deleted')
    } catch (e) {
      console.error('Delete folder failed', e)
      toast.error('Failed to delete folder')
    }
  }

  // Confirm move action (note or storage file)
  const handleConfirmMove = async (folderId: string | null) => {
    try {
      // Move note case
      if (moveNoteId) {
        await moveNoteToFolder(moveNoteId, folderId)
        setMoveNoteId(null)
        setIsMoveDialogOpen(false)
        toast.success('Note moved successfully')
        return
      }
      // Move storage file case: copy to new path then remove old
      if (storageFileToMove && user?.id) {
        const base = user.id
        const newPath = folderId ? `${base}/${folderId}/${storageFileToMove.name}` : `${base}/${storageFileToMove.name}`
        const from = storageFileToMove.fullPath
        // copy then remove old
        const copyRes = await supabase.storage.from('userFiles').copy(from, newPath)
        if (copyRes.error) throw copyRes.error
        const remRes = await supabase.storage.from('userFiles').remove([from])
        if (remRes.error) throw remRes.error
        setStorageFiles((prev) => {
          const withoutOld = prev.filter(f => f.fullPath !== from)
          const added = { name: storageFileToMove.name, updated_at: null, fullPath: newPath }
          return folderId === (currentFolder || null) ? [...withoutOld, added] : withoutOld
        })
        setStorageFileToMove(null)
        setIsMoveDialogOpen(false)
        toast.success('File moved successfully')
        // refresh lists
        void refreshStorageFiles()
        return
      }
    } catch (error) {
      console.error('Error moving item:', error)
      toast.error('Failed to move')
    }
  }

  // Open delete confirmation dialog for a note
  const openDeleteDialogFor = (note: { id: string; title?: string | null }) => {
    setPendingDelete({ id: note.id, title: note.title ?? undefined })
    setDeleteError(null)
    setIsDeleteOpen(true)
  }

  // Confirm delete handler
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
      setNotes((prev) => prev.filter((n) => n.id !== pendingDelete.id))
      setIsDeleteOpen(false)
      setPendingDelete(null)
      toast.success("Note deleted")
    }
    setDeleting(false)
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
    router.push(`/notes?noteId=${encodeURIComponent(id)}`)
  }

  // Build a small, readable snippet from markdown content
  const makeSnippet = (content: string): string => {
    const text = (content || "")
      // strip fenced code blocks quickly
      .replace(/```[\s\S]*?```/g, "")
      // strip inline code
      .replace(/`([^`]*)`/g, "$1")
      // markdown links [text](url) -> text
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      // images ![alt](url) -> alt or [image]
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt) => alt ? `**${alt}**` : "[image]")
    return text.trim().slice(0, 800)
  }

  // Fetch note content on first hover
  const onHoverNote = async (id: string) => {
    if (!user?.id) return
    if (notePreviews[id] !== undefined) return
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('content')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
      if (error) return
      const snippet = makeSnippet((data as any)?.content || '')
      setNotePreviews(prev => ({ ...prev, [id]: snippet }))
    } catch {}
  }

  // Upload to storage bucket userFiles under user-root/currentFolder
  // Utility: split filename into name + extension
  const splitFileName = (name: string): { base: string; ext: string } => {
    const idx = name.lastIndexOf('.')
    if (idx <= 0 || idx === name.length - 1) return { base: name, ext: '' }
    return { base: name.slice(0, idx), ext: name.slice(idx + 1) }
  }

  // Utility: ensure a unique name in a dir by appending (n) before extension
  const ensureUniqueName = async (dirPath: string, filename: string): Promise<string> => {
    const { base, ext } = splitFileName(filename)
    const { data } = await supabase.storage.from('userFiles').list(dirPath, { limit: 1000 })
    const existing = new Set((data || []).map((d: any) => d?.name).filter(Boolean))
    if (!existing.has(filename)) return filename
    let n = 1
    while (true) {
      const candidate = ext ? `${base} (${n}).${ext}` : `${base} (${n})`
      if (!existing.has(candidate)) return candidate
      n++
    }
  }

  const onUploadFiles = async () => {
    try {
      if (!user?.id) return
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.onchange = async () => {
        const files = Array.from(input.files || [])
        if (files.length === 0) return
        setIsUploading(true)
        setUploadTotal(files.length)
        setUploadDone(0)
        setUploadProgress(0)
        const base = user.id
        const sub = currentFolder ? `${currentFolder}` : ""
        const dirPath = sub ? `${base}/${sub}` : `${base}`
        for (const f of files) {
          const base = user.id
          const uniqueName = await ensureUniqueName(dirPath, f.name)
          const path = `${dirPath}/${uniqueName}`
          const { error } = await supabase.storage.from('userFiles').upload(path, f, { upsert: false })
          if (error) {
            toast.error(`Upload failed: ${f.name}`)
          }
          // Attempt to mint the uploaded file with the user's custodial wallet (best-effort)
          try {
            const fd = new FormData()
            fd.append('file', f)
            const { data: wallet } = await supabase.from('wallets').select('address').eq('user_id', user.id).maybeSingle()
            const address = wallet?.address || ''
            if (address) fd.append('userAddress', address)
            await fetch('/api/mint', { method: 'POST', body: fd }).then(r => r.json().catch(() => ({}))).catch(() => {})
          } catch {}
          // update progress per-file
          setUploadDone((d) => {
            const next = d + 1
            const pct = Math.round((next / files.length) * 100)
            setUploadProgress(pct)
            return next
          })
        }
        toast.success('Upload complete')
        // refresh list efficiently
        void refreshStorageFiles()
        setIsUploading(false)
        setUploadProgress(0)
        setUploadTotal(0)
        setUploadDone(0)
      }
      input.click()
    } catch (e) {
      console.error('Upload error', e)
      toast.error('Upload failed')
      setIsUploading(false)
    }
  }

  // Optional: keep event-based refresh for other modules to trigger
  useEffect(() => {
    const handler = () => { void refreshStorageFiles() }
    window.addEventListener('storage-updated', handler as EventListener)
    return () => window.removeEventListener('storage-updated', handler as EventListener)
  }, [refreshStorageFiles])

  const openDeleteStorageDialogFor = (file: { name: string; fullPath: string }) => {
    setPendingDeleteStorage(file)
    setDeleteStorageError(null)
    setIsDeleteStorageOpen(true)
  }

  const confirmDeleteStorage = async () => {
    if (!pendingDeleteStorage) return
    setDeletingStorage(true)
    setDeleteStorageError(null)
    const { error } = await supabase.storage.from('userFiles').remove([pendingDeleteStorage.fullPath])
    if (error) {
      setDeleteStorageError(error.message)
    } else {
      setStorageFiles((prev) => prev.filter((f) => f.fullPath !== pendingDeleteStorage.fullPath))
      setIsDeleteStorageOpen(false)
      setPendingDeleteStorage(null)
      toast.success('File deleted')
    }
    setDeletingStorage(false)
  }

  const onGetFileUrl = async (file: { fullPath: string }) => {
    try {
      const pub = supabase.storage.from('userFiles').getPublicUrl(file.fullPath)
      const publicUrl = pub?.data?.publicUrl || ''
      let finalUrl = publicUrl
      let useSigned = false
      if (!publicUrl) {
        useSigned = true
      } else {
        try {
          const head = await fetch(publicUrl, { method: 'HEAD' })
          if (!head.ok) useSigned = true
        } catch {
          useSigned = true
        }
      }
      if (useSigned) {
        const { data, error } = await supabase.storage.from('userFiles').createSignedUrl(file.fullPath, 3600)
        if (error || !data?.signedUrl) throw error || new Error('No URL')
        finalUrl = data.signedUrl
        toast.message('Bucket is private; copied a temporary link (1 hour)')
      }
      await navigator.clipboard.writeText(finalUrl)
      if (!useSigned) toast.success('Permanent URL copied to clipboard')
    } catch (e) {
      console.error('Get URL failed', e)
      toast.error('Failed to get URL')
    }
  }

  // Click-to-download
  const onDownloadFile = async (f: { fullPath: string; name?: string }) => {
    try {
      const { data, error } = await supabase.storage.from('userFiles').createSignedUrl(f.fullPath, 3600)
      if (error || !data?.signedUrl) throw error || new Error('No URL')
      // Fetch the file to avoid cross-origin behavior that opens a new tab
      const resp = await fetch(data.signedUrl)
      if (!resp.ok) throw new Error('Failed to fetch file')
      const blob = await resp.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = f.name || 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoke after a short delay to ensure the download has started
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (e) {
      console.error('Download failed', e)
      toast.error('Download failed')
    }
  }

  // Preview using signed URL
  const onPreviewFile = async (f: { fullPath: string; name: string }) => {
    try {
      const { data, error } = await supabase.storage.from('userFiles').createSignedUrl(f.fullPath, 3600)
      if (error || !data?.signedUrl) throw error || new Error('No URL')
      const lower = f.name.toLowerCase()
      let type: typeof previewType = 'unknown'
      if (/(\.png|\.jpe?g|\.gif|\.webp|\.bmp|\.svg)$/.test(lower)) type = 'image'
      else if (/(\.mp4|\.webm|\.ogg)$/.test(lower)) type = 'video'
      else if (/(\.mp3|\.wav|\.ogg)$/.test(lower)) type = 'audio'
      else if (/(\.pdf)$/.test(lower)) type = 'pdf'
      setPreviewType(type)
      setPreviewUrl(data.signedUrl)
      setPreviewName(f.name)
      setIsPreviewOpen(true)
    } catch (e) {
      console.error('Preview failed', e)
      toast.error('Failed to open preview')
    }
  }

  // Rename storage file: copy to same folder with new name, remove old, refresh
  const onConfirmRename = async () => {
    try {
      if (!renameTarget || !user?.id) return
      let newName = renameNewName.trim()
      // Auto extension handling: if user omitted extension, preserve original
      const oldParts = renameTarget.name.split('.')
      const oldExt = oldParts.length > 1 ? oldParts.pop() as string : ''
      if (oldExt && !newName.includes('.')) newName = `${newName}.${oldExt}`
      if (!newName || newName === renameTarget.name) { setIsRenameOpen(false); return }
      // Determine folder segment from old fullPath: `${user.id}/${maybeFolder}/${oldName}`
      const parts = renameTarget.fullPath.split('/')
      if (parts[0] !== user.id) throw new Error('Invalid file path')
      const base = user.id
      const folderSegs = parts.slice(1, -1) // between user id and filename
      const dirPath = folderSegs.length > 0 ? `${base}/${folderSegs.join('/')}` : `${base}`
      // Collision handling: ensure unique name
      const finalName = await ensureUniqueName(dirPath, newName)
      const newPath = `${dirPath}/${finalName}`
      const from = renameTarget.fullPath
      const copyRes = await supabase.storage.from('userFiles').copy(from, newPath)
      if (copyRes.error) throw copyRes.error
      const remRes = await supabase.storage.from('userFiles').remove([from])
      if (remRes.error) throw remRes.error
      setIsRenameOpen(false)
      setRenameTarget(null)
      // Update local list efficiently
      setStorageFiles((prev) => {
        const withoutOld = prev.filter(f => f.fullPath !== from)
        const added = { name: finalName, updated_at: null, fullPath: newPath }
        return [...withoutOld, added]
      })
      // Refresh previews and list
      setStoragePreviewUrls((prev) => { const next = { ...prev }; delete next[from]; return next })
      void refreshStorageFiles()
      toast.success('File renamed')
    } catch (e) {
      console.error('Rename failed', e)
      toast.error('Failed to rename')
    }
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
                    <BreadcrumbLink href="/files">Drive</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  {folderPath.length > 0 && (
                    <>
                      {folderPath.slice(0, -1).map((folder, index) => (
                        <>
                          <BreadcrumbItem key={`${folder.id}-${index}`}>
                            <BreadcrumbLink onClick={() => setCurrentFolder(folder.id)}>{folder.name}</BreadcrumbLink>
                          </BreadcrumbItem>
                          <BreadcrumbSeparator className="hidden md:block" />
                        </>
                      ))}
                      <BreadcrumbItem>
                        <BreadcrumbPage>{folderPath[folderPath.length - 1]?.name}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                  {folderPath.length === 0 && (
                    <BreadcrumbItem>
                      <BreadcrumbPage>All files</BreadcrumbPage>
                    </BreadcrumbItem>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            {folderPath.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Navigate back to parent folder or root
                  const parentFolder = folderPath.length > 1 ? folderPath[folderPath.length - 2].id : null
                  setCurrentFolder(parentFolder)
                }}
                className="ml-auto"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
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
              <div className="ml-auto flex items-center gap-2">
                {currentFolder && (
                  <>
                    <Button size="sm" variant="outline" onClick={openEditFolder}>
                      Folder Settings
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setIsDeleteFolderOpen(true)}>
                      Delete Folder
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={() => setIsScanOpen(true)}>
                  <Camera className="h-4 w-4 mr-2" />
                  Scan
                </Button>
                <Button size="sm" variant="outline" onClick={() => void onUploadFiles()}>
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsCreateFolderDialogOpen(true)}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </Button>
                <div className="flex items-center gap-1 rounded-md border bg-card p-1">
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
            </div>

            {isUploading && (
              <div className="mb-4 rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Uploading {uploadDone}/{uploadTotal}…</span>
                  <span className="ml-auto text-xs text-muted-foreground">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            {/* Delete Storage File Dialog (shared UI) */}
            <NoteDeleteDialog
              open={isDeleteStorageOpen}
              onOpenChange={(o) => {
                setIsDeleteStorageOpen(o)
                if (!o) setPendingDeleteStorage(null)
              }}
              noteTitle={pendingDeleteStorage?.name}
              onConfirm={confirmDeleteStorage}
              isDeleting={deletingStorage}
              error={deleteStorageError}
            />

            {/* Rename Storage File Dialog */}
            <Dialog open={isRenameOpen} onOpenChange={(o) => setIsRenameOpen(o)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rename file</DialogTitle>
                  <DialogDescription>Change the file name within this folder.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Input
                    value={renameNewName}
                    onChange={(e) => setRenameNewName(e.target.value)}
                    placeholder="New file name (with extension)"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (async () => { await onConfirmRename() })() } }}
                  />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
                  <Button onClick={() => void onConfirmRename()} disabled={!renameTarget || !renameNewName.trim()}>Rename</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* OCR Modal */}
            <OcrDoclingModal
              open={isOcrOpen}
              onOpenChange={setIsOcrOpen}
              imageUrl={ocrImageUrl}
              onMarkdown={async (markdown) => {
                try {
                  if (!user?.id) return
                  const titleBase = ocrTitleBase || 'Scan'
                  const { error } = await supabase.from('notes').insert({
                    user_id: user.id,
                    title: `${titleBase} (OCR)`,
                    content: markdown,
                    folder_id: currentFolder ?? null,
                  })
                  if (error) throw error
                  toast.success('Note created from OCR')
                } catch (e) {
                  console.error('Create note from OCR failed', e)
                  toast.error('Failed to create note')
                }
              }}
            />

            <Dialog open={isPreviewOpen} onOpenChange={(o) => setIsPreviewOpen(o)}>
              <DialogContent className="max-w-5xl">
                <DialogHeader>
                  <DialogTitle>{previewName || 'Preview'}</DialogTitle>
                  <DialogDescription>Preview file</DialogDescription>
                </DialogHeader>
                <div className="w-full">
                  {previewType === 'image' && previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt={previewName} className="max-h-[70vh] w-auto mx-auto object-contain" />
                  )}
                  {previewType === 'video' && previewUrl && (
                    <video src={previewUrl} controls className="max-h-[70vh] w-full" />
                  )}
                  {previewType === 'audio' && previewUrl && (
                    <audio src={previewUrl} controls className="w-full" />
                  )}
                  {previewType === 'pdf' && previewUrl && (
                    <iframe src={previewUrl} className="h-[75vh] w-full" />
                  )}
                  {previewType === 'unknown' && previewUrl && (
                    <div className="text-sm">
                      <a href={previewUrl} target="_blank" rel="noreferrer" className="underline">Open in new tab</a>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Scanner Dialog */}
            <Dialog open={isScanOpen} onOpenChange={(o) => setIsScanOpen(o)}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Scan document</DialogTitle>
                  <DialogDescription>Capture one JPEG or a multi-page PDF, then upload.</DialogDescription>
                </DialogHeader>
                <div>
                  <DocumentScanner
                    onClose={() => setIsScanOpen(false)}
                    onSaveJpeg={async (blob: Blob) => {
                      if (!user?.id) return
                      try {
                        const base = user.id
                        const sub = currentFolder ? `${currentFolder}` : ""
                        const dirPath = sub ? `${base}/${sub}` : `${base}`
                        const ts = new Date()
                        const name = `Scan ${ts.toISOString().slice(0,19).replace(/[:T]/g, '-')}.jpg`
                        const uniqueName = await ensureUniqueName(dirPath, name)
                        const path = `${dirPath}/${uniqueName}`
                        const { error } = await supabase.storage.from('userFiles').upload(path, blob, { upsert: false, contentType: 'image/jpeg' })
                        if (error) throw error
                        toast.success('Scan uploaded')
                        void refreshStorageFiles()
                      } catch (e) {
                        console.error('Scan upload failed', e)
                        toast.error('Failed to upload scan')
                      }
                    }}
                    onSavePdf={async (blob: Blob) => {
                      if (!user?.id) return
                      try {
                        const base = user.id
                        const sub = currentFolder ? `${currentFolder}` : ""
                        const dirPath = sub ? `${base}/${sub}` : `${base}`
                        const ts = new Date()
                        const name = `Scan ${ts.toISOString().slice(0,19).replace(/[:T]/g, '-')}.pdf`
                        const uniqueName = await ensureUniqueName(dirPath, name)
                        const path = `${dirPath}/${uniqueName}`
                        const { error } = await supabase.storage.from('userFiles').upload(path, blob, { upsert: false, contentType: 'application/pdf' })
                        if (error) throw error
                        toast.success('Scan uploaded')
                        void refreshStorageFiles()
                      } catch (e) {
                        console.error('Scan upload failed', e)
                        toast.error('Failed to upload scan')
                      }
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>
            

          {loading && view === "grid" && (
            <Grid>
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </Grid>
          )}
          {loading && view === "list" && (
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

            {!loading && !error && subfolders.length === 0 && filteredNotes.length === 0 && storageFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-1">No items found</h3>
                <p className="text-sm text-muted-foreground">Create a new note, folder, or upload files to get started.</p>
              </div>
            )}

            {!loading && !error && view === "grid" && (subfolders.length > 0 || storageFiles.length > 0 || filteredNotes.length > 0) && (
              <div className="space-y-4">
                {subfolders.length > 0 && (
                  <Grid>
                    {subfolders.map((f: any) => (
                      <FolderCard 
                        key={f.id}
                        name={f.name}
                        style={f.style || null}
                        onClick={() => setCurrentFolder(f.id)}
                      />
                    ))}
                  </Grid>
                )}
                {storageFiles.length > 0 && (
                  <Grid>
                    {storageFiles.map((f) => (
                      <StorageFileCard
                        key={f.fullPath}
                        file={f}
                        fileType={getFileType(f.name).label}
                        previewUrl={storagePreviewUrls[f.fullPath]}
                        onHoverStart={() => { void onHoverStartFile({ fullPath: f.fullPath, name: f.name }) }}
                        onClick={() => void onPreviewFile({ fullPath: f.fullPath, name: f.name })}
                        onPreview={(e) => { e.stopPropagation(); void onPreviewFile({ fullPath: f.fullPath, name: f.name }) }}
                        onConvertToMd={(e) => { e.stopPropagation(); void openOcrForFile({ fullPath: f.fullPath, name: f.name }) }}
                        onGetUrl={(e) => { e.stopPropagation(); void onGetFileUrl(f) }}
                        onDelete={(e) => { e.stopPropagation(); openDeleteStorageDialogFor({ name: f.name, fullPath: f.fullPath }) }}
                        onMoveClick={(e) => { e.stopPropagation(); setStorageFileToMove({ fullPath: f.fullPath, name: f.name }); setSelectedMoveFolderId(currentFolder ?? null); setIsMoveDialogOpen(true) }}
                        onRenameClick={(e) => { e.stopPropagation(); setRenameTarget({ fullPath: f.fullPath, name: f.name }); setRenameNewName(f.name); setIsRenameOpen(true) }}
                        onVerifyClick={(e) => { e.stopPropagation(); void verifyStorageFile({ fullPath: f.fullPath, name: f.name }) }}
                        ownedByYou={ownedByPath[f.fullPath] ?? null}
                      />
                    ))}
                  </Grid>
                )}
                {filteredNotes.length > 0 && (
                  <Grid>
                    {filteredNotes.map((n) => (
                      <NoteCard 
                        key={n.id} 
                        note={n} 
                        onClick={() => onOpenNote(n.id)}
                        previewSnippet={notePreviews[n.id]}
                        onHoverStart={() => void onHoverNote(n.id)}
                        onMoveClick={(e) => {
                          e.stopPropagation()
                          setMoveNoteId(n.id)
                          setSelectedMoveFolderId(currentFolder ?? null)
                          setIsMoveDialogOpen(true)
                        }}
                        onDeleteClick={(e) => {
                          e.stopPropagation()
                          openDeleteDialogFor({ id: n.id, title: n.title })
                        }}
                        onVerifyClick={async (e) => {
                          e.stopPropagation()
                          try {
                            // Fetch content to verify
                            const { data, error } = await supabase
                              .from('notes')
                              .select('content')
                              .eq('id', n.id)
                              .eq('user_id', user?.id)
                              .maybeSingle()
                            if (error) throw error
                            const content = (data as any)?.content || ''
                            if (!content) { toast.message('Note is empty'); return }
                            const fd = new FormData()
                            fd.append('file', new File([content], `${(n.title || 'note').slice(0, 40)}.md`, { type: 'text/markdown' }))
                            const vr = await fetch('/api/verify', { method: 'POST', body: fd })
                            const j = await vr.json().catch(() => ({}))
                            if (vr.status === 404 && j?.status === 'not_minted') {
                              toast.info('Not minted')
                            } else if (vr.ok) {
                              toast.success('Minted')
                            } else {
                              toast.error(j?.error || 'Verify failed')
                            }
                          } catch (err: any) {
                            toast.error(err?.message || 'Verify failed')
                          }
                        }}
                      />
                    ))}
                  </Grid>
                )}
              </div>
            )}
            {!loading && !error && view === "list" && (subfolders.length > 0 || storageFiles.length > 0 || filteredNotes.length > 0) && (
              <div className="overflow-hidden rounded-md border">
                <div className="hidden grid-cols-12 gap-2 bg-muted/60 px-3 py-2 text-xs text-muted-foreground md:grid">
                  <div className="col-span-6">Name</div>
                  <div className="col-span-3">Project/Category</div>
                  <div className="col-span-3">Last modified</div>
                </div>
                <div className="divide-y">
                  {subfolders.map((f: any) => (
                    <FolderRow
                      key={f.id}
                      name={f.name}
                      style={f.style || null}
                      onClick={() => setCurrentFolder(f.id)}
                      onMoveClick={undefined}
                    />
                  ))}
                  {storageFiles.map((f) => (
                    <StorageFileRow
                      key={f.fullPath}
                      file={f}
                      fileType={getFileType(f.name).label}
                      previewUrl={storagePreviewUrls[f.fullPath]}
                      onHoverStart={() => { void onHoverStartFile({ fullPath: f.fullPath, name: f.name }) }}
                      onClick={() => void onPreviewFile({ fullPath: f.fullPath, name: f.name })}
                      onPreview={(e) => { e.stopPropagation(); void onPreviewFile({ fullPath: f.fullPath, name: f.name }) }}
                      onConvertToMd={(e) => { e.stopPropagation(); void openOcrForFile({ fullPath: f.fullPath, name: f.name }) }}
                      onGetUrl={(e) => { e.stopPropagation(); void onGetFileUrl(f) }}
                      onDelete={(e) => { e.stopPropagation(); openDeleteStorageDialogFor({ name: f.name, fullPath: f.fullPath }) }}
                      onMoveClick={(e) => { e.stopPropagation(); setStorageFileToMove({ fullPath: f.fullPath, name: f.name }); setSelectedMoveFolderId(currentFolder ?? null); setIsMoveDialogOpen(true) }}
                      onRenameClick={(e) => { e.stopPropagation(); setRenameTarget({ fullPath: f.fullPath, name: f.name }); setRenameNewName(f.name); setIsRenameOpen(true) }}
                      onVerifyClick={(e) => { e.stopPropagation(); void verifyStorageFile({ fullPath: f.fullPath, name: f.name }) }}
                      ownedByYou={ownedByPath[f.fullPath] ?? null}
                    />
                  ))}
                  {filteredNotes.map((n) => (
                    <NoteRow 
                      key={n.id} 
                      note={n} 
                      onClick={() => onOpenNote(n.id)}
                      previewSnippet={notePreviews[n.id]}
                      onHoverStart={() => void onHoverNote(n.id)}
                      onMoveClick={(e) => {
                        e.stopPropagation()
                        setMoveNoteId(n.id)
                        setSelectedMoveFolderId(currentFolder ?? null)
                        setIsMoveDialogOpen(true)
                      }}
                      onDeleteClick={(e) => {
                        e.stopPropagation()
                        openDeleteDialogFor({ id: n.id, title: n.title })
                      }}
                      onVerifyClick={async (e) => {
                        e.stopPropagation()
                        try {
                          const { data, error } = await supabase
                            .from('notes')
                            .select('content')
                            .eq('id', n.id)
                            .eq('user_id', user?.id)
                            .maybeSingle()
                          if (error) throw error
                          const content = (data as any)?.content || ''
                          if (!content) { toast.message('Note is empty'); return }
                          const fd = new FormData()
                          fd.append('file', new File([content], `${(n.title || 'note').slice(0, 40)}.md`, { type: 'text/markdown' }))
                          const vr = await fetch('/api/verify', { method: 'POST', body: fd })
                          const j = await vr.json().catch(() => ({}))
                          if (vr.status === 404 && j?.status === 'not_minted') {
                            toast.info('Not minted')
                          } else if (vr.ok) {
                            toast.success('Minted')
                          } else {
                            toast.error(j?.error || 'Verify failed')
                          }
                        } catch (err: any) {
                          toast.error(err?.message || 'Verify failed')
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {/* Create Folder Dialog */}
            <Dialog open={isCreateFolderDialogOpen} onOpenChange={(o) => setIsCreateFolderDialogOpen(o)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create folder</DialogTitle>
                  <DialogDescription>Give your new folder a name.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void handleCreateFolder()
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      value={newFolderColor}
                      onChange={(e) => setNewFolderColor(e.target.value)}
                      placeholder="#AABBCC or tailwind token"
                    />
                    <Input
                      value={newFolderIcon}
                      onChange={(e) => setNewFolderIcon(e.target.value)}
                      placeholder="Icon (emoji or Lucide name)"
                    />
                  </div>
                  {/* Color Presets */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Quick Colors:</label>
                    <div className="flex flex-wrap gap-2">
                      {PASTEL_COLORS.map((preset) => (
                        <ColorPreset
                          key={preset.value}
                          color={preset.value}
                          onSelect={() => setNewFolderColor(preset.value)}
                          isSelected={newFolderColor === preset.value}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsCreateFolderDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => void handleCreateFolder()} disabled={!newFolderName.trim()}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Folder Dialog */}
            <Dialog open={isEditFolderDialogOpen} onOpenChange={(o) => setIsEditFolderDialogOpen(o)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit folder</DialogTitle>
                  <DialogDescription>Change the folder name, color or icon.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Input
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        placeholder="Folder name"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          value={editFolderColor}
                          onChange={(e) => setEditFolderColor(e.target.value)}
                          placeholder="#AABBCC or tailwind token"
                        />
                        <Input
                          value={editFolderIcon}
                          onChange={(e) => setEditFolderIcon(e.target.value)}
                          placeholder="Icon (emoji or Lucide name)"
                        />
                      </div>
                      {/* Color Presets */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Quick Colors:</label>
                        <div className="flex flex-wrap gap-2">
                          {PASTEL_COLORS.map((preset) => (
                            <ColorPreset
                              key={preset.value}
                              color={preset.value}
                              onSelect={() => setEditFolderColor(preset.value)}
                              isSelected={editFolderColor === preset.value}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <FolderIconPreview icon={editFolderIcon} color={editFolderColor} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsEditFolderDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => void handleSaveFolder()} disabled={!editFolderName.trim()}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Move Note Dialog */}
            <Dialog
              open={isMoveDialogOpen}
              onOpenChange={(o) => {
                setIsMoveDialogOpen(o)
                if (!o) {
                  setMoveNoteId(null)
                }
              }}
            >
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Move note</DialogTitle>
                  <DialogDescription>Select a destination folder.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[50vh] overflow-y-auto rounded-md border">
                  {/* Root option */}
                  <div
                    className={`flex items-center p-2 cursor-pointer ${selectedMoveFolderId === null ? 'bg-accent' : 'hover:bg-accent/50'}`}
                    onClick={() => setSelectedMoveFolderId(null)}
                  >
                    <span className="ml-2">Drive</span>
                  </div>
                  {/* Folder tree */}
                  <div>
                    {Array.isArray(folders) && folders.filter(f => !f.parent_id).map((f: any) => (
                      <FolderTreeItem
                        key={f.id}
                        folder={f}
                        currentFolderId={selectedMoveFolderId}
                        onSelect={(id) => setSelectedMoveFolderId(id)}
                      />
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsMoveDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => handleConfirmMove(selectedMoveFolderId)}
                    disabled={!moveNoteId && !storageFileToMove}
                  >
                    Move here
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Note Dialog (shared) */}
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
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 content-start items-start justify-start">
      {children}
    </div>
  )
}
