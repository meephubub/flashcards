import { useState } from "react"
import { HelpCircle, Copy } from "lucide-react"
import { makeGroqRequest } from "@/lib/groq"

interface AiQnaProps {
    question: string
}

export function AiQna({ question }: AiQnaProps) {
    const [loading, setLoading] = useState(false)
    const [answer, setAnswer] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const askAI = async () => {
        const q = question.trim()
        if (!q) return
        try {
            setLoading(true)
            setError(null)
            const systemMessage = "You are a helpful assistant. Answer clearly and concisely."
            const res = await makeGroqRequest(q, false, systemMessage)
            setAnswer(res)
        } catch (err: any) {
            setError(err?.message || 'Failed to get an answer.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full px-4 pb-2 -mt-2">
            <div className="rounded-lg border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-800/90 px-3 py-2 text-sm flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-500" />
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Ask AI</div>
                </div>
                <div className="text-gray-900 dark:text-gray-100 font-medium whitespace-pre-wrap break-words">
                    {question || 'Type your question after ?'}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={askAI}
                        disabled={loading || !question.trim()}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                    >
                        {loading ? 'Thinking…' : 'Ask'}
                    </button>
                    {answer && (
                        <button
                            type="button"
                            onClick={async () => { await navigator.clipboard.writeText(answer) }}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                            <Copy className="w-4 h-4" />
                            Copy answer
                        </button>
                    )}
                </div>
                {error && (
                    <div className="text-xs text-red-500">{error}</div>
                )}
                {answer && (
                    <div className="mt-1 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                        {answer}
                    </div>
                )}
            </div>
        </div>
    )
}
