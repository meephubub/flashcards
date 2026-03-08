import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useNoteContextStore } from "@/hooks/use-note-context"
import { haptics } from "@/lib/haptics"

interface NoteRow { id: string; title: string | null; category: string | null; project: string | null; updated_at: string | null }

interface NoteSearchProps {
    query: string
    onClose: () => void
}

export function NoteSearch({ query: globalQuery, onClose }: NoteSearchProps) {
    const [category, setCategory] = useState("")
    const [project, setProject] = useState("")
    const [results, setResults] = useState<NoteRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        const searchNotes = async () => {
            try {
                setLoading(true)
                setError(null)
                const { data: userRes, error: uErr } = await supabase.auth.getUser()
                if (uErr) throw uErr
                const uid = userRes?.user?.id
                if (!uid) { setResults([]); return }
                let q = (supabase as any)
                    .from('notes')
                    .select('id,title,category,project,updated_at')
                    .eq('user_id', uid)
                const term = globalQuery.trim()
                if (term) {
                    const like = `%${term}%`
                    q = q.or(`title.ilike.${like},content.ilike.${like}`)
                }
                if (category.trim()) q = q.eq('category', category.trim())
                if (project.trim()) q = q.eq('project', project.trim())
                q = q.order('updated_at', { ascending: false }).limit(30)
                const { data, error } = await q
                if (error) throw error
                setResults(((data as unknown) as NoteRow[]) || [])
            } catch (e: any) {
                console.error('Notes search failed', e)
                setError(e?.message || 'Failed to search notes')
            } finally {
                setLoading(false)
            }
        }

        // Debounce slightly
        const timeout = setTimeout(searchNotes, 300)
        return () => clearTimeout(timeout)
    }, [globalQuery, category, project])

    return (
        <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex flex-col gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                        placeholder="Category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="h-8"
                    />
                    <Input
                        placeholder="Project"
                        value={project}
                        onChange={(e) => setProject(e.target.value)}
                        className="h-8"
                    />
                </div>
                {error && <div className="text-xs text-red-500">{error}</div>}
                {loading && (
                    <div className="p-2 text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                    </div>
                )}
                {!loading && (
                    <div className="max-h-64 overflow-auto divide-y">
                        {results.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground">No notes</div>
                        ) : (
                            results.map((n) => (
                                <button
                                    key={n.id}
                                    type="button"
                                    className="w-full text-left p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                                    onClick={() => {
                                        haptics.buttonPress()
                                        try { useNoteContextStore.getState?.()?.setCurrentNoteId?.(n.id) } catch { }
                                        router.push('/notes')
                                        onClose()
                                    }}
                                    title={n.title || 'Open note'}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm text-gray-900 dark:text-gray-100 truncate">{n.title || 'Untitled'}</div>
                                            <div className="text-[11px] text-muted-foreground truncate">{[n.category, n.project].filter(Boolean).join(' · ') || '—'}</div>
                                        </div>
                                        {n.updated_at && (
                                            <div className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(n.updated_at).toLocaleDateString()}</div>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
