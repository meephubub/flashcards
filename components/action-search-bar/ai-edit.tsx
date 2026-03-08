import { useState } from "react"
import { Pencil, Loader2 } from "lucide-react"
import { makeGroqRequest } from "@/lib/groq"
import { supabase } from "@/lib/supabase"
import { useNoteContextStore } from "@/hooks/use-note-context"

interface AiEditProps {
    currentNoteId: string | null
    onClose: () => void
    onOpenSelectNote: () => void
}

export function AiEdit({ currentNoteId, onClose, onOpenSelectNote }: AiEditProps) {
    const [prompt, setPrompt] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const getCurrentNoteForExam = useNoteContextStore((s) => s.getCurrentNoteForExam)
    const updateCurrentNoteContent = useNoteContextStore((s) => s.updateCurrentNoteContent)

    const reset = () => {
        setPrompt('')
        setLoading(false)
        setError(null)
        setPreview(null)
        onClose()
    }

    const handleGenerate = async () => {
        try {
            if (!currentNoteId || typeof getCurrentNoteForExam !== 'function') {
                onOpenSelectNote()
                return
            }
            const data = getCurrentNoteForExam()
            if (!data || !data.content?.trim()) {
                alert('No content found for the current note.')
                return
            }
            const instruction = prompt.trim()
            if (!instruction) {
                setError('Please enter an instruction')
                return
            }
            setLoading(true)
            setError(null)
            setPreview(null)
            const systemMessage = 'You are a meticulous Markdown editor. Return ONLY the edited Markdown. No code fences or explanations.'
            const userPrompt = `Instruction:\n${instruction}\n\nEdit the following Markdown accordingly and return ONLY the final Markdown (no backticks, no fences):\n\n${data.content}`
            const revised = await makeGroqRequest(userPrompt, false, systemMessage)
            const cleaned = (revised || '').trim()
            if (!cleaned) {
                throw new Error('AI returned empty content')
            }
            setPreview(cleaned)
        } catch (e: any) {
            console.error('Edit with AI failed', e)
            setError(e?.message || 'Failed to edit with AI')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        try {
            if (!currentNoteId || !preview) return
            const { error } = await supabase
                .from('notes')
                .update({ content: preview })
                .eq('id', currentNoteId)
                .single()
            if (error) throw new Error(error.message)
            // Update UI immediately with the saved content
            try { updateCurrentNoteContent?.(preview) } catch { }
            // Broadcast a global event so any listeners can refetch
            try { window.dispatchEvent(new CustomEvent('note-updated', { detail: { id: currentNoteId } })) } catch { }
            reset()
        } catch (e: any) {
            console.error('Save failed', e)
            setError(e?.message || 'Failed to save changes')
        }
    }

    return (
        <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-blue-600" />
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Edit with AI</div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-gray-600 dark:text-gray-400" htmlFor="edit-ai-textarea">Instruction</label>
                    <textarea
                        id="edit-ai-textarea"
                        rows={3}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={loading}
                        placeholder="e.g., Rewrite concisely, fix grammar, keep code blocks, and preserve Markdown structure."
                        className="w-full rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={loading || !prompt.trim()}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                        >
                            {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>) : 'Generate'}
                        </button>
                        <button
                            type="button"
                            onClick={reset}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
                {error && <div className="text-xs text-red-500">{error}</div>}
                {preview && (
                    <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview</div>
                        <div className="max-h-64 overflow-auto rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 p-2 text-sm whitespace-pre-wrap break-words">
                            {preview}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleSave}
                                className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                            >
                                Save changes
                            </button>
                            <button
                                type="button"
                                onClick={reset}
                                className="px-3 py-1.5 text-sm rounded-md border border-black/10 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
