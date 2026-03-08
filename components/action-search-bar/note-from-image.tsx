import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabase"
import { useNoteContextStore } from "@/hooks/use-note-context"

interface NoteFromImageProps {
    onClose: () => void
}

export function NoteFromImage({ onClose }: NoteFromImageProps) {
    const [title, setTitle] = useState("")
    const [project, setProject] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [working, setWorking] = useState(false)
    const [progress, setProgress] = useState(0)
    const [message, setMessage] = useState("Idle")

    const messages = [
        "Working on your request…",
        "Uploading image to storage…",
        "Processing image…",
        "Extracting Markdown…",
        "Linking images…",
        "Saving note…",
        "Almost done…",
    ]

    const reset = () => {
        setTitle("")
        setProject("")
        setFile(null)
        setError(null)
        setWorking(false)
        setProgress(0)
        setMessage("Idle")
    }

    const handleCreate = async () => {
        setError(null)
        if (!file) {
            setError('Please select an image')
            return
        }
        try {
            setWorking(true)
            setProgress(0)
            // 2 minute timeline
            const start = Date.now()
            const total = 120000
            const timer = setInterval(() => {
                const elapsed = Date.now() - start
                const pct = Math.min(100, (elapsed / total) * 100)
                setProgress(pct)
            }, 200)
            let msgIdx = 0
            setMessage(messages[msgIdx])
            const msgTimer = setInterval(() => {
                msgIdx = (msgIdx + 1) % messages.length
                setMessage(messages[msgIdx])
            }, 9000)

            // Upload/process
            const fd = new FormData()
            fd.append('file', file)
            const res = await fetch('/api/note-from-image', { method: 'POST', body: fd })
            if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || 'Failed to process image')
            const j = await res.json()

            // Create note
            const { data: userRes } = await supabase.auth.getUser()
            const userId = userRes?.user?.id
            if (!userId) throw new Error('Not signed in')
            const finalTitle = title.trim() || j.title || (file.name.replace(/\.[^.]+$/, '')) || 'Image Note'
            const finalProject = project.trim()
            const content: string = j.content || ''
            if (!content) throw new Error('No markdown content returned')
            setMessage('Saving note…')
            const { data, postError } = await supabase
                .from('notes')
                .insert([{ title: finalTitle, category: '', content, project: finalProject, user_id: userId }])
                .select('id')
                .single()
            if (postError) throw new Error(postError.message)

            const newId = (data as { id?: string } | null)?.id
            if (newId) {
                try { useNoteContextStore.getState?.()?.setCurrentNoteId?.(newId) } catch { }
            }

            // Done: fast-forward progress and close
            setProgress(100)
            clearInterval(timer)
            clearInterval(msgTimer)
            // Keep palette open feel but redirect to notes
            const a = document.createElement('a')
            a.href = '/notes'
            document.body.appendChild(a)
            a.click()
            a.remove()
            // Close palette after redirect
            onClose()
            reset()
        } catch (e: any) {
            console.error(e)
            setError(e?.message || 'Failed to create note from image')
        } finally {
            setWorking(false)
        }
    }

    return (
        <div className="p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium">Title</label>
                    <Input
                        placeholder="Note title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={working}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium">Project</label>
                    <Input
                        placeholder="Project (optional)"
                        value={project}
                        onChange={(e) => setProject(e.target.value)}
                        disabled={working}
                    />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-xs font-medium">Image</label>
                <Input
                    type="file"
                    accept="image/*"
                    disabled={working}
                    onChange={(e) => setFile((e.target.files && e.target.files[0]) || null)}
                />
            </div>
            {error && (
                <div className="text-xs text-red-600">{error}</div>
            )}
            {working && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                        <span>{message}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="text-[10px] text-neutral-500">Estimated ~2 minutes</div>
                </div>
            )}
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    className="px-3 py-1.5 text-sm rounded-md border border-black/10 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    disabled={working}
                    onClick={() => {
                        reset()
                        onClose()
                    }}
                >
                    Back
                </button>
                <button
                    type="button"
                    className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    disabled={working || !file}
                    onClick={handleCreate}
                >
                    {working ? 'Working…' : 'Create'}
                </button>
            </div>
        </div>
    )
}
