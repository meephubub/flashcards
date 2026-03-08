import { useState, useEffect } from "react"
import { Loader2, Copy } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { makeGroqRequest } from "@/lib/groq"
import { useNoteContextStore } from "@/hooks/use-note-context"

interface FixNoteContentProps {
    currentNoteId: string | null
    onClose: () => void
    onOpenSelectNote: () => void
}

export function FixNoteContent({ currentNoteId, onClose, onOpenSelectNote }: FixNoteContentProps) {
    const [working, setWorking] = useState(false)
    const [progress, setProgress] = useState(0)
    const [message, setMessage] = useState("Preparing…")
    const [error, setError] = useState<string | null>(null)

    // Hooks from context
    const getCurrentNoteForExam = useNoteContextStore((s) => s.getCurrentNoteForExam)
    const updateCurrentNoteContent = useNoteContextStore((s) => s.updateCurrentNoteContent)

    const messages = [
        "Analyzing note…",
        "Applying formatting guidelines…",
        "Generating revised content…",
        "Finalizing update…",
    ]

    useEffect(() => {
        // Only run when mounted
        const run = async () => {
            try {
                if (!currentNoteId || typeof getCurrentNoteForExam !== 'function') {
                    onOpenSelectNote()
                    onClose()
                    return
                }
                const data = getCurrentNoteForExam()
                if (!data || !data.content?.trim()) {
                    alert('No content found for the current note.')
                    onClose()
                    return
                }
                setError(null)
                setWorking(true)
                setProgress(0)

                const start = Date.now()
                // 2 minute timeline visual
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

                const guidelines = `
You are an expert technical editor. Fix all errors and improve clarity without changing meaning.
Formatting rules:
- replace any <br> with a line break
- Output MUST be Markdown only. No code fences, no backticks, no prose outside the note.
- Keep headings structured (#, ##, ###) and use consistent title case.
- Convert unordered text lists into proper bullet lists.
- Keep and normalize fenced code blocks with correct language tags.
- Fix broken or relative image links only if a clear absolute replacement exists; otherwise preserve as-is.
- Remove duplicated sections, obvious OCR artifacts, and dangling references.
- Keep important equations, examples, and tables; render in Markdown.
- Do not add a preface or summary unless the note already contains one (then improve it).
`
                const systemMessage = 'You are a meticulous Markdown editor. Return ONLY the corrected Markdown. Do not include code fences or explanations.'
                const userPrompt = `Please revise the following note according to the guidelines. Return ONLY the corrected Markdown content.\n\nGuidelines:\n${guidelines}\n\nNote Markdown:\n${data.content}`

                // Call Groq
                const revised = await makeGroqRequest(userPrompt, false, systemMessage)
                const cleaned = (revised || '').trim()
                if (!cleaned) {
                    throw new Error('AI returned empty content')
                }

                // Update DB
                const { error } = await supabase
                    .from('notes')
                    .update({ content: cleaned })
                    .eq('id', currentNoteId)
                    .single()
                if (error) throw new Error(error.message)

                // Update UI
                try { updateCurrentNoteContent?.(cleaned) } catch { }
                try { window.dispatchEvent(new CustomEvent('note-updated', { detail: { id: currentNoteId } })) } catch { }

                // Finish
                setProgress(100)
                clearInterval(timer)
                clearInterval(msgTimer)
                onClose()
            } catch (e: any) {
                console.error('Fix note failed', e)
                setError(e?.message || 'Failed to fix note content')
                setWorking(false)
                // Keep component open to show error
            }
        }
        run()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // run once on mount

    return (
        <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex flex-col gap-2">
                {working && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            <span className="font-medium">AI Fixing Note</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                            <span>{message}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 w-full bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}
                {error && (
                    <div className="space-y-2">
                        <div className="text-xs text-red-500 font-medium">Error: {error}</div>
                        <button
                            onClick={onClose}
                            className="text-xs px-2 py-1 bg-neutral-100 hover:bg-neutral-200 rounded"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
