import { useState, useEffect } from "react"
import { ListTodo, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface HomeworkRow { id: number; created_at: string; user_id: string; due_date: string | null; subject: string | null; priority: number | null; done: boolean | null }

export function TodoList() {
    const [loading, setLoading] = useState(false)
    const [todos, setTodos] = useState<HomeworkRow[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchTodos = async () => {
            try {
                setLoading(true)
                setError(null)
                const { data: userRes, error: uErr } = await supabase.auth.getUser()
                if (uErr) throw uErr
                const uid = userRes?.user?.id
                if (!uid) { setTodos([]); return }
                const { data, error } = await (supabase as any)
                    .from('homework')
                    .select('id, created_at, user_id, due_date, subject, priority, done')
                    .eq('user_id', uid)
                    .eq('done', false)
                    .order('due_date', { ascending: true, nullsFirst: false })
                    .order('priority', { ascending: false, nullsFirst: false })
                    .order('created_at', { ascending: false })
                if (error) throw error
                setTodos(((data as unknown) as HomeworkRow[]) || [])
            } catch (e: any) {
                console.error('Fetch homework failed', e)
                setError(e?.message || 'Failed to load tasks')
            } finally {
                setLoading(false)
            }
        }
        fetchTodos()
    }, [])

    const toggleTodo = async (id: number, done: boolean) => {
        try {
            await (supabase as any).from('homework').update({ done } as any).eq('id', id)
            if (done) {
                setTodos((prev) => prev.filter((t) => t.id !== id))
            } else {
                setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)))
            }
        } catch (e) {
            console.error('Update task failed', e)
        }
    }

    return (
        <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-emerald-600" />
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Tasks</div>
                </div>
                {error && <div className="text-xs text-red-500">{error}</div>}
                {loading && (
                    <div className="p-2 text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                )}
                {!loading && todos.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">No tasks</div>
                )}
                <div className="divide-y">
                    {todos.filter((t) => !t.done).map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            className="w-full text-left p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                            onClick={() => toggleTodo(t.id, true)}
                            title="Mark as done"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-gray-900 dark:text-gray-100 truncate">{t.subject || 'Homework'}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : 'No due date'}
                                        {t.priority ? ` · Priority ${t.priority}` : ''}
                                    </div>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Done</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
