"use client"

import { createContext, useContext, useCallback, useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import { Tables } from "@/types/supabase"

type FolderWithChildren = Tables<"folders"> & {
  children: FolderWithChildren[]
  notes?: Tables<"notes">[]
}

type FolderContextType = {
  currentFolder: string | null
  setCurrentFolder: (id: string | null) => void
  folderPath: { id: string; name: string }[]
  createFolder: (name: string, parentId?: string | null, style?: { color?: string; icon?: string } | null) => Promise<void>
  updateFolder: (id: string, updates: { name?: string; parent_id?: string | null; style?: { color?: string; icon?: string } | null }) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  moveNoteToFolder: (noteId: string, folderId: string | null) => Promise<void>
  getFolderPath: (folderId: string | null) => Promise<{ id: string; name: string }[]>
  loading: boolean
  error: string | null
  folders: FolderWithChildren[]
  refreshFolders: () => Promise<void>
}

const FolderContext = createContext<FolderContextType | undefined>(undefined)

export function FolderProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([])
  const [folders, setFolders] = useState<FolderWithChildren[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all folders for the current user
  const fetchFolders = useCallback(async (): Promise<FolderWithChildren[]> => {
    if (!user?.id) return []
    
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })
      
      if (error) throw error
      
      // Build folder tree
      const buildTree = (parentId: string | null): FolderWithChildren[] => {
        return (data || [])
          .filter((folder: any) => folder.parent_id === parentId)
          .map((folder: any) => ({
            ...folder,
            children: buildTree(folder.id)
          }))
      }
      
      const tree = buildTree(null)
      setFolders(tree)
      return tree
    } catch (err) {
      console.error('Error fetching folders:', err)
      setError('Failed to load folders')
      return []
    } finally {
      setLoading(false)
    }
  }, [user?.id, supabase])

  // Refresh folder data
  const refreshFolders = useCallback(async (): Promise<void> => {
    await fetchFolders()
  }, [fetchFolders])

  // Get path to current folder
  const getFolderPath = useCallback(async (folderId: string | null): Promise<{ id: string; name: string }[]> => {
    if (!folderId) return []
    
    const path: { id: string; name: string }[] = []
    let currentId: string | null | undefined = folderId
    
    while (currentId) {
      const { data } = await supabase
        .from('folders')
        .select('id, name, parent_id')
        .eq('id', currentId)
        .single()
      const row = (data as { id: string; name: string; parent_id: string | null } | null)
      if (!row) break
      path.unshift({ id: row.id, name: row.name })
      currentId = row.parent_id
    }
    
    return path
  }, [supabase])

  // Update folder path when current folder changes
  useEffect(() => {
    if (!currentFolder) {
      setFolderPath([])
      return
    }
    
    getFolderPath(currentFolder).then(setFolderPath).catch(console.error)
  }, [currentFolder, getFolderPath])

  // Create a new folder
  const createFolder = useCallback(async (name: string, parentId: string | null = null, style: { color?: string; icon?: string } | null = null) => {
    if (!user?.id) throw new Error('Not authenticated')
    
    const { error } = await supabase
      .from('folders')
      .insert({
        name,
        parent_id: parentId,
        user_id: user.id,
        // style is a jsonb column in db
        style: style ? style : null,
      })
    
    if (error) throw error
    
    await refreshFolders()
  }, [user?.id, supabase, refreshFolders])

  // Update a folder
  const updateFolder = useCallback(async (id: string, updates: { name?: string; parent_id?: string | null; style?: { color?: string; icon?: string } | null }) => {
    const { error } = await supabase
      .from('folders')
      .update(updates)
      .eq('id', id)
    
    if (error) throw error
    
    await refreshFolders()
  }, [supabase, refreshFolders])

  // Delete a folder: reparent child folders to this folder's parent, and set notes.folder_id to null
  const deleteFolder = useCallback(async (id: string) => {
    // First get the folder to find its parent
    const { data: folder } = await supabase
      .from('folders')
      .select('parent_id')
      .eq('id', id)
      .single()
    
    if (!folder) throw new Error('Folder not found')
    
    // Update all child folders to point to this folder's parent
    await supabase
      .from('folders')
      .update({ parent_id: folder.parent_id })
      .eq('parent_id', id)
    
    // Remove folder association from notes in this folder
    await supabase
      .from('notes')
      .update({ folder_id: null })
      .eq('folder_id', id)
    
    // Now delete the folder
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    await refreshFolders()
  }, [supabase, refreshFolders])

  // Move a note to a different folder
  const moveNoteToFolder = useCallback(async (noteId: string, folderId: string | null) => {
    const { error } = await supabase
      .from('notes')
      .update({ folder_id: folderId })
      .eq('id', noteId)
    
    if (error) throw error
  }, [supabase])

  // Initial data load
  useEffect(() => {
    refreshFolders()
  }, [refreshFolders])

  return (
    <FolderContext.Provider
      value={{
        currentFolder,
        setCurrentFolder,
        folderPath,
        createFolder,
        updateFolder,
        deleteFolder,
        moveNoteToFolder,
        getFolderPath,
        loading,
        error,
        folders,
        refreshFolders,
      }}
    >
      {children}
    </FolderContext.Provider>
  )
}

export function useFolder() {
  const context = useContext(FolderContext)
  if (context === undefined) {
    throw new Error('useFolder must be used within a FolderProvider')
  }
  return context
}
