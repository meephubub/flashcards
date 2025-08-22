"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export interface CreateModelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateModelDialog({ open, onOpenChange }: CreateModelDialogProps) {
  const { user } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setName("")
      setFile(null)
      setMetadata("")
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  const handleSubmit = async () => {
    try {
      if (!user?.id) { setError('Not signed in'); return }
      if (!name.trim()) { setError('Name is required'); return }
      if (!file) { setError('Please choose a model file (.glb, .gltf, .stl)'); return }
      setSubmitting(true)
      setError(null)

      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !['glb','gltf','stl'].includes(ext)) {
        throw new Error('Unsupported model type. Use .glb, .gltf or .stl')
      }

      const fd = new FormData()
      fd.set('file', file)
      fd.set('user_id', user.id)
      const res = await fetch('/api/upload-cad', { method: 'POST', body: fd })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `Upload failed (${res.status})`)
      }
      const j = await res.json().catch(() => ({})) as { url?: string }
      const publicUrl = j.url
      if (!publicUrl) throw new Error('Upload failed: missing URL')

      // Parse metadata JSON if provided
      let meta: any = null
      if (metadata.trim()) {
        try { meta = JSON.parse(metadata) } catch { throw new Error('Metadata must be valid JSON') }
      }

      // Insert DB row (first try with user_id, fallback without if column missing)
      let insertedId: string | null = null
      {
        const { data, error } = await supabase
          .from('models')
          .insert([{ name: name.trim(), model_url: publicUrl, metadata: meta, user_id: user.id } as any])
          .select('id')
          .single()
        if (error) {
          if ((error as any).code === '42703') {
            const { data: d2, error: e2 } = await supabase
              .from('models')
              .insert([{ name: name.trim(), model_url: publicUrl, metadata: meta }])
              .select('id')
              .single()
            if (e2) throw new Error(e2.message)
            insertedId = (d2 as any)?.id ?? null
          } else {
            throw new Error(error.message)
          }
        } else {
          insertedId = (data as any)?.id ?? null
        }
      }

      onOpenChange(false)
      // Navigate to viewer
      if (insertedId) router.push(`/viewer?m=${insertedId}`)
    } catch (e: any) {
      setError(e?.message || 'Failed to create model')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 max-w-md rounded-xl shadow-2xl p-0">
        <div className="p-6 sm:p-8">
          <DialogHeader className="mb-6">
            <ShadDialogTitle className="text-2xl font-bold tracking-tight">New Model</ShadDialogTitle>
            <DialogDescription className="text-neutral-500 dark:text-neutral-400 mt-1">
              Upload a 3D file (.glb, .gltf, .stl) and give it a name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My model" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">File (.glb, .gltf, .stl)</label>
              <Input type="file" accept=".glb,.gltf,.stl" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Metadata (JSON, optional)</label>
              <Textarea value={metadata} onChange={(e) => setMetadata(e.target.value)} placeholder='{"category":"cad"}' className="min-h-[100px]" />
            </div>

            {error && (
              <div className="text-red-500 text-sm p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-md">{error}</div>
            )}
          </div>

          <DialogFooter className="mt-6 flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}
              className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900">
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting || !name.trim() || !file}
              className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100">
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
